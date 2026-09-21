import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { ActiveSession, CompletedSession } from './types'

export type NativeTimerActionType = 'pause' | 'resume' | 'finish' | 'startBreak' | 'startFocus'

export type NativeTimerAction = {
  actionId: string
  type: NativeTimerActionType
  sessionId: string
  occurredAt: string
  revision: number
  active?: ActiveSession | null
  completed?: CompletedSession | null
}

export type NativeTimerSnapshot = {
  version: number
  revision: number
  updatedAtMs: number
  active: ActiveSession | null
  pendingActions: NativeTimerAction[]
  notificationDismissedAtMs?: number
}

type NativeTimerEvent = {
  action?: unknown
  snapshot?: unknown
}

type TimerNotificationPlugin = {
  syncActiveTimer: (options: { sessionJson: string | null; baseRevision: number }) => Promise<{ accepted?: boolean; snapshot?: unknown }>
  getTimerState: () => Promise<{ snapshot?: unknown }>
  acknowledgeAction: (options: { actionId: string }) => Promise<void>
  cancelMilestone: (options: { sessionId: string }) => Promise<void>
  addListener: (eventName: 'timerAction', listener: (event: NativeTimerEvent) => void) => Promise<PluginListenerHandle>
}

// Some web test doubles only expose Capacitor, not registerPlugin. Keeping the
// guard here makes the browser implementation a genuine no-op without asking
// every caller to mock an Android-only plugin.
const timerPlugin: TimerNotificationPlugin | null = typeof registerPlugin === 'function'
  ? registerPlugin<TimerNotificationPlugin>('TimerNotification')
  : null

let knownRevision = 0
let operationChain: Promise<unknown> = Promise.resolve()

function supported(): boolean {
  return Boolean(timerPlugin && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android')
}

export function isNativeTimerBridgeAvailable(): boolean {
  return supported()
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = operationChain.then(operation, operation)
  operationChain = next.then(() => undefined, () => undefined)
  return next
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function normalizeSession(value: unknown): ActiveSession | null {
  const raw = objectValue(value)
  if (!raw || typeof raw.id !== 'string' || typeof raw.startedAt !== 'string') return null
  const activity = objectValue(raw.activity)
  if (!activity || typeof activity.id !== 'string' || typeof activity.name !== 'string' || typeof activity.color !== 'string') return null
  const domain = { ...raw }
  delete domain.startedAtMs
  delete domain.pausedAtMs
  return {
    ...domain,
    activity: { id: activity.id, name: activity.name, color: activity.color, ...(typeof activity.category === 'string' ? { category: activity.category } : {}) },
  } as ActiveSession
}

function normalizeCompleted(value: unknown): CompletedSession | null {
  const session = normalizeSession(value)
  const raw = objectValue(value)
  if (!session || !raw || typeof raw.finishedAt !== 'string') return null
  return { ...session, finishedAt: raw.finishedAt } as CompletedSession
}

function normalizeAction(value: unknown): NativeTimerAction | null {
  const raw = objectValue(value)
  if (!raw || typeof raw.actionId !== 'string' || typeof raw.type !== 'string' || typeof raw.sessionId !== 'string' || typeof raw.occurredAt !== 'string') return null
  if (!['pause', 'resume', 'finish', 'startBreak', 'startFocus'].includes(raw.type)) return null
  return {
    actionId: raw.actionId,
    type: raw.type as NativeTimerActionType,
    sessionId: raw.sessionId,
    occurredAt: raw.occurredAt,
    revision: typeof raw.revision === 'number' ? raw.revision : 0,
    active: raw.active === null ? null : normalizeSession(raw.active),
    completed: normalizeCompleted(raw.completed),
  }
}

function parseSnapshot(value: unknown): NativeTimerSnapshot | null {
  let parsed = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) as unknown } catch { return null }
  }
  const raw = objectValue(parsed)
  if (!raw) return null
  const snapshotRaw = objectValue(raw.snapshot)
  const snapshot = snapshotRaw ?? raw
  const pending = Array.isArray(snapshot.pendingActions) ? snapshot.pendingActions.map(normalizeAction).filter((item): item is NativeTimerAction => Boolean(item)) : []
  return {
    version: typeof snapshot.version === 'number' ? snapshot.version : 1,
    revision: typeof snapshot.revision === 'number' ? snapshot.revision : 0,
    updatedAtMs: typeof snapshot.updatedAtMs === 'number' ? snapshot.updatedAtMs : 0,
    active: snapshot.active === null ? null : normalizeSession(snapshot.active),
    pendingActions: pending,
    ...(typeof snapshot.notificationDismissedAtMs === 'number' ? { notificationDismissedAtMs: snapshot.notificationDismissedAtMs } : {}),
  }
}

function updateRevision(snapshot: NativeTimerSnapshot | null): NativeTimerSnapshot | null {
  if (snapshot) knownRevision = Math.max(knownRevision, snapshot.revision)
  return snapshot
}

export async function getNativeTimerState(): Promise<NativeTimerSnapshot | null> {
  if (!supported()) return null
  return enqueue(async () => updateRevision(parseSnapshot((await timerPlugin!.getTimerState()).snapshot)))
}

export type NativeTimerSyncResult = {
  accepted: boolean
  snapshot: NativeTimerSnapshot | null
}

export async function syncNativeTimer(session: ActiveSession | null): Promise<NativeTimerSyncResult> {
  if (!supported()) return { accepted: true, snapshot: null }
  // Capture the revision at the call site, not when this operation eventually
  // reaches the serialized bridge queue. A notification action can advance
  // native state while an older web sync is waiting behind another bridge
  // operation; that older payload must then be rejected by the native
  // compare-and-swap rule instead of reusing the newer revision.
  const baseRevision = knownRevision
  return enqueue(async () => {
    const response = await timerPlugin!.syncActiveTimer({ sessionJson: session ? JSON.stringify(session) : null, baseRevision })
    const snapshot = updateRevision(parseSnapshot(response.snapshot))
    return { accepted: response.accepted !== false, snapshot }
  })
}

export async function acknowledgeNativeTimerAction(actionId: string): Promise<void> {
  if (!supported()) return
  await enqueue(async () => { await timerPlugin!.acknowledgeAction({ actionId }) })
}

export async function cancelNativeTimerMilestone(sessionId: string): Promise<void> {
  if (!supported()) return
  await enqueue(async () => { await timerPlugin!.cancelMilestone({ sessionId }) })
}

export async function addNativeTimerListener(listener: (action: NativeTimerAction, snapshot: NativeTimerSnapshot | null) => void): Promise<() => Promise<void>> {
  if (!supported()) return async () => undefined
  const handle = await timerPlugin!.addListener('timerAction', (event) => {
    const action = normalizeAction(event.action)
    if (action) listener(action, updateRevision(parseSnapshot(event.snapshot)))
  })
  return () => handle.remove()
}

export const __nativeTimerInternals = {
  normalizeAction,
  normalizeSession,
  parseSnapshot,
  supported,
}
