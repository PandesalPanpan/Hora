import type { Activity } from '../timer/types'

export type ActivityGroup = 'Focus' | 'Leisure' | 'Others' | 'Rest'

export const activityGroups: Record<ActivityGroup, Activity[]> = {
  Focus: [
    { id: 'study', name: 'Study', color: '#d92f6f' },
    { id: 'work', name: 'Work', color: '#dda1aa' },
    { id: 'self-study', name: 'Self-study', color: '#f5c8b8' },
    { id: 'custom', name: 'Custom', color: '#cfd2d2' },
  ],
  Leisure: [
    { id: 'reading', name: 'Reading', color: '#d92f6f' },
    { id: 'games', name: 'Games', color: '#dda1aa' },
    { id: 'music', name: 'Music', color: '#f5c8b8' },
  ],
  Others: [
    { id: 'exercise', name: 'Exercise', color: '#ff8b45' },
    { id: 'errands', name: 'Errands', color: '#dda1aa' },
  ],
  Rest: [
    { id: 'break', name: 'Break', color: '#4d862a' },
    { id: 'sleep', name: 'Sleep', color: '#91bd78' },
  ],
}

export const categoryColors: Record<ActivityGroup, string> = {
  Focus: '#915449',
  Leisure: '#d92f6f',
  Others: '#ff8b45',
  Rest: '#4d862a',
}

