export type Activity = {
  id: string
  name: string
  color: string
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
  plannedBlockId?: string
  timerMode?: 'flowtime' | 'pomodoro'
  targetAcknowledged?: boolean
  pomodoro?: {
    phase: 'focus' | 'break'
    round: number
    focusMinutes: number
    breakMinutes: number
    focusActivity: Activity
  }
}

export type CompletedSession = ActiveSession & {
  finishedAt: string
  note?: string
  mood?: 'calm' | 'focused' | 'tired'
}
