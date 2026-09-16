export type Activity = {
  id: string
  name: string
  color: string
  category?: 'Focus' | 'Leisure' | 'Life' | 'Rest'
}

export type ActiveSession = {
  id: string
  activity: Activity
  startedAt: string
  targetMinutes?: number | null
  status?: 'running' | 'paused' | 'completed'
  pausedAt?: string | null
  pausedSeconds?: number
  taskId?: string
  taskTitleSnapshot?: string
  plannedBlockId?: string
  timerMode?: 'flowtime' | 'pomodoro'
  targetAcknowledged?: boolean
  note?: string
  pomodoro?: {
    phase: 'focus' | 'break'
    round: number
    focusMinutes: number
    breakMinutes: number
    totalRounds?: number
    focusActivity: Activity
  }
}

export type CompletedSession = ActiveSession & {
  finishedAt: string
  mood?: 'calm' | 'focused' | 'tired'
}
