import { describe, expect, it } from 'vitest'
import type { ActiveSession, CompletedSession } from './types'
import { reconcileNativeTimerAction, reconcileNativeTimerActions } from './nativeSync'
import type { NativeTimerAction } from './native'

const startedAt = '2026-09-21T08:00:00.000Z'
const activity = { id: 'study', name: 'Study', color: '#b92f60' }

function active(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return { id: 'session-1', activity, startedAt, status: 'running', targetMinutes: 25, pausedAt: null, pausedSeconds: 0, ...overrides }
}

function action(overrides: Partial<NativeTimerAction> = {}): NativeTimerAction {
  return { actionId: 'native-1', type: 'pause', sessionId: 'session-1', occurredAt: '2026-09-21T08:01:00.000Z', revision: 2, active: active({ status: 'paused', pausedAt: '2026-09-21T08:01:00.000Z' }), ...overrides }
}

describe('native timer reconciliation', () => {
  it('applies a native pause and keeps the explicit pause timestamp', () => {
    const result = reconcileNativeTimerAction(active(), [], action())
    expect(result.active).toMatchObject({ status: 'paused', pausedAt: '2026-09-21T08:01:00.000Z' })
    expect(result.completed).toHaveLength(0)
  })

  it('applies a native resume without restarting the session', () => {
    const paused = active({ status: 'paused', pausedAt: '2026-09-21T08:01:00.000Z', pausedSeconds: 0 })
    const result = reconcileNativeTimerAction(paused, [], action({ type: 'resume', active: active({ pausedAt: null, pausedSeconds: 120 }) }))
    expect(result.active).toMatchObject({ id: 'session-1', status: 'running', startedAt, pausedSeconds: 120 })
  })

  it('finishes a native action exactly once and removes the active session', () => {
    const completed: CompletedSession = { ...active({ status: 'completed', pausedAt: null, pausedSeconds: 10 }), finishedAt: '2026-09-21T08:03:00.000Z' }
    const first = reconcileNativeTimerAction(active(), [], action({ type: 'finish', active: null, completed }))
    const second = reconcileNativeTimerAction(first.active, first.completed, action({ type: 'finish', active: null, completed }))
    expect(first.active).toBeNull()
    expect(first.completed).toHaveLength(1)
    expect(second.active).toBeNull()
    expect(second.completed).toHaveLength(1)
    expect(second.changed).toBe(false)
  })

  it('ignores a stale native action for another active session', () => {
    const result = reconcileNativeTimerAction(active({ id: 'newer-session' }), [], action())
    expect(result.changed).toBe(false)
    expect(result.active?.id).toBe('newer-session')
  })

  it('replays pending native actions in order and preserves one completion', () => {
    const paused = action()
    const resumed = action({ actionId: 'native-2', type: 'resume', active: active({ pausedAt: null, pausedSeconds: 90 }), revision: 3 })
    const result = reconcileNativeTimerActions(active(), [], [paused, resumed])
    expect(result.active).toMatchObject({ status: 'running', pausedSeconds: 90 })
    expect(result.completed).toHaveLength(0)
  })
})
