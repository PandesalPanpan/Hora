import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { LocalNotifications, type ActionPerformed, type LocalNotificationSchema, type PendingLocalNotificationSchema } from '@capacitor/local-notifications'
import type { ActiveSession } from '../features/timer/types'
import { activeSessionSeconds } from './time'
import { db, loadDatabaseState, migrateLegacyLocalStorage } from './db'
import { expandRecurringBlock } from '../features/planner/recurrence'
import type { PlannedBlock } from '../features/planner/types'
import { cancelNativeTimerMilestone, isNativeTimerBridgeAvailable, syncNativeTimer } from '../features/timer/native'

const OWNER = 'iza'
const PLANNER_WINDOW_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

export const notificationChannels = {
  timer: 'iza-timer-alerts',
  activeTimer: 'iza-active-timer',
  planner: 'iza-planner-reminders',
} as const

export type NotificationKind = 'timeflow-milestone' | 'pomodoro-milestone' | 'planner-reminder' | 'test'
export type NotificationPlatform = 'web' | 'android' | 'ios'
export type NotificationCapabilityState = {
  platform: NotificationPlatform
  notifications: 'enabled' | 'permission-required' | 'disabled' | 'unavailable'
  preciseAlarms: 'enabled' | 'not-enabled' | 'unavailable'
}

export type NotificationInitialization = {
  dispose: () => Promise<void>
}

export type NotificationScheduleOptions = {
  requestPermission?: boolean
  nowMs?: number
}

type ReminderOccurrence = {
  block: PlannedBlock
  reminderAt: number
}

const platform = (): NotificationPlatform => {
  if (!Capacitor.isNativePlatform()) return 'web'
  return Capacitor.getPlatform() === 'android' ? 'android' : 'ios'
}

function hash32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Stable, positive Android-compatible ID derived from an owned namespace and domain key. */
export function stableNotificationId(kind: NotificationKind, key: string): number {
  const value = hash32(`iza:${kind}:${key}`) & 0x7fffffff
  return value || 1
}

export function timeflowNotificationId(sessionId: string): number {
  return stableNotificationId('timeflow-milestone', sessionId)
}

export function pomodoroNotificationId(sessionId: string): number {
  return stableNotificationId('pomodoro-milestone', sessionId)
}

export function plannedReminderNotificationId(occurrenceId: string): number {
  return stableNotificationId('planner-reminder', occurrenceId)
}

export function testNotificationId(): number {
  return stableNotificationId('test', 'settings-test')
}

function timerKind(session: ActiveSession): 'timeflow-milestone' | 'pomodoro-milestone' {
  return session.timerMode === 'pomodoro' || Boolean(session.pomodoro) ? 'pomodoro-milestone' : 'timeflow-milestone'
}

function timerId(session: ActiveSession): number {
  return timerKind(session) === 'pomodoro-milestone' ? pomodoroNotificationId(session.id) : timeflowNotificationId(session.id)
}

function isOwnedExtra(extra: unknown): extra is Record<string, unknown> {
  return Boolean(extra && typeof extra === 'object' && (extra as { owner?: unknown }).owner === OWNER)
}

function isOwnedTimer(notification: PendingLocalNotificationSchema): boolean {
  if (isOwnedExtra(notification.extra)) {
    return notification.extra.kind === 'timeflow-milestone' || notification.extra.kind === 'pomodoro-milestone'
  }
  // Clean up notifications created by the first native implementation.
  return Boolean(notification.extra && typeof notification.extra === 'object' && (notification.extra as { sessionId?: unknown }).sessionId && (notification.extra as { route?: unknown }).route === '/today')
}

function isOwnedPlannerReminder(notification: PendingLocalNotificationSchema): boolean {
  return isOwnedExtra(notification.extra) && notification.extra.kind === 'planner-reminder'
}

function dispatchStatusChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('iza-notification-status-changed'))
}

