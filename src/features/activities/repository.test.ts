import { expect, it } from 'vitest'
import { db } from '../../lib/db'
import { ensureActivities, moveActivity, saveActivity, reorderActivities } from './repository'
import type { ActivityPreset } from './types'
const preset: ActivityPreset = {id:'drawing',name:'Drawing',normalizedName:'drawing',category:'Leisure',color:'#b92f60',archived:false,order:0,createdAt:'2026-01-01',updatedAt:'2026-01-01'}
it('seeds fresh databases once and retains edits', async () => { await ensureActivities(); const count = await db.activities.count(); expect(count).toBeGreaterThan(5); await db.activities.update('study',{name:'Study renamed'}); await ensureActivities(); expect(await db.activities.count()).toBe(count); expect((await db.activities.get('study'))?.name).toBe('Study renamed') })
it('enforces normalized uniqueness including archives and restores the same ID', async () => {
  await saveActivity({...preset,archived:true})
  await expect(saveActivity({...preset,id:'duplicate',name:' DRAWING '})).rejects.toThrow('Restore')
  await saveActivity(preset); expect((await db.activities.get(preset.id))?.archived).toBe(false)
  await expect(saveActivity({...preset,id:'duplicate',name:' drawing '})).rejects.toThrow('already')
})
it('updates only linked historical records with explicit scope', async () => {
  await saveActivity(preset)
  await db.sessions.bulkPut(['drawing','unrelated'].map(id => ({ id, activity:{id,name:'Drawing',color:preset.color},status:'completed' as const,startedAt:'2026-09-15T01:00:00Z',finishedAt:'2026-09-15T02:00:00Z' })))
  await db.plannedBlocks.put({id:'plan',activityId:'drawing',title:'Drawing',category:'Leisure',color:preset.color,startedAt:'2026-09-15T01:00:00Z',finishedAt:'2026-09-15T02:00:00Z'})
  await saveActivity({...preset,name:'Sketching'})
  expect((await db.sessions.get('drawing'))?.activity.name).toBe('Drawing')
  await saveActivity({...preset,name:'Sketching'},true)
  expect((await db.sessions.get('drawing'))?.activity.name).toBe('Sketching'); expect((await db.sessions.get('unrelated'))?.activity.name).toBe('Drawing'); expect((await db.plannedBlocks.get('plan'))?.title).toBe('Sketching')
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
