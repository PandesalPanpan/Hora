import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveSession } from './types'

const mocks = vi.hoisted(() => {
  const plugin = {
    syncActiveTimer: vi.fn(),
    getTimerState: vi.fn(),
    acknowledgeAction: vi.fn(async () => undefined),
    cancelMilestone: vi.fn(async () => undefined),
    addListener: vi.fn(),
  }
  return { plugin }
})

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
  registerPlugin: vi.fn(() => mocks.plugin),
}))

const session: ActiveSession = {
  id: 'session-1',
  activity: { id: 'study', name: 'Study', color: '#b92f60' },
  startedAt: '2026-09-21T08:00:00.000Z',
  status: 'running',
  targetMinutes: 25,
  pausedAt: null,
  pausedSeconds: 0,
}

function nativeSnapshot(active: ActiveSession | null = session, revision = 1, pendingActions: unknown[] = []) {
  return { version: 1, revision, updatedAtMs: 1, active, pendingActions }
}

describe('TimerNotification bridge contract', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.plugin.syncActiveTimer.mockImplementation(async ({ sessionJson, baseRevision }: { sessionJson: string | null; baseRevision: number }) => ({ accepted: true, snapshot: nativeSnapshot(sessionJson ? JSON.parse(sessionJson) as ActiveSession : null, baseRevision + 1) }))
    mocks.plugin.getTimerState.mockResolvedValue({ snapshot: nativeSnapshot() })
  })

  it('mirrors an active session through one start/update bridge call', async () => {
    const { syncNativeTimer } = await import('./native')
    const result = await syncNativeTimer(session)
    expect(result.accepted).toBe(true)
    expect(mocks.plugin.syncActiveTimer).toHaveBeenCalledOnce()
    expect(mocks.plugin.syncActiveTimer).toHaveBeenCalledWith({ sessionJson: JSON.stringify(session), baseRevision: 0 })
  })

  it('exposes pending native actions for startup reconciliation', async () => {
    const action = { actionId: 'a1', type: 'finish', sessionId: session.id, occurredAt: '2026-09-21T08:02:00.000Z', revision: 2, active: null, completed: { ...session, status: 'completed', finishedAt: '2026-09-21T08:02:00.000Z' } }
    mocks.plugin.getTimerState.mockResolvedValue({ snapshot: nativeSnapshot(null, 2, [action]) })
    const { getNativeTimerState } = await import('./native')
    const state = await getNativeTimerState()
    expect(state?.pendingActions[0]).toMatchObject({ actionId: 'a1', type: 'finish' })
  })

  it('forwards native events, acknowledgements, and milestone cancellation', async () => {
    let receive: ((event: unknown) => void) | undefined
    mocks.plugin.addListener.mockImplementation(async (_name: string, listener: (event: unknown) => void) => { receive = listener; return { remove: vi.fn(async () => undefined) } })
    const { addNativeTimerListener, acknowledgeNativeTimerAction, cancelNativeTimerMilestone } = await import('./native')
    const onAction = vi.fn()
    const remove = await addNativeTimerListener(onAction)
    receive?.({ action: { actionId: 'a1', type: 'pause', sessionId: session.id, occurredAt: session.startedAt, revision: 2, active: { ...session, status: 'paused', pausedAt: session.startedAt } }, snapshot: nativeSnapshot() })
    expect(onAction).toHaveBeenCalledOnce()
    await acknowledgeNativeTimerAction('a1')
    await cancelNativeTimerMilestone(session.id)
    expect(mocks.plugin.acknowledgeAction).toHaveBeenCalledWith({ actionId: 'a1' })
    expect(mocks.plugin.cancelMilestone).toHaveBeenCalledWith({ sessionId: session.id })
    await remove()
  })

  it('captures the compare-and-swap revision before a queued web sync waits', async () => {
    let releaseBlocker!: () => void
    const unblockBlocker = new Promise<void>((resolve) => { releaseBlocker = resolve })
    mocks.plugin.getTimerState.mockImplementationOnce(async () => {
      await unblockBlocker
      return { snapshot: nativeSnapshot(session, 0) }
    })

    let receive: ((event: unknown) => void) | undefined
    mocks.plugin.addListener.mockImplementationOnce(async (_name: string, listener: (event: unknown) => void) => {
      receive = listener
      return { remove: vi.fn(async () => undefined) }
    })

    const { getNativeTimerState, addNativeTimerListener, syncNativeTimer } = await import('./native')
    await addNativeTimerListener(vi.fn())
    const blocker = getNativeTimerState()
    await vi.waitFor(() => expect(mocks.plugin.getTimerState).toHaveBeenCalledOnce())
    const queuedSync = syncNativeTimer(session)

    receive?.({
      action: { actionId: 'native-2', type: 'pause', sessionId: session.id, occurredAt: session.startedAt, revision: 2, active: session },
      snapshot: nativeSnapshot(session, 2),
    })
    releaseBlocker()
    await blocker
    await queuedSync

    expect(mocks.plugin.syncActiveTimer).toHaveBeenCalledWith({ sessionJson: JSON.stringify(session), baseRevision: 0 })
  })
})
