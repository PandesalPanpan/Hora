import { describe, expect, it } from 'vitest'
import { expandRecurringBlock } from './recurrence'

describe('planned block recurrence', () => {
  it('includes the end date for daily recurrence', () => {
    const blocks = expandRecurringBlock({ id: 'one', title: 'Study', category: 'Focus', color: '#d92f6f', startedAt: '2026-09-14T01:00:00.000Z', finishedAt: '2026-09-14T02:00:00.000Z', recurrence: { frequency: 'daily', endsOn: '2026-09-16' } })
    expect(blocks).toHaveLength(3)
  })
  it('expands only selected weekdays', () => {
    const blocks = expandRecurringBlock({ id: 'one', title: 'Study', category: 'Focus', color: '#d92f6f', startedAt: '2026-09-14T01:00:00.000Z', finishedAt: '2026-09-14T02:00:00.000Z', recurrence: { frequency: 'weekdays', weekdays: [1, 3], endsOn: '2026-09-20' } })
    expect(blocks.map((block) => new Date(block.startedAt).getDay())).toEqual([1, 3])
  })
})
