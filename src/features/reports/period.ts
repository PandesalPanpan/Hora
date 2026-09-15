import type { PlannedBlock } from '../planner/types'
import type { CompletedSession } from '../timer/types'
import { sessionSeconds } from '../../lib/time'

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function startOfLocalWeek(date: Date) { const result = new Date(date); result.setHours(0, 0, 0, 0); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result }
export function reportWeek(completed: CompletedSession[], planned: PlannedBlock[], weekStart: Date) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); return date })
  const keys = new Set(days.map(localDateKey))
  const sessions = completed.filter((item) => keys.has(localDateKey(new Date(item.startedAt))))
  const blocks = planned.filter((item) => keys.has(localDateKey(new Date(item.startedAt))))
  const actualByDay = days.map((day) => sessions.filter((item) => localDateKey(new Date(item.startedAt)) === localDateKey(day)).reduce((sum, item) => sum + sessionSeconds(item), 0))
  const plannedByDay = days.map((day) => blocks.filter((item) => localDateKey(new Date(item.startedAt)) === localDateKey(day)).reduce((sum, item) => sum + Math.max(0, (new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime()) / 1000), 0))
  return { days, sessions, blocks, actualByDay, plannedByDay, actualTotal: actualByDay.reduce((a, b) => a + b, 0), plannedTotal: plannedByDay.reduce((a, b) => a + b, 0) }
}
