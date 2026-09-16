import { expect, it } from 'vitest'
import { changeOccurrence, expandRecurringBlock } from './recurrence'
import type { PlannedBlock } from './types'
const block: PlannedBlock = {id:'series',title:'Study',category:'Focus',color:'#b92f60',startedAt:new Date(2026,8,14,9).toISOString(),finishedAt:new Date(2026,8,14,10).toISOString(),recurrence:{frequency:'daily',endsOn:'2026-09-17'}}
it('detaches one edit and suppresses its original occurrence', () => {
  const results = changeOccurrence(block,'2026-09-15','one',{title:'Exam'})
  expect(results.flatMap(expandRecurringBlock)).toHaveLength(4)
  expect(results[1]).toMatchObject({title:'Exam',detachedFromSeries:true,recurrence:undefined})
  expect(expandRecurringBlock(results[0]).some(item => item.occurrenceDate === '2026-09-15')).toBe(false)
})
it('deletes one occurrence or only the chosen date and future dates', () => {
  expect(changeOccurrence(block,'2026-09-15','one').flatMap(expandRecurringBlock)).toHaveLength(3)
  expect(changeOccurrence(block,'2026-09-15','future').flatMap(expandRecurringBlock)).toHaveLength(1)
})
it('splits forward while preserving past and local end clock', () => {
  const [past,future] = changeOccurrence(block,'2026-09-16','future',{title:'Revision'})
  expect(expandRecurringBlock(past).map(item => item.title)).toEqual(['Study','Study'])
  const occurrences = expandRecurringBlock(future)
  expect(occurrences).toHaveLength(2)
  expect(occurrences.every(item => new Date(item.finishedAt).getHours() === 10)).toBe(true)
  expect(occurrences.at(-1)?.occurrenceDate).toBe('2026-09-17')
})
