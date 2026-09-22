import Dexie, { type Table } from 'dexie'
import type { CreatingHookContext, DeletingHookContext, Transaction, UpdatingHookContext } from 'dexie'
import { getCurrentOwnerId, getInstallationId } from '../../lib/ownership'
import type { SyncMetadata } from '../../lib/syncTypes'
import { serializeForCloud, serializeTombstone, syncKey, type CloudEnvelope, type OutboxEntry, type SyncEntityType, type SyncTombstone } from './schema'

const syncableTables: Record<string, SyncEntityType> = {
  sessions: 'sessions',
  plannedBlocks: 'plannedBlocks',
  tasks: 'tasks',
  activities: 'activities',
}

let suppressed = 0
let database: Dexie | null = null

export function withSyncSuppressed<T>(action: () => Promise<T>): Promise<T> {
  suppressed += 1
  return action().finally(() => { suppressed = Math.max(0, suppressed - 1) })
}

export function isSyncSuppressed(): boolean {
  return suppressed > 0
}

function nowIso(): string {
  return new Date().toISOString()
}

function metadataFor(record: Record<string, unknown>, now = nowIso()): SyncMetadata {
  return {
    ownerId: typeof record.ownerId === 'string' ? record.ownerId : getCurrentOwnerId(),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: now,
    deletedAt: record.deletedAt === null || typeof record.deletedAt === 'string' ? record.deletedAt : null,
    deviceId: typeof record.deviceId === 'string' ? record.deviceId : getInstallationId(),
    syncSchemaVersion: 1,
  }
}

function mergeRecord(record: Record<string, unknown>, now = nowIso()): Record<string, unknown> {
  return { ...record, ...metadataFor(record, now) }
}

function entryFor(entityType: SyncEntityType, record: Record<string, unknown>, now = nowIso()): OutboxEntry {
  const next = mergeRecord(record, now)
  const ownerId = next.ownerId as string
  const entityId = String(next.id)
  const envelope = serializeForCloud(entityType, next as never, ownerId, next.deviceId as string, next.updatedAt as string)
  return {
    id: syncKey(ownerId, entityType, entityId),
    ownerId,
    entityType,
    entityId,
    envelope,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: next.createdAt as string,
    updatedAt: next.updatedAt as string,
  }
}

function tombstoneFor(entityType: SyncEntityType, record: Record<string, unknown>, now = nowIso()): { entry: OutboxEntry; tombstone: SyncTombstone } {
  const metadata = metadataFor(record, now)
  const ownerId = metadata.ownerId as string
  const entityId = String(record.id)
  const envelope: CloudEnvelope = serializeTombstone(entityType, ownerId, entityId, metadata.deviceId as string, now)
  const entry: OutboxEntry = {
    id: syncKey(ownerId, entityType, entityId),
    ownerId,
    entityType,
    entityId,
    envelope,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: now,
  }
  const tombstone: SyncTombstone = {
    id: entry.id,
    ownerId,
    entityType,
    entityId,
    deviceId: metadata.deviceId as string,
    schemaVersion: 1,
    updatedAt: now,
    deletedAt: now,
  }
  return { entry, tombstone }
}

function enqueue(context: { onsuccess?: (...args: never[]) => void }, transaction: Transaction, entry: OutboxEntry, tombstone?: SyncTombstone): void {
  if (!database) return
  const write = async () => {
    await database!.transaction('rw', database!.table('outbox'), database!.table('syncTombstones'), async () => {
      await database!.table<OutboxEntry>('outbox').put(entry)
      if (tombstone) await database!.table<SyncTombstone>('syncTombstones').put(tombstone)
    })
  }
  // Use the caller's wider transaction when it includes bookkeeping tables;
  // direct table writes fall back to a separate transaction after the source
  // request completes.
  const previous = context.onsuccess
  context.onsuccess = (...args: never[]) => {
    previous?.(...args)
    if (transaction.storeNames.includes('outbox') && (!tombstone || transaction.storeNames.includes('syncTombstones'))) {
      void transaction.table<OutboxEntry>('outbox').put(entry)
      if (tombstone) void transaction.table<SyncTombstone>('syncTombstones').put(tombstone)
      return
    }
    // Direct table writes have a source transaction that does not include the
    // bookkeeping tables. Escape Dexie's current transaction context so the
    // fallback bookkeeping write starts cleanly after the source request.
    void Dexie.ignoreTransaction(write).catch(() => undefined)
  }
}

export function registerSyncHooks(db: Dexie): void {
  database = db
  for (const [tableName, entityType] of Object.entries(syncableTables)) {
    const table = db.table<Record<string, unknown>, string>(tableName) as Table<Record<string, unknown>, string>
    table.hook('creating', function (this: CreatingHookContext<Record<string, unknown>, string>, primKey, obj, transaction) {
      if (isSyncSuppressed()) return
      const currentOwner = getCurrentOwnerId()
      if (obj.ownerId && obj.ownerId !== currentOwner) throw new Error('That record belongs to another local account.')
      const next = mergeRecord(obj as Record<string, unknown>)
      Object.assign(obj, next)
      enqueue(this, transaction, entryFor(entityType, next), undefined)
      return primKey
    })
    table.hook('updating', function (this: UpdatingHookContext<Record<string, unknown>, string>, modifications, primKey, obj, transaction) {
      if (isSyncSuppressed()) return
      const currentOwner = getCurrentOwnerId()
      if (obj.ownerId && obj.ownerId !== currentOwner) throw new Error('That record belongs to another local account.')
      const next = mergeRecord({ ...(obj as Record<string, unknown>), ...(modifications as Record<string, unknown>) })
      Object.assign(modifications, metadataFor(next))
      enqueue(this, transaction, entryFor(entityType, next), undefined)
    })
    table.hook('deleting', function (this: DeletingHookContext<Record<string, unknown>, string>, primKey, obj, transaction) {
      if (isSyncSuppressed()) return
      const currentOwner = getCurrentOwnerId()
      if (obj.ownerId && obj.ownerId !== currentOwner) throw new Error('That record belongs to another local account.')
      const { entry, tombstone } = tombstoneFor(entityType, { ...(obj as Record<string, unknown>), id: primKey })
      enqueue(this, transaction, entry, tombstone)
    })
  }
}

export function syncMetadata(record: Record<string, unknown>, now = nowIso()): Record<string, unknown> {
  return mergeRecord(record, now)
}
