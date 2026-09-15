import { describe, expect, it } from 'vitest'
import { db, loadDatabaseState, migrateLegacyLocalStorage } from './db'

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
})
