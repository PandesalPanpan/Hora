import { describe, expect, it } from 'vitest'
import {
  deserializeFromCloud,
  isCloudEnvelope,
  serializeForCloud,
  serializeTombstone,
  versionCompare,
} from './schema'
import type { Task } from '../tasks/types'
import type { ActivityPreset } from '../activities/types'
import type { PlannedBlock } from '../planner/types'
import type { CompletedSession } from '../timer/types'

const task: Task = {
  id: 'task-1',
  title: 'Read chapter',
  description: undefined,
  completed: false,
  estimateMinutes: 25,
  ownerId: 'user:alice',
  deviceId: 'device-a',
  syncSchemaVersion: 1,
  createdAt: '2026-09-22T08:00:00.000Z',
  updatedAt: '2026-09-22T08:05:00.000Z',
  deletedAt: null,
}

describe('cloud sync schema boundary', () => {
  it('keeps ownership metadata in the envelope and restores remote records', () => {
    const envelope = serializeForCloud('tasks', task, 'user:alice', 'device-a')

    expect(envelope).toMatchObject({
      schemaVersion: 1,
      recordType: 'tasks',
      id: 'task-1',
      ownerId: 'alice',
      deviceId: 'device-a',
      deletedAt: null,
    })
    expect(envelope.payload).toEqual({ id: 'task-1', title: 'Read chapter', completed: false, estimateMinutes: 25 })
    expect(envelope.payload).not.toHaveProperty('ownerId')
    expect(envelope.payload).not.toHaveProperty('deviceId')
    expect(envelope.payload).not.toHaveProperty('description')

    expect(deserializeFromCloud<Task>(envelope)).toEqual({
      id: 'task-1',
      title: 'Read chapter',
      completed: false,
      estimateMinutes: 25,
      ownerId: 'alice',
      deviceId: 'device-a',
      syncSchemaVersion: 1,
      createdAt: '2026-09-22T08:00:00.000Z',
      updatedAt: '2026-09-22T08:05:00.000Z',
      deletedAt: null,
    })
  })

  it('uses timestamp first and device id as the deterministic tie breaker', () => {
    const older = { updatedAt: '2026-09-22T08:00:00.000Z', deviceId: 'device-z' }
    const newer = { updatedAt: '2026-09-22T08:01:00.000Z', deviceId: 'device-a' }
    const tieA = { updatedAt: '2026-09-22T08:01:00.000Z', deviceId: 'device-a' }
    const tieB = { updatedAt: '2026-09-22T08:01:00.000Z', deviceId: 'device-b' }

    expect(versionCompare(newer, older)).toBeGreaterThan(0)
    expect(versionCompare(tieB, tieA)).toBeGreaterThan(0)
    expect(versionCompare(tieA, tieA)).toBe(0)
  })

  it('represents deletion as a tombstone without a payload', () => {
    const tombstone = serializeTombstone('tasks', 'user:alice', 'task-1', 'device-a', '2026-09-22T08:10:00.000Z')

    expect(tombstone.deletedAt).toBe('2026-09-22T08:10:00.000Z')
    expect(tombstone.payload).toBeNull()
    expect(deserializeFromCloud(tombstone)).toBeNull()
    expect(isCloudEnvelope(tombstone)).toBe(true)
    expect(isCloudEnvelope({ ...tombstone, ownerId: undefined })).toBe(false)
  })

  it('normalizes Activity colors across cloud writes and reads while preserving planned titles', () => {
    const activity: ActivityPreset = {
      id:'study',name:'Study',normalizedName:'study',category:'Focus',color:'#22c55e',archived:false,order:0,
      ownerId:'user:alice',deviceId:'device-a',syncSchemaVersion:1,createdAt:'2026-09-22T08:00:00.000Z',updatedAt:'2026-09-22T08:05:00.000Z',deletedAt:null,
    }
    const activityEnvelope = serializeForCloud('activities',activity,'user:alice','device-a')
    expect(activityEnvelope.payload?.color).toBe('#22C55E')
    const legacyRemote = { ...activityEnvelope, payload: { ...activityEnvelope.payload, color:'#22c55e' } }
    expect(deserializeFromCloud<ActivityPreset>(legacyRemote)?.color).toBe('#22C55E')

    const plan: PlannedBlock = {
      id:'plan',activityId:'study',title:'Biology Class',category:'Focus',color:'#B92F60',
      startedAt:'2026-09-23T09:00:00.000Z',finishedAt:'2026-09-23T10:00:00.000Z',
    }
    const planEnvelope = serializeForCloud('plannedBlocks',plan,'user:alice','device-a')
    expect(deserializeFromCloud<PlannedBlock>(planEnvelope)?.title).toBe('Biology Class')
  })

  it('keeps a completed session feeling in the cloud payload and restored record', () => {
    const session: CompletedSession = {
      id: 'session-with-feeling',
      activity: { id: 'study', name: 'Study', color: '#b92f60' },
      status: 'completed',
      startedAt: '2026-09-22T08:00:00.000Z',
      finishedAt: '2026-09-22T08:30:00.000Z',
      mood: 'focused',
    }
    const envelope = serializeForCloud('sessions', session, 'user:alice', 'device-a')

    expect(envelope.payload).toMatchObject({ mood: 'focused' })
    expect(deserializeFromCloud<CompletedSession>(envelope)?.mood).toBe('focused')
  })
})
