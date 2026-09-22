import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Firestore,
  type CollectionReference,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../../lib/db'
import { getFirebaseFirestore } from '../../lib/firebase'
import { getInstallationId, userOwnerId } from '../../lib/ownership'
import { withSyncSuppressed } from './hooks'
import {
  deserializeFromCloud,
  isCloudEnvelope,
  serializeForCloud,
  serializeTombstone,
  syncEntityTypes,
  syncKey,
  versionCompare,
  type CloudEnvelope,
  type OutboxEntry,
  type SyncEntityType,
  type SyncTombstone,
} from './schema'
import { refreshPendingCount, setSyncStatus } from './status'

let activeUid: string | null = null
let listeners: Unsubscribe[] = []
let retryTimer: ReturnType<typeof setTimeout> | null = null
let syncInFlight: Promise<void> | null = null
let lifecycleCleanup: (() => void) | null = null

function firestoreCollection(firestore: Firestore, uid: string, entityType: SyncEntityType): CollectionReference {
  return collection(firestore, 'users', uid, entityType)
}

function firestoreDocument(firestore: Firestore, uid: string, entityType: SyncEntityType, entityId: string): DocumentReference {
  return doc(firestore, 'users', uid, entityType, entityId)
}

function tableFor(entityType: SyncEntityType) {
  return db.table<Record<string, unknown>, string>(entityType)
}

function friendlySyncError(): string {
  return 'Cloud sync is unavailable right now. Changes are safe locally and will retry.'
}

function scheduleRetry(): void {
  if (!activeUid || retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void syncNow()
  }, 30_000)
}

async function localEnvelope(uid: string, entityType: SyncEntityType, entityId: string): Promise<CloudEnvelope | null> {
  const ownerId = userOwnerId(uid)
  const record = await tableFor(entityType).get(entityId)
  if (record && record.ownerId === ownerId && !record.deletedAt) {
    const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()
    return serializeForCloud(entityType, record as never, ownerId, typeof record.deviceId === 'string' ? record.deviceId : getInstallationId(), updatedAt)
  }
  const tombstone = await db.syncTombstones.get(syncKey(ownerId, entityType, entityId))
  if (tombstone) return serializeTombstone(entityType, ownerId, entityId, tombstone.deviceId, tombstone.updatedAt)
  return null
}

async function ensureOutbox(uid: string, envelope: CloudEnvelope): Promise<void> {
  const ownerId = userOwnerId(uid)
  const id = syncKey(ownerId, envelope.recordType, envelope.id)
  await db.transaction('rw', db.outbox, async () => {
    const current = await db.outbox.get(id)
    if (current && versionCompare(current.envelope, envelope) >= 0 && current.status !== 'synced') return
    if (current && versionCompare(current.envelope, envelope) === 0 && current.status === 'synced') return
    const next: OutboxEntry = {
      id,
      ownerId,
      entityType: envelope.recordType,
      entityId: envelope.id,
      envelope,
      status: 'pending',
      attempts: current?.attempts ?? 0,
      nextAttemptAt: 0,
      createdAt: current?.createdAt ?? envelope.createdAt,
      updatedAt: envelope.updatedAt,
    }
    await db.outbox.put(next)
  })
}

async function applyRemoteEnvelope(uid: string, envelope: CloudEnvelope): Promise<void> {
  const ownerId = userOwnerId(uid)
  const table = tableFor(envelope.recordType)
  await withSyncSuppressed(async () => {
    await db.transaction('rw', table, db.outbox, db.syncTombstones, async () => {
      const current = await table.get(envelope.id)
      if (envelope.deletedAt) {
        if (current && current.ownerId === ownerId) await table.delete(envelope.id)
        const tombstone: SyncTombstone = {
          id: syncKey(ownerId, envelope.recordType, envelope.id),
          ownerId,
          entityType: envelope.recordType,
          entityId: envelope.id,
          deviceId: envelope.deviceId,
          schemaVersion: envelope.schemaVersion,
          updatedAt: envelope.updatedAt,
          deletedAt: envelope.deletedAt,
        }
        await db.syncTombstones.put(tombstone)
      } else {
        const record = deserializeFromCloud<Record<string, unknown>>(envelope)
        if (!record) return
        await table.put({ ...record, ownerId })
        await db.syncTombstones.delete(syncKey(ownerId, envelope.recordType, envelope.id))
      }

      const entry = await db.outbox.get(syncKey(ownerId, envelope.recordType, envelope.id))
      if (entry && versionCompare(entry.envelope, envelope) <= 0) {
        await db.outbox.put({ ...entry, status: 'synced', nextAttemptAt: 0, lastError: undefined })
      }
    })
  })
  window.dispatchEvent(new Event('iza-data-changed'))
}

async function mergeRemoteEnvelope(uid: string, envelope: CloudEnvelope): Promise<void> {
  if (envelope.ownerId !== uid || !isCloudEnvelope(envelope)) return
  const local = await localEnvelope(uid, envelope.recordType, envelope.id)
  if (!local || versionCompare(envelope, local) > 0) {
    await applyRemoteEnvelope(uid, envelope)
    return
  }
  if (versionCompare(local, envelope) > 0) await ensureOutbox(uid, local)
  else {
    const entry = await db.outbox.get(syncKey(userOwnerId(uid), envelope.recordType, envelope.id))
    if (entry && entry.status !== 'synced') await db.outbox.put({ ...entry, status: 'synced', nextAttemptAt: 0 })
  }
}

