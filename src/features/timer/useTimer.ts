import { useCallback, useEffect, useState } from 'react'
import { localStore } from '../../lib/localStore'
import { elapsedSeconds } from '../../lib/time'
import type { Activity, ActiveSession, CompletedSession } from './types'

export function useTimer() {
  const [active, setActive] = useState<ActiveSession | null>(() => localStore.getActive())
  const [completed, setCompleted] = useState<CompletedSession[]>(() => localStore.getCompleted())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [active])

  const start = useCallback((activity: Activity) => {
    if (active) return
    const session: ActiveSession = {
      id: crypto.randomUUID(),
      activity,
      startedAt: new Date().toISOString(),
    }
    localStore.setActive(session)
    setActive(session)
    setNow(Date.now())
  }, [active])

  const finish = useCallback(() => {
    if (!active) return
    const session: CompletedSession = {
      ...active,
      finishedAt: new Date().toISOString(),
    }
    const sessions = localStore.addCompleted(session)
    localStore.setActive(null)
    setCompleted(sessions)
    setActive(null)
  }, [active])

  return {
    active,
    completed,
    elapsed: active ? elapsedSeconds(active.startedAt, now) : 0,
    start,
    finish,
  }
}
