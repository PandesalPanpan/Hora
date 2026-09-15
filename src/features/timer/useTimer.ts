import { useCallback, useEffect, useState } from 'react'
import { localStore } from '../../lib/localStore'
import { activeSessionSeconds } from '../../lib/time'
import type { Activity, ActiveSession, CompletedSession } from './types'
import { cancelMilestoneNotification, scheduleMilestoneNotification } from '../../lib/notifications'

export type TimerStartOptions = {
  taskId?: string
  taskTitleSnapshot?: string
  plannedBlockId?: string
  timerMode?: 'flowtime' | 'pomodoro'
  pomodoro?: ActiveSession['pomodoro']
}

export function useTimer() {
  const [active, setActive] = useState<ActiveSession | null>(() => localStore.getActive())
  const [completed, setCompleted] = useState<CompletedSession[]>(() => localStore.getCompleted())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    void localStore.hydrate().then((state) => {
      if (cancelled) return
      if (state.active) {
        setActive(state.active)
        localStore.setActive(state.active)
      }
      setCompleted(state.completed)
      setNow(Date.now())
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

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

  const start = useCallback((activity: Activity, targetMinutes: number | null = null, options: TimerStartOptions = {}) => {
    if (active) return
    const session: ActiveSession = {
      id: crypto.randomUUID(),
      activity,
      startedAt: new Date().toISOString(),
      targetMinutes,
      status: 'running',
      pausedAt: null,
      pausedSeconds: 0,
      ...options,
    }
    localStore.setActive(session)
    setActive(session)
    setNow(Date.now())
    void scheduleMilestoneNotification(session)
  }, [active])

  const pause = useCallback(() => {
    if (!active || active.status === 'paused') return
    const session: ActiveSession = { ...active, status: 'paused', pausedAt: new Date().toISOString() }
    localStore.setActive(session)
    setActive(session)
    void cancelMilestoneNotification(session.id)
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
    void scheduleMilestoneNotification(session, activeSessionSeconds(session))
  }, [active])

  const setTargetMinutes = useCallback((targetMinutes: number | null) => {
    if (!active) return
    const session: ActiveSession = { ...active, targetMinutes, targetAcknowledged: false }
    localStore.setActive(session)
    setActive(session)
    void scheduleMilestoneNotification(session, activeSessionSeconds(session))
  }, [active])

  const acknowledgeTarget = useCallback(() => {
    if (!active) return
    const session = { ...active, targetAcknowledged: true }
    localStore.setActive(session)
    setActive(session)
    void cancelMilestoneNotification(session.id)
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
    void cancelMilestoneNotification(active.id)
    setCompleted(sessions)
    setActive(null)
    return session
  }, [active])

  const updateCompleted = useCallback(async (id: string, patch: Partial<Pick<CompletedSession, 'activity' | 'note' | 'mood' | 'startedAt' | 'finishedAt'>>) => {
    const sessions = await localStore.updateCompleted(id, patch)
    setCompleted(sessions)
  }, [])

  const deleteCompleted = useCallback((id: string) => {
    const deleted = completed.find((session) => session.id === id)
    if (deleted) setCompleted(localStore.deleteCompleted(id))
    return deleted
  }, [completed])

  const restoreCompleted = useCallback((session: CompletedSession) => {
    setCompleted(localStore.restoreCompleted(session))
  }, [])

  const advancePomodoro = useCallback((): CompletedSession | undefined => {
    if (!active?.pomodoro) return
    const finishedAt = new Date().toISOString()
    const completedSession: CompletedSession = {
      ...active,
      status: 'completed',
      finishedAt,
      pausedAt: null,
      pausedSeconds: (active.pausedSeconds ?? 0) + (active.pausedAt
        ? Math.max(0, Math.floor((new Date(finishedAt).getTime() - new Date(active.pausedAt).getTime()) / 1000))
        : 0),
    }
    const current = active.pomodoro
    const nextPhase = current.phase === 'focus' ? 'break' : 'focus'
    const nextRound = current.phase === 'break' ? current.round + 1 : current.round
    const cycleComplete = current.phase === 'break' && current.round >= 4
    const sessions = localStore.addCompleted(completedSession)
    void cancelMilestoneNotification(active.id)
    setCompleted(sessions)

    if (cycleComplete) {
      localStore.setActive(null)
      setActive(null)
      return completedSession
    }

    const next: ActiveSession = {
      id: crypto.randomUUID(),
      activity: nextPhase === 'break' ? { id: 'break', name: 'Break', color: '#4d862a' } : current.focusActivity,
      startedAt: finishedAt,
      targetMinutes: nextPhase === 'break' ? current.breakMinutes : current.focusMinutes,
      status: 'running',
      pausedAt: null,
      pausedSeconds: 0,
      timerMode: 'pomodoro',
      pomodoro: { ...current, phase: nextPhase, round: nextRound },
    }
    localStore.setActive(next)
    setActive(next)
    setNow(Date.now())
    void scheduleMilestoneNotification(next)
    return completedSession
  }, [active])

  return {
    active,
    completed,
    elapsed: active ? activeSessionSeconds(active, now) : 0,
    start,
    pause,
    resume,
    setTargetMinutes,
    acknowledgeTarget,
    finish,
    updateCompleted,
    deleteCompleted,
    restoreCompleted,
    advancePomodoro,
  }
}