async function notificationPermission(request: boolean): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  let permission = await LocalNotifications.checkPermissions()
  if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
    if (!request) return false
    permission = await LocalNotifications.requestPermissions()
  }
  return permission.display === 'granted'
}

async function exactAlarmEnabled(): Promise<boolean> {
  if (platform() !== 'android') return true
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'
  } catch {
    return false
  }
}

export async function getNotificationCapability(): Promise<NotificationCapabilityState> {
  const currentPlatform = platform()
  if (currentPlatform === 'web') return { platform: 'web', notifications: 'unavailable', preciseAlarms: 'unavailable' }

  try {
    const permission = await LocalNotifications.checkPermissions()
    const notifications = permission.display === 'granted'
      ? 'enabled'
      : permission.display === 'denied' ? 'disabled' : 'permission-required'
    return {
      platform: currentPlatform,
      notifications,
      preciseAlarms: currentPlatform === 'android' ? (await exactAlarmEnabled() ? 'enabled' : 'not-enabled') : 'unavailable',
    }
  } catch {
    return { platform: currentPlatform, notifications: 'disabled', preciseAlarms: currentPlatform === 'android' ? 'not-enabled' : 'unavailable' }
  }
}

export async function requestNotificationPermission(): Promise<NotificationCapabilityState> {
  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.requestPermissions()
    dispatchStatusChanged()
  }
  return getNotificationCapability()
}

export async function openExactAlarmSettings(): Promise<NotificationCapabilityState> {
  if (platform() === 'android') {
    await LocalNotifications.changeExactNotificationSetting()
    dispatchStatusChanged()
  }
  return getNotificationCapability()
}

export async function ensureNotificationChannels(): Promise<void> {
  if (platform() !== 'android') return
  await Promise.all([
    LocalNotifications.createChannel({
      id: notificationChannels.timer,
      name: 'Timer alerts',
      description: 'Timeflow and Pomodoro milestone alerts.',
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#D92F6F',
    }),
    LocalNotifications.createChannel({
      id: notificationChannels.planner,
      name: 'Planner reminders',
      description: 'Reminders for planned calendar blocks.',
      importance: 3,
      visibility: 1,
      vibration: true,
      lights: false,
    }),
  ])
}

async function cancelIds(ids: number[]): Promise<void> {
  if (!ids.length || !Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) })
  } catch {
    // Cancellation is best effort. The persisted domain state remains authoritative.
  }
}

function timeflowNotification(session: ActiveSession, at: Date, exact: boolean): LocalNotificationSchema {
  const kind = timerKind(session)
  const pomodoro = kind === 'pomodoro-milestone'
  return {
    id: timerId(session),
    title: pomodoro ? (session.pomodoro?.phase === 'break' ? 'Break complete' : 'Focus complete') : `${session.activity.name} goal reached`,
    body: pomodoro
      ? (session.pomodoro?.phase === 'break' ? 'Choose when you are ready for the next focus round.' : 'Choose when you are ready to start a break.')
      : 'Keep going, or finish when you are ready.',
    channelId: notificationChannels.timer,
    smallIcon: 'ic_stat_hora',
    iconColor: '#D92F6F',
    foreground: true,
    autoCancel: true,
    schedule: { at, allowWhileIdle: true },
    isExactNotification: exact,
    isExactMandatory: false,
    extra: { owner: OWNER, kind, sessionId: session.id, route: '#/today', exact },
  }
}

