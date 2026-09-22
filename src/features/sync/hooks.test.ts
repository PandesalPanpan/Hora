import { describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db'
import { getCurrentOwnerId, localOwnerId, userOwnerId, setCurrentOwnerId } from '../../lib/ownership'
import type { Task } from '../tasks/types'
import { syncKey } from './schema'

const task = (id = 'task-1', overrides: Partial<Task> = {}): Task => ({
  id,
  title: 'Read chapter',
  completed: false,
  ...overrides,
})

async function waitForOutbox(id: string) {
  await vi.waitFor(async () => {
    expect(await db.outbox.get(id)).toBeDefined()
  })
}

describe('Dexie sync hooks', () => {
  it('stamps direct writes and queues an outbox entry', async () => {
    const ownerId = localOwnerId()
    await db.tasks.put(task())
    const key = syncKey(ownerId, 'tasks', 'task-1')
    await waitForOutbox(key)

    const stored = await db.tasks.get('task-1')
    const entry = await db.outbox.get(key)
    expect(stored).toMatchObject({ ownerId, deviceId: expect.any(String), syncSchemaVersion: 1, deletedAt: null })
    expect(entry).toMatchObject({ id: key, ownerId, entityType: 'tasks', entityId: 'task-1', status: 'pending' })
    expect(entry?.envelope.payload).toMatchObject({ id: 'task-1', title: 'Read chapter' })
  })

  it('keeps bookkeeping in the same wider transaction and records tombstones', async () => {
    const ownerId = localOwnerId()
    const key = syncKey(ownerId, 'tasks', 'task-1')
    await db.transaction('rw', db.tasks, db.outbox, db.syncTombstones, async () => {
      await db.tasks.put(task())
      expect(await db.outbox.get(key)).toBeDefined()
    })

    await db.tasks.delete('task-1')
    await vi.waitFor(async () => {
      expect(await db.syncTombstones.get(key)).toBeDefined()
    })

    const tombstone = await db.syncTombstones.get(key)
    const entry = await db.outbox.get(key)
    expect(tombstone).toMatchObject({ ownerId, entityType: 'tasks', entityId: 'task-1', deletedAt: expect.any(String) })
    expect(entry?.envelope.deletedAt).toBe(tombstone?.deletedAt)
    expect(entry?.envelope.payload).toBeNull()
  })

  it('does not expose another account’s records through the owner index', async () => {
    const ownerA = userOwnerId('alice')
    const ownerB = userOwnerId('bob')
    setCurrentOwnerId(ownerA)
    await db.tasks.put(task('alice-task'))
    setCurrentOwnerId(ownerB)
    await db.tasks.put(task('bob-task'))

    expect(getCurrentOwnerId()).toBe(ownerB)
    expect(await db.tasks.where('ownerId').equals(ownerB).toArray()).toHaveLength(1)
    expect(await db.tasks.where('ownerId').equals(ownerA).toArray()).toHaveLength(1)
    expect(await db.tasks.get('alice-task')).toMatchObject({ ownerId: ownerA })
  })

  it('rejects direct writes that try to cross the active account boundary', async () => {
    const ownerA = userOwnerId('alice')
    const ownerB = userOwnerId('bob')
    setCurrentOwnerId(ownerA)
    await db.tasks.put(task('alice-task'))
    setCurrentOwnerId(ownerB)

    await expect(db.tasks.put({ ...task('cross-account'), ownerId: ownerA })).rejects.toThrow('another local account')
    await expect(db.tasks.delete('alice-task')).rejects.toThrow('another local account')
    expect(await db.tasks.get('alice-task')).toBeDefined()
  })
})
