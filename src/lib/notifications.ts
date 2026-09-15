import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { ActiveSession } from '../features/timer/types'

function notificationId(sessionId: string): number {
  let value = 17
  for (const character of sessionId) value = ((value * 31) + character.charCodeAt(0)) | 0
  return Math.abs(value || 17)
}

export async function cancelMilestoneNotification(sessionId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId(sessionId) }] })
  } catch {
    // A missing or already-delivered notification needs no user-facing recovery.
  }
}

export async function scheduleMilestoneNotification(session: ActiveSession, elapsedSeconds = 0): Promise<void> {
  if (!Capacitor.isNativePlatform() || !session.targetMinutes || session.status === 'paused' || session.targetAcknowledged) return
  const remainingSeconds = Math.max(0, session.targetMinutes * 60 - elapsedSeconds)
  if (remainingSeconds === 0) return

  try {
    let permission = await LocalNotifications.checkPermissions()
    if (permission.display === 'prompt') permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') return

    await cancelMilestoneNotification(session.id)
    const isBreak = session.pomodoro?.phase === 'break'
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(session.id),
        title: isBreak ? 'Break complete' : `${session.activity.name} goal reached`,
        body: isBreak ? 'Ready for the next focus round?' : 'Keep going, or finish when you are ready.',
        schedule: { at: new Date(Date.now() + remainingSeconds * 1000) },
        // A milestone is guidance, not an automatic stop. Inexact delivery avoids
        // throwing the user into Android's special "Alarms & reminders" settings.
        isExactNotification: false,
        extra: { sessionId: session.id, route: '/today' },
      }],
    })
  } catch {
    // Tracking remains reliable even when the OS refuses notification scheduling.
  }
}
