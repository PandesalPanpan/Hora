import { useSyncExternalStore } from 'react'
import { db } from '../../lib/db'
import { getCurrentOwnerId } from '../../lib/ownership'

export type SyncPhase = 'disabled' | 'signed-out' | 'offline' | 'syncing' | 'synced' | 'pending' | 'error'

export type SyncStatus = {
  phase: SyncPhase
  pending: number
  lastSyncedAt: string | null
  error: string | null
}

let status: SyncStatus = { phase: 'signed-out', pending: 0, lastSyncedAt: null, error: null }
const listeners = new Set<() => void>()

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeToSyncStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setSyncStatus(next: Partial<SyncStatus>): void {
  status = { ...status, ...next }
  for (const listener of listeners) listener()
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('iza-sync-status-changed'))
}

export async function refreshPendingCount(ownerId = getCurrentOwnerId()): Promise<number> {
  const entries = await db.outbox.where('ownerId').equals(ownerId).toArray()
  const pending = entries.filter(entry => entry.status === 'pending' || entry.status === 'syncing' || entry.status === 'failed').length
  setSyncStatus({ pending, phase: status.phase === 'error' ? 'error' : pending ? 'pending' : status.phase })
  return pending
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeToSyncStatus, getSyncStatus, getSyncStatus)
}
