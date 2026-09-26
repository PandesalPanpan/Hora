import { describe, expect, it, vi } from 'vitest'
import type { ActiveSession, CompletedSession } from '../features/timer/types'
import { db, loadDatabaseState, replaceDatabaseState } from './db'
import { localStore } from './localStore'
import { getCurrentOwnerId } from './ownership'
import { syncKey } from '../features/sync/schema'

const completedSession: CompletedSession = {
  id: 'feeling-session',
  activity: { id: 'study', name: 'Study', color: '#b92f60' },
  status: 'completed',
  startedAt: '2026-09-12T06:00:00.000Z',
  finishedAt: '2026-09-12T06:30:00.000Z',
}

describe('completed session feelings', () => {
  it('persists and reloads an active timer goal from the canonical session record', async () => {
    const active: ActiveSession = {
      id: 'active-goal-session',
      activity: { id: 'study', name: 'Study', color: '#b92f60' },
      status: 'running',
      startedAt: '2026-09-12T06:00:00.000Z',
      targetMinutes: 30,
    }
    localStore.setActive(active)

    await vi.waitFor(async () => expect(await db.sessions.get(active.id)).toMatchObject({ status: 'running', targetMinutes: 30 }))
    const reloaded = await localStore.hydrate()
    expect(reloaded.active).toMatchObject({ id: active.id, targetMinutes: 30 })
  })

  it('persists edits locally, restores them from IndexedDB, and updates the session outbox', async () => {
    localStore.addCompleted(completedSession)
    await vi.waitFor(async () => expect(await db.sessions.get(completedSession.id)).toMatchObject({ status: 'completed' }))

    await localStore.updateCompleted(completedSession.id, { mood: 'focused' })
    const ownerId = getCurrentOwnerId()
    const outboxId = syncKey(ownerId, 'sessions', completedSession.id)
    expect(await db.sessions.get(completedSession.id)).toMatchObject({ mood: 'focused', ownerId })
    expect((await db.outbox.get(outboxId))?.envelope.payload).toMatchObject({ mood: 'focused' })

    // Clearing the browser cache simulates a reload; IndexedDB remains the source.
    localStorage.clear()
    const reloaded = await localStore.hydrate()
    expect(reloaded.completed[0]).toMatchObject({ id: completedSession.id, mood: 'focused' })
    expect(localStore.getCompleted()[0]).toMatchObject({ id: completedSession.id, mood: 'focused' })

    await localStore.updateCompleted(completedSession.id, { mood: 'calm' })
    expect(await db.sessions.get(completedSession.id)).toMatchObject({ mood: 'calm' })
    expect((await db.outbox.get(outboxId))?.envelope.payload).toMatchObject({ mood: 'calm' })

    await localStore.updateCompleted(completedSession.id, { mood: undefined })
    expect((await db.sessions.get(completedSession.id))?.mood).toBeUndefined()
    expect((await db.outbox.get(outboxId))?.envelope.payload).not.toHaveProperty('mood')
  })

  it('keeps a session feeling through the database replacement used by backup restore', async () => {
    const backedUp = { ...completedSession, mood: 'focused' as const }
    await db.sessions.put(backedUp)
    const sessions = JSON.parse(JSON.stringify([await db.sessions.get(backedUp.id)])) as CompletedSession[]

    await replaceDatabaseState({ sessions, plannedBlocks: [], tasks: [] })

    expect((await loadDatabaseState()).completed[0]).toMatchObject({ id: backedUp.id, mood: 'focused' })
  })
})