async function flushEntry(firestore: Firestore, entry: OutboxEntry): Promise<void> {
  const reference = firestoreDocument(firestore, activeUid!, entry.entityType, entry.entityId)
  // Normalize envelopes created by an older build that used the local
  // `user:{uid}` namespace in the cloud envelope. Firestore rules accept only
  // the authenticated Firebase UID.
  const envelope = entry.envelope.ownerId === activeUid ? entry.envelope : { ...entry.envelope, ownerId: activeUid! }
  const remoteSnapshot = await getDoc(reference)
  const remote = remoteSnapshot.exists() ? remoteSnapshot.data() : null
  if (remote && isCloudEnvelope(remote)) {
    if (versionCompare(remote, envelope) > 0) {
      await applyRemoteEnvelope(activeUid!, remote)
      return
    }
  }
  await setDoc(reference, envelope)

  const current = await db.outbox.get(entry.id)
  if (current && current.updatedAt === entry.updatedAt && versionCompare(current.envelope, envelope) === 0) {
    await db.outbox.put({ ...current, envelope, status: 'synced', nextAttemptAt: 0, lastError: undefined })
  }
}

async function flushOutbox(uid: string, firestore: Firestore): Promise<void> {
  const ownerId = userOwnerId(uid)
  const now = Date.now()
  const entries = (await db.outbox.where('ownerId').equals(ownerId).toArray())
    .filter(entry => (entry.status === 'pending' || entry.status === 'failed') && entry.nextAttemptAt <= now)
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))

  for (const entry of entries) {
    const current = await db.outbox.get(entry.id)
    if (!current || current.updatedAt !== entry.updatedAt) continue
    await db.outbox.put({ ...current, status: 'syncing', lastError: undefined })
    try {
      await flushEntry(firestore, entry)
    } catch {
      const latest = await db.outbox.get(entry.id)
      if (latest) {
        const attempts = latest.attempts + 1
        await db.outbox.put({ ...latest, status: 'failed', attempts, nextAttemptAt: Date.now() + Math.min(300_000, 2 ** Math.min(attempts, 8) * 1_000), lastError: friendlySyncError() })
      }
      throw new Error(friendlySyncError())
    }
  }
}

async function readRemoteCollections(uid: string, firestore: Firestore): Promise<void> {
  const snapshots = await Promise.all(syncEntityTypes.map(entityType => getDocs(firestoreCollection(firestore, uid, entityType))))
  for (const snapshot of snapshots) {
    for (const item of snapshot.docs) {
      const raw = item.data()
      if (isCloudEnvelope(raw)) await mergeRemoteEnvelope(uid, raw)
    }
  }
}

async function performSync(uid: string, firestore: Firestore): Promise<void> {
  setSyncStatus({ phase: 'syncing', error: null })
  await readRemoteCollections(uid, firestore)
  await flushOutbox(uid, firestore)
  const pending = await refreshPendingCount(userOwnerId(uid))
  setSyncStatus({ phase: pending ? 'pending' : 'synced', pending, lastSyncedAt: new Date().toISOString(), error: null })
}

export async function syncNow(): Promise<void> {
  if (!activeUid) return
  const firestore = getFirebaseFirestore()
  if (!firestore) {
    setSyncStatus({ phase: 'disabled', error: null })
    return
  }
  if (syncInFlight) return syncInFlight
  const uid = activeUid
  syncInFlight = performSync(uid, firestore).catch(() => {
    void refreshPendingCount(userOwnerId(uid)).catch(() => undefined)
    setSyncStatus({ phase: 'error', error: friendlySyncError() })
    scheduleRetry()
  }).finally(() => { syncInFlight = null })
  return syncInFlight
}

function listenForRemoteChanges(uid: string, firestore: Firestore): void {
  listeners = syncEntityTypes.map(entityType => onSnapshot(
    firestoreCollection(firestore, uid, entityType),
    snapshot => {
      void Promise.all(snapshot.docChanges().map(change => {
        const raw = change.doc.data()
        return isCloudEnvelope(raw) ? mergeRemoteEnvelope(uid, raw) : Promise.resolve()
      })).then(() => refreshPendingCount(userOwnerId(uid))).catch(() => {
        setSyncStatus({ phase: 'error', error: friendlySyncError() })
        scheduleRetry()
      })
    },
    () => {
      setSyncStatus({ phase: 'error', error: friendlySyncError() })
      scheduleRetry()
    },
  ))
}

export function startCloudSync(uid: string): void {
  if (activeUid === uid) {
    void syncNow()
    return
  }
  stopCloudSync()
  activeUid = uid
  const firestore = getFirebaseFirestore()
  if (!firestore) {
    setSyncStatus({ phase: 'disabled', pending: 0, error: null })
    return
  }
  lifecycleCleanup = () => {
    window.removeEventListener('online', online)
    window.removeEventListener('iza-app-foreground', foreground)
  }
  const online = () => { void syncNow() }
  const foreground = () => { void syncNow() }
  window.addEventListener('online', online)
  window.addEventListener('iza-app-foreground', foreground)
  void syncNow().then(() => {
    if (activeUid === uid) listenForRemoteChanges(uid, firestore)
  })
}

export function stopCloudSync(): void {
  for (const unsubscribe of listeners) unsubscribe()
  listeners = []
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  lifecycleCleanup?.()
  lifecycleCleanup = null
  activeUid = null
  syncInFlight = null
  setSyncStatus({ phase: 'signed-out', pending: 0, error: null })
}

export function activeSyncUid(): string | null {
  return activeUid
}
