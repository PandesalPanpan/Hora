import { describe, expect, it } from 'vitest'
import { elapsedSeconds, formatDuration, sessionSeconds } from './time'

describe('time calculations', () => {
  it('calculates elapsed time from timestamps rather than ticks', () => {
    expect(elapsedSeconds('2026-09-12T06:00:00.000Z', new Date('2026-09-12T06:47:00.000Z'))).toBe(2820)
  })

  it('calculates a completed session duration', () => {
    expect(sessionSeconds({
      id: 'one',
      activity: { id: 'study', name: 'Study', color: '#000' },
      startedAt: '2026-09-12T06:00:00.000Z',
      finishedAt: '2026-09-12T06:30:05.000Z',
    })).toBe(1805)
  })

  it('formats stopwatch durations', () => {
    expect(formatDuration(65)).toBe('01:05')
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})
