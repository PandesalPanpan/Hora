import type { CompletedSession } from '../features/timer/types'

export function elapsedSeconds(startedAt: string, now: Date | number = Date.now()): number {
  const nowMs = typeof now === 'number' ? now : now.getTime()
  return Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000))
}

export function sessionSeconds(session: CompletedSession): number {
  return elapsedSeconds(session.startedAt, new Date(session.finishedAt))
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
