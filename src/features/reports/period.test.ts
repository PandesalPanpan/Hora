import { describe, expect, it } from 'vitest'
import { localDateKey, reportWeek, startOfLocalWeek } from './period'

describe('report periods', () => {
  it('starts local weeks on Monday and leaves empty days at zero', () => {
    const start = startOfLocalWeek(new Date(2026, 8, 17, 12))
    expect(start.getDay()).toBe(1); expect(localDateKey(start)).toBe('2026-09-14')
    expect(reportWeek([], [], start).actualByDay).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
  it('counts only feelings attached to sessions in the selected week', () => {
    const start = new Date(2026, 8, 14, 12)
    const session = (id: string, day: number, mood?: 'calm' | 'focused' | 'tired') => ({
      id, activity: { id: 'study', name: 'Study', color: '#b92f60' }, status: 'completed' as const,
      startedAt: new Date(2026, 8, day, 9).toISOString(), finishedAt: new Date(2026, 8, day, 10).toISOString(), mood,
    })
    const sessions = [session('focused-1', 14, 'focused'), session('focused-2', 16, 'focused'), session('calm', 17, 'calm'), session('outside-week', 23, 'tired')]
    expect(reportWeek(sessions, [], start).moodCounts).toEqual({ calm: 1, focused: 2, tired: 0 })
  })
})
