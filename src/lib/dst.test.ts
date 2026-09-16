import { expect, it } from 'vitest'
import { parseLocalEdit, toLocalInput } from './completionTime'
import { expandRecurringBlock } from '../features/planner/recurrence'
const newYork = new Date(2026, 10, 1).getTimezoneOffset() === 240
it.runIf(newYork)('preserves the later DST fold instant and rejects nonexistent local minutes', () => {
  const original = '2026-11-01T06:30:37.123Z'
  expect(parseLocalEdit(toLocalInput(original),original)).toBe(original)
  expect(() => parseLocalEdit('2026-03-08T02:30',original)).toThrow('Invalid local time')
})
it.runIf(newYork)('recurs at the same local clock across spring DST and includes the end date', () => {
  const occurrences = expandRecurringBlock({id:'dst',title:'Study',category:'Focus',color:'#b92f60',startedAt:new Date(2026,2,7,9).toISOString(),finishedAt:new Date(2026,2,7,10).toISOString(),recurrence:{frequency:'daily',endsOn:'2026-03-09'}})
  expect(occurrences).toHaveLength(3)
  expect(occurrences.map(item => new Date(item.startedAt).getHours())).toEqual([9,9,9])
  expect(+new Date(occurrences[1].startedAt)-+new Date(occurrences[0].startedAt)).toBe(23*3600000)
})
