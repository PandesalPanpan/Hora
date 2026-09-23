import { expect, it, vi } from 'vitest'
import { db } from '../../lib/db'
import { ensureActivities, moveActivity, saveActivity, reorderActivities } from './repository'
import type { ActivityPreset } from './types'
import { getCurrentOwnerId } from '../../lib/ownership'
import { deserializeFromCloud, syncKey } from '../sync/schema'
import type { PlannedBlock } from '../planner/types'
const preset: ActivityPreset = {id:'drawing',name:'Drawing',normalizedName:'drawing',category:'Leisure',color:'#b92f60',archived:false,order:0,createdAt:'2026-01-01',updatedAt:'2026-01-01'}
it('seeds fresh databases once and retains edits', async () => { await ensureActivities(); const count = await db.activities.count(); expect(count).toBeGreaterThan(5); await db.activities.update('study',{name:'Study renamed'}); await ensureActivities(); expect(await db.activities.count()).toBe(count); expect((await db.activities.get('study'))?.name).toBe('Study renamed') })
it('enforces normalized uniqueness including archives and restores the same ID', async () => {
  await saveActivity({...preset,archived:true})
  await expect(saveActivity({...preset,id:'duplicate',name:' DRAWING '})).rejects.toThrow('Restore')
  await saveActivity(preset); expect((await db.activities.get(preset.id))?.archived).toBe(false)
  await expect(saveActivity({...preset,id:'duplicate',name:' drawing '})).rejects.toThrow('already')
})
it('updates linked records when requested without replacing custom planned titles', async () => {
  await saveActivity(preset)
  await db.sessions.bulkPut(['drawing','unrelated'].map(id => ({ id, activity:{id,name:'Drawing',color:preset.color},status:'completed' as const,startedAt:'2026-09-15T01:00:00Z',finishedAt:'2026-09-15T02:00:00Z' })))
  await db.plannedBlocks.bulkPut([
    {id:'plan-biology',activityId:'drawing',title:'Biology Class',category:'Leisure' as const,color:preset.color,startedAt:'2026-09-15T01:00:00Z',finishedAt:'2026-09-15T02:00:00Z'},
    {id:'plan-calculus',activityId:'drawing',title:'Review for Calculus Exam',category:'Leisure' as const,color:preset.color,startedAt:'2026-09-16T01:00:00Z',finishedAt:'2026-09-16T02:00:00Z'},
    {id:'plan-thesis',activityId:'drawing',title:'Thesis Research',category:'Leisure' as const,color:preset.color,startedAt:'2026-09-17T01:00:00Z',finishedAt:'2026-09-17T02:00:00Z'},
  ])
  await saveActivity({...preset,name:'Sketching'})
  expect((await db.sessions.get('drawing'))?.activity.name).toBe('Drawing')
  await saveActivity({...preset,name:'Sketching'},true)
  expect((await db.sessions.get('drawing'))?.activity.name).toBe('Sketching')
  expect((await db.sessions.get('unrelated'))?.activity.name).toBe('Drawing')
  expect(await db.plannedBlocks.orderBy('id').toArray()).toMatchObject([
    {id:'plan-biology',activityId:'drawing',title:'Biology Class',color:'#B92F60'},
    {id:'plan-calculus',activityId:'drawing',title:'Review for Calculus Exam',color:'#B92F60'},
    {id:'plan-thesis',activityId:'drawing',title:'Thesis Research',color:'#B92F60'},
  ])
  await db.outbox.clear()
  await saveActivity({...preset,name:'Sketching',color:'#22c55e'},true)
  expect((await db.activities.get('drawing'))?.color).toBe('#22C55E')
  expect(await db.plannedBlocks.orderBy('id').toArray()).toMatchObject([
    {id:'plan-biology',activityId:'drawing',title:'Biology Class',color:'#22C55E'},
    {id:'plan-calculus',activityId:'drawing',title:'Review for Calculus Exam',color:'#22C55E'},
    {id:'plan-thesis',activityId:'drawing',title:'Thesis Research',color:'#22C55E'},
  ])
  const ownerId = getCurrentOwnerId()
  const syncKeys = [
    syncKey(ownerId, 'activities', 'drawing'),
    syncKey(ownerId, 'sessions', 'drawing'),
    syncKey(ownerId, 'plannedBlocks', 'plan-biology'),
    syncKey(ownerId, 'plannedBlocks', 'plan-calculus'),
    syncKey(ownerId, 'plannedBlocks', 'plan-thesis'),
  ]
  await vi.waitFor(async () => expect(await Promise.all(syncKeys.map(key => db.outbox.get(key)))).toEqual(syncKeys.map(() => expect.objectContaining({status:'pending'}))))
  expect((await db.outbox.get(syncKeys[0]))?.envelope.payload).toMatchObject({color:'#22C55E',name:'Sketching'})
  expect((await db.outbox.get(syncKeys[2]))?.envelope.payload).toMatchObject({title:'Biology Class',color:'#22C55E'})
  expect(deserializeFromCloud<ActivityPreset>((await db.outbox.get(syncKeys[0]))!.envelope)).toMatchObject({color:'#22C55E',name:'Sketching'})
  expect(deserializeFromCloud<PlannedBlock>((await db.outbox.get(syncKeys[2]))!.envelope)).toMatchObject({title:'Biology Class',color:'#22C55E'})
})
it('normalizes valid colors on save and rejects invalid colors', async () => {
  await saveActivity({...preset,color:'22c55e'})
  expect((await db.activities.get('drawing'))?.color).toBe('#22C55E')
  await expect(saveActivity({...preset,color:'#GGGGGG'})).rejects.toThrow('valid HEX')
  expect((await db.activities.get('drawing'))?.color).toBe('#22C55E')
})
it('persists manual order and archive visibility', async () => { await saveActivity(preset); await saveActivity({...preset,id:'walk',name:'Walk'}); await reorderActivities(['walk','drawing']); expect((await db.activities.orderBy('order').toArray()).map(item => item.id)).toEqual(['walk','drawing']); await saveActivity({...preset,archived:true}); expect((await db.activities.toArray()).filter(item => !item.archived)).toHaveLength(1) })
it('moves across categories and updates linked records only with explicit scope', async () => {
  await saveActivity(preset)
  await db.sessions.put({id:'log',activity:{id:'drawing',name:'Drawing',color:preset.color,category:'Leisure'},status:'completed',startedAt:'2026-09-15T01:00:00Z',finishedAt:'2026-09-15T02:00:00Z'})
  await db.plannedBlocks.put({id:'plan',activityId:'drawing',title:'Drawing',category:'Leisure',color:preset.color,startedAt:'2026-09-15T01:00:00Z',finishedAt:'2026-09-15T02:00:00Z'})
  await moveActivity('drawing','Focus',0)
  expect((await db.activities.get('drawing'))?.category).toBe('Focus')
  expect((await db.sessions.get('log'))?.activity.category).toBe('Leisure')
  expect((await db.plannedBlocks.get('plan'))?.category).toBe('Leisure')
  await moveActivity('drawing','Rest',0,true)
  expect((await db.sessions.get('log'))?.activity.category).toBe('Rest')
  expect((await db.plannedBlocks.get('plan'))?.category).toBe('Rest')
})
