import type { ActiveSession, CompletedSession } from '../features/timer/types'

const ACTIVE_KEY = 'iza.active-session.v1'
const COMPLETED_KEY = 'iza.completed-sessions.v1'

function parse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const localStore = {
  getActive(): ActiveSession | null {
    return parse<ActiveSession | null>(localStorage.getItem(ACTIVE_KEY), null)
  },

  setActive(session: ActiveSession | null): void {
    if (session) localStorage.setItem(ACTIVE_KEY, JSON.stringify(session))
    else localStorage.removeItem(ACTIVE_KEY)
  },

  getCompleted(): CompletedSession[] {
    return parse<CompletedSession[]>(localStorage.getItem(COMPLETED_KEY), [])
  },

  addCompleted(session: CompletedSession): CompletedSession[] {
    const sessions = [session, ...this.getCompleted()]
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(sessions))
    return sessions
  },

  updateCompleted(id: string, patch: Partial<Pick<CompletedSession, 'activity' | 'note' | 'mood'>>): CompletedSession[] {
    const sessions = this.getCompleted().map((session) => session.id === id ? { ...session, ...patch } : session)
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(sessions))
    return sessions
  },
}
