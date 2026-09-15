import { describe, expect, it } from 'vitest'
import { localDateKey, reportWeek, startOfLocalWeek } from './period'

describe('report periods', () => {
  it('starts local weeks on Monday and leaves empty days at zero', () => {
    const start = startOfLocalWeek(new Date(2026, 8, 17, 12))
    expect(start.getDay()).toBe(1); expect(localDateKey(start)).toBe('2026-09-14')
    expect(reportWeek([], [], start).actualByDay).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})
