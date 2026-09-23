import { expect, it } from 'vitest'
import { todayFeed } from './todayFeed'
import type { CompletedSession } from '../timer/types'
const now = new Date(2026,8,15,14)
const iso = (day: number,hour: number) => new Date(2026,8,day,hour).toISOString()
const session = (id: string,day: number,hour: number): CompletedSession => ({id,activity:{id:'study',name:'Study',color:'#b92f60'},status:'completed',startedAt:iso(day,hour),finishedAt:iso(day,hour+1),note:`Note for ${id}`})
it('keeps live, newest tracked and upcoming plan within the phone budget', () => {
  const feed = todayFeed({...session('live',15,13),status:'running'},[session('old',14,9),session('first',15,9),session('recent',15,11)],[{id:'plan',title:'Class',category:'Focus',color:'#b92f60',startedAt:iso(15,16),finishedAt:iso(15,17)}],now)
  expect(feed.map(row => [row.id,row.kind])).toEqual([['live','Live'],['recent','Tracked'],['plan','Planned']])
  expect(feed[0].destination).toBe('#/today'); expect(feed[1].destination).toContain('/history?date=2026-09-15&session=recent'); expect(feed[2].destination).toContain('/planner?view=day&date=2026-09-15&block=plan')
  expect(feed[1]).toMatchObject({ note: 'Note for recent', color: '#b92f60', durationSeconds: 3600 })
  expect(feed[2].durationSeconds).toBe(3600)
})
it('expands today recurrence and excludes past plans and other local days', () => {
  const plan = {id:'series',title:'Class',category:'Focus' as const,color:'#b92f60',startedAt:iso(14,16),finishedAt:iso(14,17),recurrence:{frequency:'daily' as const,endsOn:'2026-09-16'}}
  expect(todayFeed(null,[],[plan],now)[0].id).toBe('series:2026-09-15')
  expect(todayFeed(null,[],[plan],new Date(2026,8,15,18))).toEqual([])
})
it('shows an Activity name and current color for a blank-title planned block without saving the fallback', () => {
  const plan = {id:'fallback',title:'',activityId:'study',category:'Focus' as const,color:'#B92F60',startedAt:iso(15,16),finishedAt:iso(15,17)}
  const [row] = todayFeed(null,[],[plan],now,3,[{id:'study',name:'Study',color:'#22c55e'}])
  expect(row).toMatchObject({title:'Study',color:'#22C55E'})
  expect(plan.title).toBe('')
})