async function scheduleTimeflowNotification(session: ActiveSession, elapsedSeconds: number, options: NotificationScheduleOptions = {}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const id = timerId(session)
  const hasTarget = typeof session.targetMinutes === 'number' && session.targetMinutes > 0

  // Android's native timer controller owns the ongoing card and its one-shot
  // milestone fallback. Keep Capacitor's timer alarms for iOS and older builds,
  // but let the native bridge request permission and refresh the card here so a
  // start cannot race the Android 13 notification prompt.
  if (isNativeTimerBridgeAvailable()) {
    await cancelIds([id])
    let permitted = false
    try {
      permitted = await notificationPermission(options.requestPermission ?? false)
    } catch {
      return false
    }
    if (!permitted) return false
    try {
      await syncNativeTimer(session)
      dispatchStatusChanged()
      return true
    } catch {
      return false
    }
  }

  if (!hasTarget || session.status === 'paused' || session.targetAcknowledged) {
    await cancelIds([id])
    return false
  }
  const remainingSeconds = Math.max(0, session.targetMinutes! * 60 - elapsedSeconds)
  if (remainingSeconds <= 0) {
    await cancelIds([id])
    return false
  }
  // Clear the previous target before checking permission so a target edit or
  // permission denial cannot leave an obsolete alarm behind.
  await cancelIds([id])
  let permitted = false
  try {
    permitted = await notificationPermission(options.requestPermission ?? false)
  } catch {
    return false
  }
  if (!permitted) return false

  const exact = await exactAlarmEnabled()
  const at = new Date((options.nowMs ?? Date.now()) + remainingSeconds * 1000)
  await ensureNotificationChannels().catch(() => undefined)
  try {
    const result = await LocalNotifications.schedule({ notifications: [timeflowNotification(session, at, exact)] })
    if (result.warning && exact) {
      // Capacitor 8 safely downgrades a race where exact access disappears. Make
      // the stored metadata agree with the actual fallback and keep the alert.
      await cancelIds([id])
      await LocalNotifications.schedule({ notifications: [timeflowNotification(session, at, false)] })
    }
    dispatchStatusChanged()
    return true
  } catch {
    return false
  }
}

export async function scheduleTimeflowMilestone(session: ActiveSession, elapsedSeconds = activeSessionSeconds(session), options: NotificationScheduleOptions = {}): Promise<boolean> {
  return scheduleTimeflowNotification(session, elapsedSeconds, options)
}

export async function cancelTimeflowMilestone(sessionId: string): Promise<void> {
  await cancelNativeTimerMilestone(sessionId).catch(() => undefined)
  await cancelIds([timeflowNotificationId(sessionId), pomodoroNotificationId(sessionId)])
}

/** Backwards-compatible name for callers from the first notification implementation. */
export const cancelMilestoneNotification = cancelTimeflowMilestone

/** Backwards-compatible name for callers from the first notification implementation. */
export const scheduleMilestoneNotification = scheduleTimeflowMilestone

function reminderAt(block: PlannedBlock): number | null {
  if (typeof block.reminderMinutesBefore !== 'number' || block.reminderMinutesBefore < 0) return null
  return new Date(block.startedAt).getTime() - block.reminderMinutesBefore * 60_000
}

function plannerOccurrences(blocks: PlannedBlock[], nowMs: number): ReminderOccurrence[] {
  const from = new Date(nowMs - DAY_MS)
  const until = new Date(nowMs + PLANNER_WINDOW_DAYS * DAY_MS)
  return blocks.flatMap((source) => {
    const occurrences = expandRecurringBlock(source, { from, until })
    return occurrences.flatMap((block) => {
      const at = reminderAt(block)
      return at !== null && at > nowMs ? [{ block, reminderAt: at }] : []
    })
  })
}

function plannerNotification(occurrence: ReminderOccurrence): LocalNotificationSchema {
  const { block, reminderAt: at } = occurrence
  const occurrenceDate = block.occurrenceDate ?? new Date(block.startedAt).toISOString().slice(0, 10)
  return {
    id: plannedReminderNotificationId(block.id),
    title: block.title,
    body: block.reminderMinutesBefore ? `Starts in ${block.reminderMinutesBefore} minutes.` : 'Starts now.',
    channelId: notificationChannels.planner,
    smallIcon: 'ic_stat_hora',
    iconColor: '#D92F6F',
    foreground: true,
    autoCancel: true,
    schedule: { at: new Date(at), allowWhileIdle: true },
    isExactNotification: false,
    extra: {
      owner: OWNER,
      kind: 'planner-reminder',
      blockId: block.recurrenceSeriesId ?? block.id,
      occurrenceId: block.id,
      occurrenceDate,
      route: '#/planner',
      reminderAt: at,
    },
  }
}

