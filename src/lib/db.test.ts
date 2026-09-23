import { describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { db, loadDatabaseState, migrateLegacyLocalStorage, replaceDatabaseState } from './db'
import { withSyncSuppressed } from '../features/sync/hooks'

describe('local database migration', () => {
  it('moves legacy sessions, plans, and tasks into IndexedDB', async () => {
    localStorage.setItem('iza.completed-sessions.v1', JSON.stringify([{ id: 'session-1', activity: { id: 'study', name: 'Study', color: '#d92f6f' }, startedAt: '2026-09-12T06:00:00.000Z', finishedAt: '2026-09-12T06:30:00.000Z' }]))
    localStorage.setItem('iza.planned-blocks.v1', JSON.stringify([{ id: 'plan-1', title: 'Study', category: 'Focus', color: '#d92f6f', startedAt: '2026-09-12T06:00:00.000Z', finishedAt: '2026-09-12T07:00:00.000Z' }]))
    localStorage.setItem('iza.tasks.v1', JSON.stringify([{ id: 'task-1', title: 'Read chapter', estimateMinutes: 25, completed: false }]))

    await migrateLegacyLocalStorage()
    const state = await loadDatabaseState()

    expect(state.completed).toHaveLength(1)
    expect(state.planned).toHaveLength(1)
    expect(state.tasks).toHaveLength(1)
    expect(await db.meta.get('local-storage-v1-migrated')).toBeTruthy()
  })

  it('does not overwrite an existing planned title from a stale legacy snapshot', async () => {
    localStorage.setItem('iza.planned-blocks.v1', JSON.stringify([{ id: 'plan-1', title: 'Study', category: 'Focus', color: '#d92f6f', startedAt: '2026-09-12T06:00:00.000Z', finishedAt: '2026-09-12T07:00:00.000Z' }]))
    await db.plannedBlocks.put({ id:'plan-1',title:'Biology Class',category:'Focus',color:'#22C55E',startedAt:'2026-09-12T06:00:00.000Z',finishedAt:'2026-09-12T07:00:00.000Z' })

    await migrateLegacyLocalStorage()

    expect(await db.plannedBlocks.get('plan-1')).toMatchObject({ title:'Biology Class',color:'#22C55E' })
  })

  it('normalizes legacy Activity colors without changing planned titles on upgrade', async () => {
    await db.close()
    await db.delete()
    const legacy = new Dexie('iza-time-tracker')
    legacy.version(5).stores({
      sessions: '&id,ownerId,status,startedAt,finishedAt,activity.id,taskId,plannedBlockId,updatedAt',
      plannedBlocks: '&id,ownerId,startedAt,finishedAt,taskId,activityId,recurrenceSeriesId,occurrenceDate,updatedAt',
      tasks: '&id,ownerId,completed,completedAt,priorityOrder,updatedAt',
      activities: '&id,&normalizedName,ownerId,category,archived,order,updatedAt',
      meta: '&key',
      outbox: '&id,ownerId,status,nextAttemptAt,entityType,entityId,updatedAt',
      syncTombstones: '&id,ownerId,entityType,entityId,updatedAt,deletedAt',
    })
    await legacy.open()
    await legacy.table('activities').put({id:'study',name:'Study',normalizedName:'study',category:'Focus',color:'#d92f6f',archived:false,order:0})
    await legacy.table('plannedBlocks').put({id:'plan',activityId:'study',title:'Biology Class',category:'Focus',color:'#d92f6f',startedAt:'2026-09-12T06:00:00.000Z',finishedAt:'2026-09-12T07:00:00.000Z'})
    legacy.close()

    await withSyncSuppressed(() => db.open())
    expect((await db.activities.get('study'))?.color).toBe('#D92F6F')
    expect((await db.plannedBlocks.get('plan'))?.title).toBe('Biology Class')
  })

  it('normalizes restored Activity colors and preserves planned-block titles', async () => {
    await replaceDatabaseState({
      sessions: [],
      plannedBlocks: [{ id:'plan',activityId:'study',title:'Biology Class',category:'Focus',color:'#d92f6f',startedAt:'2026-09-12T06:00:00.000Z',finishedAt:'2026-09-12T07:00:00.000Z' }],
      tasks: [],
      activities: [{ id:'study',name:'Study',normalizedName:'study',category:'Focus',color:'#a3f',archived:false,order:0,createdAt:'2026-09-12T05:00:00.000Z',updatedAt:'2026-09-12T05:00:00.000Z' }],
    })
    expect((await db.activities.get('study'))?.color).toBe('#AA33FF')
    expect((await db.plannedBlocks.get('plan'))?.title).toBe('Biology Class')
  })
})
