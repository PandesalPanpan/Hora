import type { ActiveSession, CompletedSession } from '../features/timer/types'
import { db, legacyKeys, loadDatabaseState } from './db'

const { ACTIVE_KEY, COMPLETED_KEY } = legacyKeys

function parse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const localStore = {
  hydrate: loadDatabaseState,

  getActive(): ActiveSession | null {
    return parse<ActiveSession | null>(localStorage.getItem(ACTIVE_KEY), null)
  },

  setActive(session: ActiveSession | null): void {
    if (session) localStorage.setItem(ACTIVE_KEY, JSON.stringify(session))
    else localStorage.removeItem(ACTIVE_KEY)
    void db.transaction('rw', db.sessions, async () => {
      const existing = await db.sessions.where('status').anyOf('running', 'paused').primaryKeys()
      if (existing.length) await db.sessions.bulkDelete(existing)
      if (session) await db.sessions.put(session)
    }).catch(() => undefined)
  },

  getCompleted(): CompletedSession[] {
    return parse<CompletedSession[]>(localStorage.getItem(COMPLETED_KEY), [])
  },

  addCompleted(session: CompletedSession): CompletedSession[] {
    const sessions = [session, ...this.getCompleted()]
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(sessions))
    void db.sessions.put(session).catch(() => undefined)
    return sessions
  },

  updateCompleted(id: string, patch: Partial<Pick<CompletedSession, 'activity' | 'note' | 'mood' | 'startedAt' | 'finishedAt'>>): CompletedSession[] {
    const sessions = this.getCompleted().map((session) => session.id === id ? { ...session, ...patch } : session)
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(sessions))
    const updated = sessions.find((session) => session.id === id)
    if (updated) void db.sessions.put(updated).catch(() => undefined)
    return sessions
  },

  deleteCompleted(id: string): CompletedSession[] {
    const sessions = this.getCompleted().filter((session) => session.id !== id)
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(sessions))
    void db.sessions.delete(id).catch(() => undefined)
    return sessions
  },

  restoreCompleted(session: CompletedSession): CompletedSession[] {
    const sessions = [session, ...this.getCompleted().filter((item) => item.id !== session.id)]
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(sessions))
    void db.sessions.put(session).catch(() => undefined)
    return sessions
  },
}
