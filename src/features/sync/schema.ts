import type { ActivityPreset } from '../activities/types'
import type { PlannedBlock } from '../planner/types'
import type { StoredSession } from '../../lib/db'
import type { Task } from '../tasks/types'
import type { SyncMetadata } from '../../lib/syncTypes'

export const CLOUD_SCHEMA_VERSION = 1
export const syncEntityTypes = ['sessions', 'plannedBlocks', 'tasks', 'activities'] as const
export type SyncEntityType = typeof syncEntityTypes[number]
export type SyncRecord = StoredSession | PlannedBlock | Task | ActivityPreset

export type CloudEnvelope = {
  schemaVersion: number
  recordType: SyncEntityType
  id: string
  ownerId: string
  deviceId: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  payload: Record<string, unknown> | null
}

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export type OutboxEntry = {
  id: string
  ownerId: string
  entityType: SyncEntityType
  entityId: string
  envelope: CloudEnvelope
  status: OutboxStatus
  attempts: number
  nextAttemptAt: number
  createdAt: string
  updatedAt: string
  lastError?: string
}

export type SyncTombstone = {
  id: string
  ownerId: string
  entityType: SyncEntityType
  entityId: string
  deviceId: string
  schemaVersion: number
  updatedAt: string
  deletedAt: string
}

const metadataKeys = new Set(['ownerId', 'createdAt', 'updatedAt', 'deletedAt', 'deviceId', 'syncSchemaVersion'])

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUndefined)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, removeUndefined(item)]))
}

export function syncKey(ownerId: string, entityType: SyncEntityType, entityId: string): string {
  return `${ownerId}|${entityType}|${entityId}`
}

/** Convert the local account namespace into the Firebase UID used by rules. */
export function cloudOwnerId(ownerId: string): string {
  return ownerId.startsWith('user:') ? ownerId.slice('user:'.length) : ownerId
}

export function serializeForCloud(entityType: SyncEntityType, record: SyncRecord, ownerId: string, deviceId: string, now = new Date().toISOString()): CloudEnvelope {
  const source = record as SyncRecord & SyncMetadata
  const createdAt = source.createdAt ?? now
  const updatedAt = source.updatedAt ?? now
  const payload = Object.fromEntries(Object.entries(source).filter(([key]) => !metadataKeys.has(key)))
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    recordType: entityType,
    id: source.id,
    ownerId: cloudOwnerId(ownerId),
    deviceId,
    createdAt,
    updatedAt,
    deletedAt: source.deletedAt ?? null,
    payload: source.deletedAt ? null : removeUndefined(payload) as Record<string, unknown>,
  }
}

export function serializeTombstone(entityType: SyncEntityType, ownerId: string, entityId: string, deviceId: string, now = new Date().toISOString()): CloudEnvelope {
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    recordType: entityType,
    id: entityId,
    ownerId: cloudOwnerId(ownerId),
    deviceId,
    createdAt: now,
    updatedAt: now,
    deletedAt: now,
    payload: null,
  }
}

export function deserializeFromCloud<T extends Record<string, unknown> = Record<string, unknown>>(envelope: CloudEnvelope): T | null {
  if (envelope.deletedAt || !envelope.payload) return null
  return {
    ...envelope.payload,
    id: envelope.id,
    ownerId: envelope.ownerId,
    deviceId: envelope.deviceId,
    syncSchemaVersion: envelope.schemaVersion,
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
    deletedAt: null,
  } as unknown as T
}

export function versionCompare(left: Pick<CloudEnvelope, 'updatedAt' | 'deviceId'>, right: Pick<CloudEnvelope, 'updatedAt' | 'deviceId'>): number {
  const leftTime = Date.parse(left.updatedAt)
  const rightTime = Date.parse(right.updatedAt)
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime > rightTime ? 1 : -1
  if (left.updatedAt !== right.updatedAt) return left.updatedAt > right.updatedAt ? 1 : -1
  return left.deviceId === right.deviceId ? 0 : left.deviceId.localeCompare(right.deviceId)
}

export function isCloudEnvelope(value: unknown): value is CloudEnvelope {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CloudEnvelope>
  return candidate.schemaVersion === CLOUD_SCHEMA_VERSION
    && typeof candidate.recordType === 'string'
    && (syncEntityTypes as readonly string[]).includes(candidate.recordType)
    && typeof candidate.id === 'string'
    && typeof candidate.ownerId === 'string'
    && typeof candidate.deviceId === 'string'
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string'
    && (candidate.deletedAt === null || typeof candidate.deletedAt === 'string')
    && (candidate.payload === null || (typeof candidate.payload === 'object' && !Array.isArray(candidate.payload)))
}
