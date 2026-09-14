import { useCallback, useEffect, useState } from 'react'
import { localStore } from '../../lib/localStore'
import { activeSessionSeconds } from '../../lib/time'
import type { Activity, ActiveSession, CompletedSession } from './types'

export function useTimer() {
  const [active, setActive] = useState<ActiveSession | null>(() => localStore.getActive())
  const [completed, setCompleted] = useState<CompletedSession[]>(() => localStore.getCompleted())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active || active.status === 'paused') return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [active])

  useEffect(() => {
    const refresh = () => setNow(Date.now())
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const start = useCallback((activity: Activity, targetMinutes: number | null = null) => {
    if (active) return
    const session: ActiveSession = {
      id: crypto.randomUUID(),
      activity,
      startedAt: new Date().toISOString(),
      targetMinutes,
      status: 'running',
      pausedAt: null,
      pausedSeconds: 0,
    }
    localStore.setActive(session)
    setActive(session)
    setNow(Date.now())
  }, [active])

  const pause = useCallback(() => {
    if (!active || active.status === 'paused') return
    const session: ActiveSession = { ...active, status: 'paused', pausedAt: new Date().toISOString() }
    localStore.setActive(session)
    setActive(session)
  }, [active])

  const resume = useCallback(() => {
    if (!active || active.status !== 'paused' || !active.pausedAt) return
    const addedPause = Math.max(0, Math.floor((Date.now() - new Date(active.pausedAt).getTime()) / 1000))
    const session: ActiveSession = {
      ...active,
      status: 'running',
      pausedAt: null,
      pausedSeconds: (active.pausedSeconds ?? 0) + addedPause,
    }
    localStore.setActive(session)
    setActive(session)
    setNow(Date.now())
  }, [active])

  const setTargetMinutes = useCallback((targetMinutes: number | null) => {
    if (!active) return
    const session: ActiveSession = { ...active, targetMinutes }
    localStore.setActive(session)
    setActive(session)
  }, [active])

  const finish = useCallback((): CompletedSession | undefined => {
    if (!active) return
    const finishedAt = new Date().toISOString()
    const finalPausedSeconds = (active.pausedSeconds ?? 0) + (active.pausedAt
      ? Math.max(0, Math.floor((new Date(finishedAt).getTime() - new Date(active.pausedAt).getTime()) / 1000))
      : 0)
    const session: CompletedSession = {
      ...active,
      status: 'completed',
      pausedAt: null,
      pausedSeconds: finalPausedSeconds,
      finishedAt,
    }
    const sessions = localStore.addCompleted(session)
    localStore.setActive(null)
    setCompleted(sessions)
    setActive(null)
    return session
  }, [active])

  const updateCompleted = useCallback((id: string, patch: Partial<Pick<CompletedSession, 'activity' | 'note' | 'mood'>>) => {
    setCompleted(localStore.updateCompleted(id, patch))
  }, [])

  return {
    active,
    completed,
    elapsed: active ? activeSessionSeconds(active, now) : 0,
    start,
    pause,
    resume,
    setTargetMinutes,
    finish,
    updateCompleted,
  }
}
