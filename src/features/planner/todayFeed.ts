import type { ActiveSession, CompletedSession } from '../timer/types'
import type { PlannedBlock } from './types'
import { expandRecurringBlock } from './recurrence'
import { localDateKey } from '../reports/period'
import { sessionSeconds } from '../../lib/time'
import { plannedBlockDisplayColor, plannedBlockDisplayTitle, type PlannerActivityPresentation } from './presentation'

export type TodayRow = {
  id: string
  kind: 'Live' | 'Tracked' | 'Planned'
  title: string
  note?: string
  color: string
  startedAt: string
  durationSeconds?: number
  session?: CompletedSession
  destination: string
}

export function todayFeed(active: ActiveSession | null, completed: CompletedSession[], planned: PlannedBlock[], now = new Date(), limit = 3, activities: readonly PlannerActivityPresentation[] = []): TodayRow[] {
  const key = localDateKey(now)
  const dayRoute = `#/planner?view=day&date=${key}`
  const live: TodayRow[] = active ? [{ id: active.id, kind: 'Live', title: active.activity.name, note: active.note, color: active.activity.color, startedAt: active.startedAt, destination: '#/today' }] : []
  const tracked: TodayRow[] = completed.filter(item => localDateKey(new Date(item.startedAt)) === key).sort((a,b) => b.finishedAt.localeCompare(a.finishedAt)).map(session => ({ id: session.id, kind: 'Tracked', title: session.activity.name, note: session.note, color: session.activity.color, startedAt: session.startedAt, durationSeconds: sessionSeconds(session), session, destination: `#/history?date=${key}&session=${encodeURIComponent(session.id)}` }))
  const upcoming: TodayRow[] = planned.flatMap(expandRecurringBlock).filter(item => localDateKey(new Date(item.startedAt)) === key && +new Date(item.startedAt) >= +now).sort((a,b) => a.startedAt.localeCompare(b.startedAt)).map(item => ({ id: item.id, kind: 'Planned', title: plannedBlockDisplayTitle(item, activities), note: item.note, color: plannedBlockDisplayColor(item, activities), startedAt: item.startedAt, durationSeconds: Math.max(0, Math.round((+new Date(item.finishedAt) - +new Date(item.startedAt)) / 1000)), destination: `${dayRoute}&block=${encodeURIComponent(item.id)}` }))
  return [...live, ...tracked.slice(0, Math.max(0, limit - live.length - (upcoming.length ? 1 : 0))), ...upcoming.slice(0,1)].slice(0,limit)
}
