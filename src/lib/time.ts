import type { ActiveSession, CompletedSession } from '../features/timer/types'

export function elapsedSeconds(startedAt: string, now: Date | number = Date.now()): number {
  const nowMs = typeof now === 'number' ? now : now.getTime()
  return Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000))
}

export function sessionSeconds(session: CompletedSession): number {
  return Math.max(0, elapsedSeconds(session.startedAt, new Date(session.finishedAt)) - (session.pausedSeconds ?? 0))
}

export function activeSessionSeconds(session: ActiveSession, now: Date | number = Date.now()): number {
  const nowMs = typeof now === 'number' ? now : now.getTime()
  const pauseStarted = session.pausedAt ? new Date(session.pausedAt).getTime() : null
  const currentPause = pauseStarted ? Math.max(0, Math.floor((nowMs - pauseStarted) / 1000)) : 0
  return Math.max(0, elapsedSeconds(session.startedAt, nowMs) - (session.pausedSeconds ?? 0) - currentPause)
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatCompactDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${totalSeconds}s`
}

export function isSameLocalDay(date: string, reference = new Date()): boolean {
  const value = new Date(date)
  return value.getFullYear() === reference.getFullYear()
    && value.getMonth() === reference.getMonth()
    && value.getDate() === reference.getDate()
}
