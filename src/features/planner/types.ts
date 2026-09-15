export type PlannerCategory = 'Focus' | 'Leisure' | 'Others' | 'Rest'

export type PlannedBlock = {
  id: string
  title: string
  category: PlannerCategory
  color: string
  startedAt: string
  finishedAt: string
  taskId?: string
}
