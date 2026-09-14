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
}

export type CompletedSession = ActiveSession & {
  finishedAt: string
  note?: string
  mood?: 'calm' | 'focused' | 'tired'
}
