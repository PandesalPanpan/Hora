import type { SyncMetadata } from '../../lib/syncTypes'

export type PlannerCategory = 'Focus' | 'Leisure' | 'Others' | 'Rest'

export type PlannedBlock = {
  id: string
  /** Empty means the linked Activity name is shown as a presentation fallback. */
  title: string
  note?: string
  category: PlannerCategory
  color: string
  startedAt: string
  finishedAt: string
  /** Minutes before the occurrence start; absent/null means no reminder. */
  reminderMinutesBefore?: number | null
  taskId?: string
  activityId?: string
  recurrenceSeriesId?: string
  recurrence?: {
    frequency: 'daily' | 'weekdays'
    weekdays?: number[]
    endsOn: string
  }
  excludedDates?: string[]
  occurrenceDate?: string
  detachedFromSeries?: boolean
} & SyncMetadata
