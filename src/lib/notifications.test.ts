import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveSession } from '../features/timer/types'
import { db } from './db'

const native = { value: true }
const permission = { value: 'granted' as 'granted' | 'denied' | 'prompt' }
const exact = { value: 'granted' as 'granted' | 'denied' }
const pending = { value: [] as Array<Record<string, unknown>> }
const scheduled = { value: [] as Array<Record<string, unknown>> }

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.value,
    getPlatform: () => 'android',
  },
  registerPlugin: vi.fn(() => null),
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(async () => ({ display: permission.value })),
    requestPermissions: vi.fn(async () => ({ display: permission.value })),
    checkExactNotificationSetting: vi.fn(async () => ({ exact_alarm: exact.value })),
    changeExactNotificationSetting: vi.fn(async () => ({ exact_alarm: exact.value })),
    createChannel: vi.fn(async () => undefined),
    getPending: vi.fn(async () => ({ notifications: pending.value })),
    cancel: vi.fn(async ({ notifications }: { notifications: Array<{ id: number }> }) => {
      const ids = new Set(notifications.map(item => item.id))
      pending.value = pending.value.filter(item => !ids.has(item.id as number))
    }),
    schedule: vi.fn(async ({ notifications }: { notifications: Array<Record<string, unknown>> }) => {
      scheduled.value.push(...notifications)
      pending.value.push(...notifications)
      return { notifications: notifications.map(item => ({ id: item.id })) }
    }),
    addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })),
  },
}))

const baseTime = new Date('2026-09-21T08:00:00.000Z').getTime()
const session = (overrides: Partial<ActiveSession> = {}): ActiveSession => ({
  id: 'session-1',
  activity: { id: 'study', name: 'Study', color: '#b92f60' },
  startedAt: new Date(baseTime).toISOString(),
  status: 'running',
  targetMinutes: 25,
  ...overrides,
})