export async function cancelPlannedBlockReminder(blockOrOccurrenceId: PlannedBlock | string): Promise<void> {
  const id = typeof blockOrOccurrenceId === 'string' ? blockOrOccurrenceId : blockOrOccurrenceId.id
  await cancelIds([plannedReminderNotificationId(id)])
}

export async function schedulePlannedBlockReminder(block: PlannedBlock, options: NotificationScheduleOptions = {}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const at = reminderAt(block)
  if (at === null || at <= (options.nowMs ?? Date.now())) {
    await cancelPlannedBlockReminder(block)
    return false
  }
  await cancelPlannedBlockReminder(block)
  let permitted = false
  try {
    permitted = await notificationPermission(options.requestPermission ?? false)
  } catch {
    return false
  }
  if (!permitted) return false
  await ensureNotificationChannels().catch(() => undefined)
  try {
    await LocalNotifications.schedule({ notifications: [plannerNotification({ block, reminderAt: at })] })
    dispatchStatusChanged()
    return true
  } catch {
    return false
  }
}

function pendingAt(notification: PendingLocalNotificationSchema): number | null {
  const at = notification.schedule?.at
  if (!at) return null
  const value = new Date(at).getTime()
  return Number.isFinite(value) ? value : null
}

async function pendingNotifications(): Promise<PendingLocalNotificationSchema[]> {
  try {
    return (await LocalNotifications.getPending()).notifications
  } catch {
    return []
  }
}

export async function reconcileTimeflowNotifications(active?: ActiveSession | null, nowMs = Date.now()): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (active === undefined) {
    const state = await loadDatabaseState()
    active = state.active
  }
  const pending = await pendingNotifications()
  const owned = pending.filter(isOwnedTimer)

  if (isNativeTimerBridgeAvailable()) {
    await cancelIds(owned.map(item => item.id))
    return
  }

  const expected = active && active.status !== 'paused' && !active.targetAcknowledged && typeof active.targetMinutes === 'number'
    && active.targetMinutes * 60 > activeSessionSeconds(active, nowMs) ? active : null
  const expectedId = expected ? timerId(expected) : null
  const staleIds = owned.filter(item => item.id !== expectedId).map(item => item.id)
  await cancelIds(staleIds)
  if (!expected || expectedId === null) return

  const current = owned.find(item => item.id === expectedId)
  const exact = await exactAlarmEnabled()
  const remainingSeconds = expected.targetMinutes! * 60 - activeSessionSeconds(expected, nowMs)
  const expectedAt = nowMs + remainingSeconds * 1000
  const currentExtra = current?.extra as { exact?: unknown } | undefined
  const currentAt = current ? pendingAt(current) : null
  if (current && currentAt !== null && Math.abs(currentAt - expectedAt) < 1500 && currentExtra?.exact === exact) return
  if (current) await cancelIds([expectedId])
  await scheduleTimeflowNotification(expected, activeSessionSeconds(expected, nowMs), { nowMs })
}

export async function reconcilePlannedBlockReminders(nowMs = Date.now(), options: NotificationScheduleOptions = {}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await migrateLegacyLocalStorage()
  const [blocks, pending] = await Promise.all([db.plannedBlocks.toArray(), pendingNotifications()])
  const expected = plannerOccurrences(blocks, nowMs)
  const expectedById = new Map(expected.map(item => [plannedReminderNotificationId(item.block.id), item]))
  const owned = pending.filter(isOwnedPlannerReminder)
  await cancelIds(owned.filter(item => !expectedById.has(item.id)).map(item => item.id))

  for (const occurrence of expected) {
    const id = plannedReminderNotificationId(occurrence.block.id)
    const current = owned.find(item => item.id === id)
    const currentExtra = current?.extra as { reminderAt?: unknown } | undefined
    const currentScheduleAt = current ? pendingAt(current) : null
    if (current && currentScheduleAt !== null && Math.abs(currentScheduleAt - occurrence.reminderAt) < 1500 && currentExtra?.reminderAt === occurrence.reminderAt) continue
    if (current) await cancelIds([id])
    await schedulePlannedBlockReminder(occurrence.block, { nowMs: nowMs - 1, requestPermission: options.requestPermission })
  }
}

