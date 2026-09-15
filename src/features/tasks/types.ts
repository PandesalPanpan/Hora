export type Task = {
  id: string
  title: string
  description?: string
  estimateMinutes?: number | null
  priorityOrder?: number
  completed: boolean
  completedAt?: string | null
  createdAt?: string
  updatedAt?: string
}
