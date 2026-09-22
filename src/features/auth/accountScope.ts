import { db } from '../../lib/db'
import { getInstallationId, localOwnerId, userOwnerId } from '../../lib/ownership'
import { withSyncSuppressed } from '../sync/hooks'
import { serializeForCloud, syncKey, type OutboxEntry, type SyncEntityType, type SyncTombstone } from '../sync/schema'

const LINKED_ACCOUNTS_KEY = 'iza.linked-accounts.v1'

function readLinkedAccounts(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LINKED_ACCOUNTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function writeLinkedAccounts(accounts: string[]): void {
  localStorage.setItem(LINKED_ACCOUNTS_KEY, JSON.stringify([...new Set(accounts)]))
}

function entryFor(entityType: SyncEntityType, record: Record<string, unknown>, ownerId: string): OutboxEntry {
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : updatedAt
  const deviceId = typeof record.deviceId === 'string' ? record.deviceId : getInstallationId()
  const normalized = { ...record, ownerId, createdAt, updatedAt, deviceId, syncSchemaVersion: 1, deletedAt: record.deletedAt ?? null }
  return {
    id: syncKey(ownerId, entityType, String(record.id)),
    ownerId,
    entityType,
    entityId: String(record.id),
    envelope: serializeForCloud(entityType, normalized as never, ownerId, deviceId, updatedAt),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
    createdAt,
    updatedAt,
  }
}

/**
 * Claims the anonymous installation's existing local records exactly once.
 * After the first account is linked, a later account never receives those
 * records implicitly; that is the guard that prevents account cross-talk.
 */
export async function claimUnlinkedLocalData(uid: string): Promise<boolean> {
  const linked = readLinkedAccounts()
  const accountOwner = userOwnerId(uid)
  if (linked.length || accountOwner === localOwnerId()) {
    writeLinkedAccounts([...linked, uid])
    return false
  }

  const localOwner = localOwnerId()
  const records = [
    { entityType: 'sessions' as const, table: db.sessions },
    { entityType: 'plannedBlocks' as const, table: db.plannedBlocks },
    { entityType: 'tasks' as const, table: db.tasks },
    { entityType: 'activities' as const, table: db.activities },
  ]

  await withSyncSuppressed(async () => {
    await db.transaction('rw', [db.sessions, db.plannedBlocks, db.tasks, db.activities, db.outbox, db.syncTombstones, db.meta], async () => {
      for (const { entityType, table } of records) {
        const localRecords = await table.where('ownerId').equals(localOwner).toArray()
        for (const record of localRecords) {
          const next = { ...record, ownerId: accountOwner, deviceId: record.deviceId ?? getInstallationId(), syncSchemaVersion: 1 }
          await (table as { put: (value: unknown) => Promise<unknown> }).put(next)
          await db.outbox.put(entryFor(entityType, next, accountOwner))
        }
      }

      const localOutbox = await db.outbox.where('ownerId').equals(localOwner).toArray()
      for (const entry of localOutbox) {
        const next = { ...entry, id: syncKey(accountOwner, entry.entityType, entry.entityId), ownerId: accountOwner, envelope: { ...entry.envelope, ownerId: uid }, status: 'pending' as const, nextAttemptAt: 0 }
        await db.outbox.delete(entry.id)
        await db.outbox.put(next)
      }

      const localTombstones = await db.syncTombstones.where('ownerId').equals(localOwner).toArray()
      for (const tombstone of localTombstones) {
        const next: SyncTombstone = { ...tombstone, id: syncKey(accountOwner, tombstone.entityType, tombstone.entityId), ownerId: accountOwner }
        await db.syncTombstones.delete(tombstone.id)
        await db.syncTombstones.put(next)
      }
    })
  })
  writeLinkedAccounts([...linked, uid])
  return true
}

export const accountScopeKeys = { LINKED_ACCOUNTS_KEY }
