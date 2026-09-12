export type Activity = {
  id: string
  name: string
  color: string
}

export type ActiveSession = {
  id: string
  activity: Activity
  startedAt: string
}

export type CompletedSession = ActiveSession & {
  finishedAt: string
}