describe('notification capability', () => {
  beforeEach(async () => {
    native.value = true
    permission.value = 'granted'
    exact.value = 'granted'
    pending.value = []
    scheduled.value = []
    await db.delete()
    await db.open()
    localStorage.clear()
  })

  it('creates deterministic signed IDs with category namespaces', async () => {
    const { stableNotificationId, plannedReminderNotificationId, pomodoroNotificationId, timeflowNotificationId } = await import('./notifications')
    expect(timeflowNotificationId('same')).toBe(timeflowNotificationId('same'))
    expect(timeflowNotificationId('same')).not.toBe(plannedReminderNotificationId('same'))
    expect(timeflowNotificationId('same')).not.toBe(pomodoroNotificationId('same'))
    expect(plannedReminderNotificationId('series:2026-09-21')).not.toBe(plannedReminderNotificationId('series:2026-09-22'))
    expect(stableNotificationId('test', 'x')).toBeGreaterThan(0)
    expect(stableNotificationId('test', 'x')).toBeLessThanOrEqual(2_147_483_647)
  })

  it('uses exact timer scheduling when precise alarms are available', async () => {
    const { scheduleTimeflowMilestone } = await import('./notifications')
    await scheduleTimeflowMilestone(session(), 0, { nowMs: baseTime })
    expect(scheduled.value.at(-1)).toMatchObject({
      isExactNotification: true,
      schedule: { allowWhileIdle: true, at: new Date(baseTime + 25 * 60_000) },
    })
  })

  it('falls back to inexact scheduling without blocking the timer', async () => {
    const { scheduleTimeflowMilestone } = await import('./notifications')
    exact.value = 'denied'
    expect(await scheduleTimeflowMilestone(session(), 0, { nowMs: baseTime })).toBe(true)
    expect(scheduled.value.at(-1)).toMatchObject({ isExactNotification: false })
  })

  it('does not schedule when notification permission is denied', async () => {
    const { scheduleTimeflowMilestone } = await import('./notifications')
    permission.value = 'denied'
    expect(await scheduleTimeflowMilestone(session(), 0, { nowMs: baseTime })).toBe(false)
    expect(scheduled.value).toHaveLength(0)
  })

  it('replaces a changed target and removes the old alarm when the target is removed or denied', async () => {
    const { scheduleTimeflowMilestone, timeflowNotificationId } = await import('./notifications')
    await scheduleTimeflowMilestone(session(), 0, { nowMs: baseTime })
    await scheduleTimeflowMilestone(session({ targetMinutes: 30 }), 0, { nowMs: baseTime })
    expect(pending.value).toHaveLength(1)
    expect(pending.value[0]).toMatchObject({ schedule: { at: new Date(baseTime + 30 * 60_000) } })

    await scheduleTimeflowMilestone(session({ targetMinutes: null }), 0, { nowMs: baseTime })
    expect(pending.value).toHaveLength(0)

    await scheduleTimeflowMilestone(session(), 0, { nowMs: baseTime })
    permission.value = 'denied'
    await scheduleTimeflowMilestone(session({ targetMinutes: 30 }), 0, { nowMs: baseTime })
    expect(pending.value.find(item => item.id === timeflowNotificationId('session-1'))).toBeUndefined()
  })

  it('cancels paused, completed, and already-reached timer milestones', async () => {
    const { scheduleTimeflowMilestone, timeflowNotificationId } = await import('./notifications')
    pending.value = [{ id: timeflowNotificationId('session-1'), extra: { owner: 'iza', kind: 'timeflow-milestone' } }]
    await scheduleTimeflowMilestone(session({ status: 'paused' }), 0, { nowMs: baseTime })
    expect(pending.value).toHaveLength(0)
    pending.value = [{ id: timeflowNotificationId('session-1'), extra: { owner: 'iza', kind: 'timeflow-milestone' } }]
    await scheduleTimeflowMilestone(session(), 25 * 60, { nowMs: baseTime })
    expect(pending.value).toHaveLength(0)
  })

  it('repairs a missing timer alarm, avoids duplicates, and removes stale alarms', async () => {
    const { reconcileTimeflowNotifications, timeflowNotificationId } = await import('./notifications')
    const running = session()
    await reconcileTimeflowNotifications(running, baseTime)
    expect(scheduled.value).toHaveLength(1)
    await reconcileTimeflowNotifications(running, baseTime)
    expect(scheduled.value).toHaveLength(1)
    await reconcileTimeflowNotifications(null, baseTime)
    expect(pending.value).toHaveLength(0)
    pending.value = [{ id: timeflowNotificationId('stale'), extra: { owner: 'iza', kind: 'timeflow-milestone' } }]
    await reconcileTimeflowNotifications(null, baseTime)
    expect(pending.value).toHaveLength(0)
  })

  it('reconciles recurring planner reminders inside a bounded future window', async () => {
    const { reconcilePlannedBlockReminders, plannedReminderNotificationId } = await import('./notifications')
    await db.plannedBlocks.put({
      id: 'series', title: 'Class', category: 'Focus', color: '#b92f60',
      startedAt: new Date(baseTime + DAY * 2).toISOString(),
      finishedAt: new Date(baseTime + DAY * 2 + 60 * 60_000).toISOString(),
      reminderMinutesBefore: 10,
      recurrence: { frequency: 'daily', endsOn: '2026-09-25' },
    })
    await reconcilePlannedBlockReminders(baseTime)
    expect(scheduled.value).toHaveLength(3)
    expect(new Set(scheduled.value.map(item => item.id)).size).toBe(3)
    expect(plannedReminderNotificationId('series:2026-09-23')).not.toBe(plannedReminderNotificationId('series:2026-09-24'))
  })

  it('uses an Activity name only as a reminder fallback and refreshes it after rename', async () => {
    const { reconcilePlannedBlockReminders } = await import('./notifications')
    await db.activities.put({
      id:'study',name:'Study',normalizedName:'study',category:'Focus',color:'#6366F1',archived:false,order:0,
      createdAt:new Date(baseTime).toISOString(),updatedAt:new Date(baseTime).toISOString(),
    })
    await db.plannedBlocks.put({
      id:'fallback-plan',activityId:'study',title:'',category:'Focus',color:'#B92F60',
      startedAt:new Date(baseTime + DAY * 2).toISOString(),
      finishedAt:new Date(baseTime + DAY * 2 + 60 * 60_000).toISOString(),
      reminderMinutesBefore:10,
    })

    await reconcilePlannedBlockReminders(baseTime)
    expect(scheduled.value.at(-1)?.title).toBe('Study')
    expect((await db.plannedBlocks.get('fallback-plan'))?.title).toBe('')

    await db.activities.update('study',{name:'Academics',normalizedName:'academics'})
    await reconcilePlannedBlockReminders(baseTime)
    expect(pending.value).toHaveLength(1)
    expect(pending.value[0].title).toBe('Academics')
    expect(scheduled.value).toHaveLength(2)
    expect((await db.plannedBlocks.get('fallback-plan'))?.title).toBe('')
  })

  it('routes typed timer and planner taps without changing timer state', async () => {
    const { notificationRouteForTap } = await import('./notifications')
    expect(notificationRouteForTap({ notification: { extra: { owner: 'iza', kind: 'timeflow-milestone' } } })).toBe('#/today')
    expect(notificationRouteForTap({ notification: { extra: { owner: 'iza', kind: 'pomodoro-milestone' } } })).toBe('#/today')
    expect(notificationRouteForTap({ notification: { extra: { owner: 'iza', kind: 'planner-reminder', occurrenceDate: '2026-09-23', occurrenceId: 'series:2026-09-23' } } })).toBe('#/planner?view=day&date=2026-09-23&block=series%3A2026-09-23')
    expect(notificationRouteForTap({ notification: { extra: { owner: 'other', kind: 'planner-reminder' } } })).toBeNull()
  })
})

const DAY = 24 * 60 * 60 * 1000
