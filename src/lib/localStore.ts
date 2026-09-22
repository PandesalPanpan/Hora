import type { ActiveSession, CompletedSession } from '../features/timer/types'
import { db, legacyKeys, loadDatabaseState } from './db'
import { getCurrentOwnerId, getInstallationId, isLocalOwner } from './ownership'

const { ACTIVE_KEY, COMPLETED_KEY } = legacyKeys

function parse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function scopedKey(key: string, ownerId = getCurrentOwnerId()): string {
  return `${key}.${encodeURIComponent(ownerId)}`
}

function belongsToCurrentOwner(record: { ownerId?: string }): boolean {
  return !record.ownerId ? isLocalOwner(getCurrentOwnerId()) : record.ownerId === getCurrentOwnerId()
}

function activeCache(session: ActiveSession | null): ActiveSession | null {
  if (!session || !belongsToCurrentOwner(session)) return null
  return { ...session, ownerId: session.ownerId ?? getCurrentOwnerId(), deviceId: session.deviceId ?? getInstallationId() }
}

export const localStore = {
  async hydrate() {
    const state = await loadDatabaseState()
    const owner = getCurrentOwnerId()
    const active = activeCache(state.active)
    localStorage.setItem(scopedKey(COMPLETED_KEY, owner), JSON.stringify(state.completed))
    if (isLocalOwner(owner)) localStorage.setItem(COMPLETED_KEY, JSON.stringify(state.completed))
    if (active) {
      localStorage.setItem(scopedKey(ACTIVE_KEY, owner), JSON.stringify(active))
      if (isLocalOwner(owner)) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active))
    } else {
      localStorage.removeItem(scopedKey(ACTIVE_KEY, owner))
      if (isLocalOwner(owner)) localStorage.removeItem(ACTIVE_KEY)
    }
    return state
  },

  getActive(): ActiveSession | null {
    const owner = getCurrentOwnerId()
    const cached = parse<ActiveSession | null>(localStorage.getItem(scopedKey(ACTIVE_KEY, owner)) ?? (isLocalOwner(owner) ? localStorage.getItem(ACTIVE_KEY) : null), null)
    return activeCache(cached)
  },

  setActive(session: ActiveSession | null): void {
    const owner = getCurrentOwnerId()
    const next = activeCache(session)
    if (next) {
      localStorage.setItem(scopedKey(ACTIVE_KEY, owner), JSON.stringify(next))
      if (isLocalOwner(owner)) localStorage.setItem(ACTIVE_KEY, JSON.stringify(next))
    } else {
      localStorage.removeItem(scopedKey(ACTIVE_KEY, owner))
      if (isLocalOwner(owner)) localStorage.removeItem(ACTIVE_KEY)
    }
    void this.persistActive(session).catch(() => undefined)
  },

  async persistActive(session: ActiveSession | null): Promise<void> {
    const owner = getCurrentOwnerId()
    await db.transaction('rw', db.sessions, db.outbox, db.syncTombstones, async () => {
      const existing = await db.sessions.where('ownerId').equals(owner).filter(item => item.status === 'running' || item.status === 'paused').primaryKeys()
      if (existing.length) await db.sessions.bulkDelete(existing)
      if (session && belongsToCurrentOwner(session)) await db.sessions.put({ ...session, ownerId: session.ownerId ?? owner, deviceId: session.deviceId ?? getInstallationId() })
    })
  },

  getCompleted(): CompletedSession[] {
    const owner = getCurrentOwnerId()
    const cached = parse<CompletedSession[]>(localStorage.getItem(scopedKey(COMPLETED_KEY, owner)) ?? (isLocalOwner(owner) ? localStorage.getItem(COMPLETED_KEY) : null), [])
    return cached.filter(belongsToCurrentOwner) as CompletedSession[]
  },

  addCompleted(session: CompletedSession): CompletedSession[] {
    const owner = getCurrentOwnerId()
    const next = { ...session, ownerId: session.ownerId ?? owner, deviceId: session.deviceId ?? getInstallationId() }
    const sessions = [next, ...this.getCompleted().filter((item) => item.id !== session.id)]
    localStorage.setItem(scopedKey(COMPLETED_KEY, owner), JSON.stringify(sessions))
    if (isLocalOwner(owner)) localStorage.setItem(COMPLETED_KEY, JSON.stringify(sessions))
    void db.transaction('rw', db.sessions, db.outbox, db.syncTombstones, async () => { await db.sessions.put(next) }).catch(() => undefined)
    return sessions
  },

  async persistCompleted(session: CompletedSession): Promise<void> {
    await db.transaction('rw', db.sessions, db.outbox, db.syncTombstones, async () => { await db.sessions.put({ ...session, ownerId: session.ownerId ?? getCurrentOwnerId(), deviceId: session.deviceId ?? getInstallationId() }) })
  },

  async updateCompleted(id: string, patch: Partial<Pick<CompletedSession, 'activity' | 'note' | 'mood' | 'startedAt' | 'finishedAt'>>): Promise<CompletedSession[]> {
    const sessions = this.getCompleted().map((session) => session.id === id ? { ...session, ...patch } : session)
    const updated = sessions.find((session) => session.id === id)
    if (!updated) throw new Error('The time log could not be found.')
    const owner = getCurrentOwnerId()
    const next = { ...updated, ownerId: updated.ownerId ?? owner, deviceId: updated.deviceId ?? getInstallationId() }
    await db.transaction('rw', db.sessions, db.outbox, db.syncTombstones, async () => { await db.sessions.put(next) })
    const nextSessions = sessions.map((session) => session.id === id ? next : session)
    localStorage.setItem(scopedKey(COMPLETED_KEY, owner), JSON.stringify(nextSessions))
    if (isLocalOwner(owner)) localStorage.setItem(COMPLETED_KEY, JSON.stringify(nextSessions))
    return nextSessions
  },

  deleteCompleted(id: string): CompletedSession[] {
    const sessions = this.getCompleted().filter((session) => session.id !== id)
    const owner = getCurrentOwnerId()
    localStorage.setItem(scopedKey(COMPLETED_KEY, owner), JSON.stringify(sessions))
    if (isLocalOwner(owner)) localStorage.setItem(COMPLETED_KEY, JSON.stringify(sessions))
    void db.transaction('rw', db.sessions, db.outbox, db.syncTombstones, async () => { await db.sessions.delete(id) }).catch(() => undefined)
    return sessions
  },

  restoreCompleted(session: CompletedSession): CompletedSession[] {
    const owner = getCurrentOwnerId()
    const next = { ...session, ownerId: session.ownerId ?? owner, deviceId: session.deviceId ?? getInstallationId() }
    const nextSessions = [next, ...this.getCompleted().filter((item) => item.id !== session.id)]
    localStorage.setItem(scopedKey(COMPLETED_KEY, owner), JSON.stringify(nextSessions))
    if (isLocalOwner(owner)) localStorage.setItem(COMPLETED_KEY, JSON.stringify(nextSessions))
    void db.transaction('rw', db.sessions, db.outbox, db.syncTombstones, async () => { await db.sessions.put(next) }).catch(() => undefined)
    return nextSessions
  },
}