export async function reconcileAllNotifications(nowMs = Date.now()): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await ensureNotificationChannels()
    await Promise.all([reconcileTimeflowNotifications(undefined, nowMs), reconcilePlannedBlockReminders(nowMs)])
    dispatchStatusChanged()
  } catch {
    // Reconciliation is repair work. A transient native failure must not affect
    // the persisted timer or planner records.
  }
}

export function notificationRouteForTap(action: Pick<ActionPerformed, 'notification'> | { notification?: { extra?: unknown; data?: unknown } }): string | null {
  const notification = action.notification as { extra?: unknown; data?: unknown } | undefined
  const extra = notification?.extra && typeof notification.extra === 'object' ? notification.extra as Record<string, unknown> : notification?.data && typeof notification.data === 'object' ? notification.data as Record<string, unknown> : null
  if (!extra || extra.owner !== OWNER) return null
  if (extra.kind === 'timeflow-milestone' || extra.kind === 'pomodoro-milestone') return '#/today'
  if (extra.kind === 'planner-reminder' && typeof extra.occurrenceDate === 'string' && typeof extra.occurrenceId === 'string') {
    return `#/planner?view=day&date=${encodeURIComponent(extra.occurrenceDate)}&block=${encodeURIComponent(extra.occurrenceId)}`
  }
  return null
}

let listenerHandle: PluginListenerHandle | null = null
let listenerPromise: Promise<PluginListenerHandle> | null = null
let tapHandler: ((route: string) => void) | null = null
let listenerRefs = 0

async function ensureTapListener(): Promise<void> {
  if (!Capacitor.isNativePlatform() || listenerHandle) return
  if (!listenerPromise) {
    listenerPromise = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const route = notificationRouteForTap(action)
      if (route) tapHandler?.(route)
    }).then((handle) => {
      listenerHandle = handle
      listenerPromise = null
      if (listenerRefs === 0) {
        void handle.remove()
        listenerHandle = null
      }
      return handle
    })
  }
  await listenerPromise
}

export async function initializeNotifications(onRoute: (route: string) => void): Promise<NotificationInitialization> {
  tapHandler = onRoute
  if (!Capacitor.isNativePlatform()) return { dispose: async () => { if (tapHandler === onRoute) tapHandler = null } }
  listenerRefs += 1
  await ensureTapListener()
  await ensureNotificationChannels().catch(() => undefined)
  await getNotificationCapability().catch(() => undefined)
  await reconcileAllNotifications()
  return {
    dispose: async () => {
      if (tapHandler === onRoute) tapHandler = null
      listenerRefs = Math.max(0, listenerRefs - 1)
      if (listenerRefs === 0 && listenerHandle) {
        const handle = listenerHandle
        listenerHandle = null
        await handle.remove()
      }
    },
  }
}

export async function scheduleTestNotification(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  let permitted = false
  try {
    permitted = await notificationPermission(true)
  } catch {
    return false
  }
  if (!permitted) return false
  await cancelIds([testNotificationId()])
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: testNotificationId(),
        title: 'Hora test alert',
        body: 'Notifications are working on this device.',
        channelId: notificationChannels.timer,
        smallIcon: 'ic_stat_hora',
        iconColor: '#D92F6F',
        autoCancel: true,
        schedule: { at: new Date(Date.now() + 4_000), allowWhileIdle: true },
        isExactNotification: false,
        extra: { owner: OWNER, kind: 'test', route: '#/settings' },
      }],
    })
    return true
  } catch {
    return false
  }
}

export const __notificationInternals = {
  plannerOccurrences,
  reminderAt,
  isOwnedTimer,
  isOwnedPlannerReminder,
}
