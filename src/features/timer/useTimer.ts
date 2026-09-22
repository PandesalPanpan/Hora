import { useCallback, useEffect, useRef, useState } from 'react'
import { localStore } from '../../lib/localStore'
import { activeSessionSeconds } from '../../lib/time'
import type { Activity, ActiveSession, CompletedSession } from './types'
import { cancelTimeflowMilestone, scheduleTimeflowMilestone } from '../../lib/notifications'
import { acknowledgeNativeTimerAction, addNativeTimerListener, getNativeTimerState, syncNativeTimer, type NativeTimerAction, type NativeTimerSnapshot } from './native'
import { reconcileNativeTimerAction } from './nativeSync'

export type TimerStartOptions = {
  taskId?: string
  taskTitleSnapshot?: string
  plannedBlockId?: string
  timerMode?: 'flowtime' | 'pomodoro'
  pomodoro?: ActiveSession['pomodoro']
  note?: string
}

type NativeEvent = { action: NativeTimerAction; snapshot: NativeTimerSnapshot | null }

export function useTimer() {
  const [active, setActive] = useState<ActiveSession | null>(() => localStore.getActive())
  const [completed, setCompleted] = useState<CompletedSession[]>(() => localStore.getCompleted())
  const [now, setNow] = useState(() => Date.now())
  const activeRef = useRef(active)
  const completedRef = useRef(completed)
  const hydratedRef = useRef(false)
  const nativeWorkRef = useRef(Promise.resolve())
  const queuedNativeEventsRef = useRef<NativeEvent[]>([])

  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { completedRef.current = completed }, [completed])

  const applyNativeAction = useCallback(async (action: NativeTimerAction): Promise<void> => {
    const result = reconcileNativeTimerAction(activeRef.current, completedRef.current, action)
    if (result.changed) {
      if (result.completion) {
        const sessions = localStore.addCompleted(result.completion)
        await localStore.persistCompleted(result.completion)
        completedRef.current = sessions
        setCompleted(sessions)
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('iza-native-completion', { detail: result.completion }))
      }
      if (result.active !== activeRef.current) {
        localStore.setActive(result.active)
        await localStore.persistActive(result.active)
        activeRef.current = result.active
        setActive(result.active)
        setNow(Date.now())
        if (result.active) {
          void scheduleTimeflowMilestone(result.active, activeSessionSeconds(result.active), { requestPermission: false })
        } else {
          void cancelTimeflowMilestone(action.sessionId)
        }
      }
    }
    // An idempotent duplicate is still safe to acknowledge: the domain write
    // already exists, so retaining it would replay the same native action on
    // every launch.
    await acknowledgeNativeTimerAction(action.actionId)
  }, [])

  const queueNativeEvent = useCallback((event: NativeEvent) => {
    if (!hydratedRef.current) {
      queuedNativeEventsRef.current.push(event)
      return
    }
    nativeWorkRef.current = nativeWorkRef.current.then(() => applyNativeAction(event.action)).catch(() => undefined)
  }, [applyNativeAction])

  const reconcileNativeSnapshot = useCallback((snapshot: NativeTimerSnapshot | null) => {
    if (!snapshot) return
    if (!hydratedRef.current) {
      for (const action of snapshot.pendingActions) queuedNativeEventsRef.current.push({ action, snapshot })
      return
    }
    nativeWorkRef.current = nativeWorkRef.current.then(async () => {
      for (const action of snapshot.pendingActions) await applyNativeAction(action)
    }).catch(() => undefined)
  }, [applyNativeAction])

  const publishNative = useCallback((session: ActiveSession | null) => {
    void syncNativeTimer(session).then((result) => {
      if (!result.accepted) reconcileNativeSnapshot(result.snapshot)
    }).catch(() => undefined)
  }, [reconcileNativeSnapshot])

  useEffect(() => {
    let disposed = false
    let dispose: (() => Promise<void>) | undefined
    void addNativeTimerListener((action, snapshot) => {
      if (disposed) return
      if (snapshot?.pendingActions.length) reconcileNativeSnapshot(snapshot)
      else queueNativeEvent({ action, snapshot })
    }).then((remove) => {
      if (disposed) void remove()
      else dispose = remove
    }).catch(() => undefined)
    return () => {
      disposed = true
      if (dispose) void dispose()
    }
  }, [queueNativeEvent, reconcileNativeSnapshot])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const state = await localStore.hydrate()
      const native = await getNativeTimerState()
      if (cancelled) return
      activeRef.current = state.active
      completedRef.current = state.completed
      setActive(state.active)
      setCompleted(state.completed)
      setNow(Date.now())
      hydratedRef.current = true

      if (native) {
        for (const action of native.pendingActions) await applyNativeAction(action)
        // If the Dexie read was interrupted before the web-side mirror was
        // written, a native active snapshot can restore the one active session.
        if (!activeRef.current && native.active) {
          localStore.setActive(native.active)
          await localStore.persistActive(native.active)
          activeRef.current = native.active
          setActive(native.active)
          setNow(Date.now())
        }
      }

      const queued = queuedNativeEventsRef.current.splice(0)
      for (const event of queued) await applyNativeAction(event.action)
      if (!cancelled) publishNative(activeRef.current)
    })().catch(() => undefined)
    return () => { cancelled = true }
  }, [applyNativeAction, publishNative])

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
    const reload = () => {
      void (async () => {
        const state = await localStore.hydrate()
        activeRef.current = state.active
        completedRef.current = state.completed
        setActive(state.active)
        setCompleted(state.completed)
        setNow(Date.now())
        const native = await getNativeTimerState()
        if (native) for (const action of native.pendingActions) await applyNativeAction(action)
        publishNative(activeRef.current)
      })().catch(() => undefined)
    }
    document.addEventListener('iza-app-foreground', reload)
    window.addEventListener('iza-data-changed', reload)
    window.addEventListener('iza-data-scope-changed', reload)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('iza-data-changed', reload)
      window.removeEventListener('iza-data-scope-changed', reload)
      document.removeEventListener('iza-app-foreground', reload)
    }
  }, [applyNativeAction, publishNative])

  const start = useCallback((activity: Activity, targetMinutes: number | null = null, options: TimerStartOptions = {}) => {
    if (activeRef.current) return
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
    activeRef.current = session
    setActive(session)
    setNow(Date.now())
    void scheduleTimeflowMilestone(session, 0, { requestPermission: true })
    publishNative(session)
  }, [publishNative])

  const pause = useCallback(() => {
    const current = activeRef.current
    if (!current || current.status === 'paused') return
    const session: ActiveSession = { ...current, status: 'paused', pausedAt: new Date().toISOString() }
    localStore.setActive(session)
    activeRef.current = session
    setActive(session)
    void cancelTimeflowMilestone(session.id)
    publishNative(session)
  }, [publishNative])

  const resume = useCallback(() => {
    const current = activeRef.current
    if (!current || current.status !== 'paused' || !current.pausedAt) return
    const addedPause = Math.max(0, Math.floor((Date.now() - new Date(current.pausedAt).getTime()) / 1000))
    const session: ActiveSession = {
      ...current,
      status: 'running',
      pausedAt: null,
      pausedSeconds: (current.pausedSeconds ?? 0) + addedPause,
    }
    localStore.setActive(session)
    activeRef.current = session
    setActive(session)
    setNow(Date.now())
    void scheduleTimeflowMilestone(session, activeSessionSeconds(session), { requestPermission: true })
    publishNative(session)
  }, [publishNative])

  const setTargetMinutes = useCallback((targetMinutes: number | null) => {
    const current = activeRef.current
    if (!current) return
    const session: ActiveSession = { ...current, targetMinutes, targetAcknowledged: false }
    localStore.setActive(session)
    activeRef.current = session
    setActive(session)
    void scheduleTimeflowMilestone(session, activeSessionSeconds(session), { requestPermission: true })
    publishNative(session)
  }, [publishNative])

  const setNote = useCallback((note: string) => {
    const current = activeRef.current
    if (!current) return
    const session: ActiveSession = { ...current, note }
    localStore.setActive(session)
    activeRef.current = session
    setActive(session)
    publishNative(session)
  }, [publishNative])

  const acknowledgeTarget = useCallback(() => {
    const current = activeRef.current
    if (!current) return
    const session = { ...current, targetAcknowledged: true }
    localStore.setActive(session)
    activeRef.current = session
    setActive(session)
    void cancelTimeflowMilestone(session.id)
    publishNative(session)
  }, [publishNative])

  const finish = useCallback((): CompletedSession | undefined => {
    const current = activeRef.current
    if (!current) return
    const finishedAt = new Date().toISOString()
    const finalPausedSeconds = (current.pausedSeconds ?? 0) + (current.pausedAt
      ? Math.max(0, Math.floor((new Date(finishedAt).getTime() - new Date(current.pausedAt).getTime()) / 1000))
      : 0)
    const session: CompletedSession = {
      ...current,
      status: 'completed',
      pausedAt: null,
      pausedSeconds: finalPausedSeconds,
      finishedAt,
    }
    const sessions = localStore.addCompleted(session)
    localStore.setActive(null)
    void cancelTimeflowMilestone(current.id)
    completedRef.current = sessions
    activeRef.current = null
    setCompleted(sessions)
    setActive(null)
    publishNative(null)
    return session
  }, [publishNative])

  const updateCompleted = useCallback(async (id: string, patch: Partial<Pick<CompletedSession, 'activity' | 'note' | 'mood' | 'startedAt' | 'finishedAt'>>) => {
    const sessions = await localStore.updateCompleted(id, patch)
    completedRef.current = sessions
    setCompleted(sessions)
  }, [])

  const deleteCompleted = useCallback((id: string) => {
    const deleted = completedRef.current.find((session) => session.id === id)
    if (deleted) {
      const sessions = localStore.deleteCompleted(id)
      completedRef.current = sessions
      setCompleted(sessions)
    }
    return deleted
  }, [])

  const restoreCompleted = useCallback((session: CompletedSession) => {
    const sessions = localStore.restoreCompleted(session)
    completedRef.current = sessions
    setCompleted(sessions)
  }, [])

  const advancePomodoro = useCallback((): CompletedSession | undefined => {
    const currentSession = activeRef.current
    if (!currentSession?.pomodoro) return
    const finishedAt = new Date().toISOString()
    const completedSession: CompletedSession = {
      ...currentSession,
      status: 'completed',
      finishedAt,
      pausedAt: null,
      pausedSeconds: (currentSession.pausedSeconds ?? 0) + (currentSession.pausedAt
        ? Math.max(0, Math.floor((new Date(finishedAt).getTime() - new Date(currentSession.pausedAt).getTime()) / 1000))
        : 0),
    }
    const phase = currentSession.pomodoro
    const nextPhase = phase.phase === 'focus' ? 'break' : 'focus'
    const nextRound = phase.phase === 'break' ? phase.round + 1 : phase.round
    const cycleComplete = phase.phase === 'break' && phase.round >= (phase.totalRounds ?? 4)
    const sessions = localStore.addCompleted(completedSession)
    void cancelTimeflowMilestone(currentSession.id)
    completedRef.current = sessions
    setCompleted(sessions)

    if (cycleComplete) {
      localStore.setActive(null)
      activeRef.current = null
      setActive(null)
      publishNative(null)
      return completedSession
    }

    const next: ActiveSession = {
      id: crypto.randomUUID(),
      activity: nextPhase === 'break' ? { id: 'break', name: 'Break', color: '#4d862a' } : phase.focusActivity,
      startedAt: finishedAt,
      targetMinutes: nextPhase === 'break' ? phase.breakMinutes : phase.focusMinutes,
      status: 'running',
      pausedAt: null,
      pausedSeconds: 0,
      timerMode: 'pomodoro',
      pomodoro: { ...phase, phase: nextPhase, round: nextRound },
    }
    localStore.setActive(next)
    activeRef.current = next
    setActive(next)
    setNow(Date.now())
    void scheduleTimeflowMilestone(next, 0, { requestPermission: true })
    publishNative(next)
    return completedSession
  }, [publishNative])

  return {
    active,
    completed,
    elapsed: active ? activeSessionSeconds(active, now) : 0,
    start,
    pause,
    resume,
    setTargetMinutes,
    setNote,
    acknowledgeTarget,
    finish,
    updateCompleted,
    deleteCompleted,
    restoreCompleted,
    advancePomodoro,
  }
}
