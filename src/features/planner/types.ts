export type PlannerCategory = 'Focus' | 'Leisure' | 'Others' | 'Rest'

export type PlannedBlock = {
  id: string
  title: string
  note?: string
  category: PlannerCategory
  color: string
  startedAt: string
  finishedAt: string
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
}
