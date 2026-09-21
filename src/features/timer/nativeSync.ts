import type { ActiveSession, CompletedSession } from './types'
import type { NativeTimerAction } from './native'

export type NativeReconciliationResult = {
  active: ActiveSession | null
  completed: CompletedSession[]
  changed: boolean
  completion?: CompletedSession
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function withCompleted(completed: CompletedSession[], session: CompletedSession): { sessions: CompletedSession[]; added: boolean } {
  if (completed.some((item) => item.id === session.id)) return { sessions: completed, added: false }
  return { sessions: [session, ...completed], added: true }
}

/**
 * Applies one native action idempotently. Native actions win over an older
 * active record, but an action for a different currently-running session is
 * treated as stale and cannot replace that newer session.
 */
export function reconcileNativeTimerAction(currentActive: ActiveSession | null, completed: CompletedSession[], action: NativeTimerAction): NativeReconciliationResult {
  const sameActiveSession = currentActive?.id === action.sessionId
  const actionActive = action.active ?? null

  if (action.type === 'finish') {
    if (!action.completed || action.completed.id !== action.sessionId) return { active: currentActive, completed, changed: false }
    if (currentActive && !sameActiveSession) return { active: currentActive, completed, changed: false }
    const result = withCompleted(completed, action.completed)
    const nextActive = sameActiveSession ? null : currentActive
    return {
      active: nextActive,
      completed: result.sessions,
      changed: result.added || nextActive !== currentActive,
      ...(result.added ? { completion: action.completed } : {}),
    }
  }

  if (action.type === 'pause' || action.type === 'resume') {
    if (currentActive && !sameActiveSession) return { active: currentActive, completed, changed: false }
    if (!actionActive) return { active: currentActive, completed, changed: false }
    if (sameValue(currentActive, actionActive)) return { active: currentActive, completed, changed: false }
    return { active: actionActive, completed, changed: true }
  }

  // A phase transition completes the old phase and may install the next one.
  if (currentActive && !sameActiveSession && !completed.some((item) => item.id === action.sessionId)) {
    return { active: currentActive, completed, changed: false }
  }
  if (!action.completed || action.completed.id !== action.sessionId) return { active: currentActive, completed, changed: false }
  const result = withCompleted(completed, action.completed)
  const nextActive = actionActive && (!currentActive || currentActive.id === actionActive.id) ? actionActive : currentActive
  const activeChanged = !sameValue(currentActive, nextActive)
  return {
    active: nextActive,
    completed: result.sessions,
    changed: result.added || activeChanged,
    ...(result.added ? { completion: action.completed } : {}),
  }
}

export function reconcileNativeTimerActions(currentActive: ActiveSession | null, completed: CompletedSession[], actions: NativeTimerAction[]): NativeReconciliationResult {
  let result: NativeReconciliationResult = { active: currentActive, completed, changed: false }
  for (const action of actions) {
    const next = reconcileNativeTimerAction(result.active, result.completed, action)
    result = {
      active: next.active,
      completed: next.completed,
      changed: result.changed || next.changed,
      ...(next.completion ? { completion: next.completion } : result.completion ? { completion: result.completion } : {}),
    }
  }
  return result
}
