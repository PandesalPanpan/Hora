import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db'
import { setCurrentOwnerId, userOwnerId } from '../../lib/ownership'
import { getSyncStatus } from './status'
import { syncKey, type CloudEnvelope } from './schema'

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  getFirebaseFirestore: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  onSnapshot: mocks.onSnapshot,
  setDoc: mocks.setDoc,
}))

vi.mock('../../lib/firebase', () => ({
  getFirebaseFirestore: mocks.getFirebaseFirestore,
}))

import { startCloudSync, stopCloudSync } from './engine'

const remoteDocs = new Map<string, CloudEnvelope>()

function envelope(overrides: Partial<CloudEnvelope> = {}): CloudEnvelope {
  return {
    schemaVersion: 1,
    recordType: 'tasks',
    id: 'remote-task',
    ownerId: 'alice',
    deviceId: 'remote-device',
    createdAt: '2026-09-22T08:00:00.000Z',
    updatedAt: '2026-09-22T08:05:00.000Z',
    deletedAt: null,
    payload: { title: 'Remote task', completed: false },
    ...overrides,
  }
}

async function waitFor(assertion: () => Promise<void>) {
  await vi.waitFor(assertion, { timeout: 1_500, interval: 10 })
}

describe('Firestore sync engine', () => {
  beforeEach(() => {
    remoteDocs.clear()
    setCurrentOwnerId(userOwnerId('alice'))
    mocks.collection.mockImplementation((_firestore: unknown, ...path: string[]) => ({ path: path.join('/') }))
    mocks.doc.mockImplementation((_firestore: unknown, ...path: string[]) => ({ path: path.join('/') }))
    mocks.getFirebaseFirestore.mockReturnValue({})
    mocks.getDoc.mockResolvedValue({ exists: () => false })
    mocks.getDocs.mockImplementation(async (reference: { path: string }) => {
      const remote = remoteDocs.get(reference.path)
      return { docs: remote ? [{ data: () => remote }] : [] }
    })
    mocks.onSnapshot.mockReturnValue(() => undefined)
    mocks.setDoc.mockResolvedValue(undefined)
    vi.clearAllMocks()
  })

  afterEach(() => {
    stopCloudSync()
  })

  it('imports a remote-only record during initial sync', async () => {
    remoteDocs.set('users/alice/tasks', envelope())
    startCloudSync('alice')

    await waitFor(async () => expect(await db.tasks.get('remote-task')).toMatchObject({
      ownerId: userOwnerId('alice'),
      title: 'Remote task',
      deletedAt: null,
    }))

    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it('uploads a local outbox record and marks it synced', async () => {
    await db.tasks.put({ id: 'local-task', title: 'Local task', completed: false })
    const key = syncKey(userOwnerId('alice'), 'tasks', 'local-task')
    await waitFor(async () => expect(await db.outbox.get(key)).toBeDefined())

    startCloudSync('alice')
    await waitFor(async () => {
      expect((await db.outbox.get(key))?.status).toBe('synced')
      expect(getSyncStatus().phase).toBe('synced')
    })

    expect(mocks.setDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/alice/tasks/local-task' }), expect.objectContaining({ id: 'local-task', recordType: 'tasks' }))
  })

  it('applies the newer remote version and does not overwrite it with stale local data', async () => {
    await db.tasks.put({
      id: 'remote-task',
      title: 'Stale local task',
      completed: false,
      ownerId: userOwnerId('alice'),
      deviceId: 'local-device',
      createdAt: '2026-09-22T08:00:00.000Z',
      updatedAt: '2026-09-22T08:01:00.000Z',
      deletedAt: null,
      syncSchemaVersion: 1,
    })
    remoteDocs.set('users/alice/tasks', envelope({ updatedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }))
    startCloudSync('alice')

    await waitFor(async () => {
      expect(await db.tasks.get('remote-task')).toMatchObject({ title: 'Remote task' })
      expect(getSyncStatus().phase).toBe('synced')
    })
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it('retains a failed outbox entry for retry when Firestore rejects the write', async () => {
    await db.tasks.put({ id: 'local-task', title: 'Local task', completed: false })
    const key = syncKey(userOwnerId('alice'), 'tasks', 'local-task')
    await waitFor(async () => expect(await db.outbox.get(key)).toBeDefined())
    mocks.setDoc.mockRejectedValue(new Error('network down'))

    startCloudSync('alice')
    await waitFor(async () => {
      expect((await db.outbox.get(key))?.status).toBe('failed')
      expect(getSyncStatus().phase).toBe('error')
    })

    const failed = await db.outbox.get(key)
    expect(failed?.attempts).toBe(1)
    expect(failed?.nextAttemptAt).toBeGreaterThan(Date.now())
  })
})
