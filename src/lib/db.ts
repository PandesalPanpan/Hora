import Dexie, { type EntityTable } from 'dexie'
import type { PlannedBlock } from '../features/planner/types'
import type { ActiveSession, CompletedSession } from '../features/timer/types'
import type { Task } from '../features/tasks/types'
import type { ActivityPreset } from '../features/activities/types'
import { activityGroups } from '../features/activities/catalog'
import { normalizeActivityName } from '../features/activities/types'
import { getCurrentOwnerId, getInstallationId } from './ownership'
import { registerSyncHooks, syncMetadata } from '../features/sync/hooks'
import type { OutboxEntry, SyncTombstone } from '../features/sync/schema'
import { normalizeHexColor } from '../features/activities/color'

export type StoredSession = ActiveSession & { finishedAt?: string }

type MetaRecord = { key: string; value: string }

class IzaDatabase extends Dexie {
  sessions!: EntityTable<StoredSession, 'id'>
  plannedBlocks!: EntityTable<PlannedBlock, 'id'>
  tasks!: EntityTable<Task, 'id'>
  activities!: EntityTable<ActivityPreset, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>
  outbox!: EntityTable<OutboxEntry, 'id'>
  syncTombstones!: EntityTable<SyncTombstone, 'id'>

  constructor() {
    super('iza-time-tracker')
    this.version(1).stores({
      sessions: '&id,status,startedAt,finishedAt,activity.id,taskId,plannedBlockId',
      plannedBlocks: '&id,startedAt,finishedAt,taskId',
      tasks: '&id,completed,updatedAt',
      meta: '&key',
    })
    this.version(2).stores({
      sessions: '&id,status,startedAt,finishedAt,activity.id,taskId,plannedBlockId',
      plannedBlocks: '&id,startedAt,finishedAt,taskId,activityId,recurrenceSeriesId,occurrenceDate',
      tasks: '&id,completed,completedAt,priorityOrder,updatedAt',
      activities: '&id,&normalizedName,category,archived,order',
      meta: '&key',
    }).upgrade(async (transaction) => {
      const tasks = transaction.table<Task>('tasks')
      const existing = await tasks.toArray()
      await Promise.all(existing.map((task, index) => tasks.put({
        ...task,
        estimateMinutes: task.estimateMinutes ?? null,
        priorityOrder: task.priorityOrder ?? index,
        completedAt: task.completed ? task.completedAt ?? task.updatedAt ?? new Date().toISOString() : null,
      })))
    })
    this.version(3).stores({
      sessions: '&id,status,startedAt,finishedAt,activity.id,taskId,plannedBlockId',
      plannedBlocks: '&id,startedAt,finishedAt,taskId,activityId,recurrenceSeriesId,occurrenceDate',
      tasks: '&id,completed,completedAt,priorityOrder,updatedAt',
      activities: '&id,&normalizedName,category,archived,order',
      meta: '&key',
    }).upgrade(async (transaction) => {
      const activities = transaction.table<ActivityPreset>('activities')
      const now = new Date().toISOString()
      const presets = Object.entries(activityGroups).flatMap(([category, items]) => items.filter((item) => item.id !== 'custom').map((item, order) => ({
        ...item, normalizedName: normalizeActivityName(item.name), category: category as ActivityPreset['category'], archived: false, order, builtIn: true, createdAt: now, updatedAt: now,
      })))
      await activities.bulkPut(presets)
    })
    this.version(4).stores({}).upgrade(async transaction => {
      const tasks = await transaction.table<Task>('tasks').toArray()
      const titles = new Map(tasks.map(task => [task.id, task.title]))
      await transaction.table<StoredSession>('sessions').toCollection().modify(session => {
        if (session.taskId && !session.taskTitleSnapshot) session.taskTitleSnapshot = titles.get(session.taskId) ?? session.activity.name
      })
    })
    this.version(5).stores({
      sessions: '&id,ownerId,status,startedAt,finishedAt,activity.id,taskId,plannedBlockId,updatedAt',
      plannedBlocks: '&id,ownerId,startedAt,finishedAt,taskId,activityId,recurrenceSeriesId,occurrenceDate,updatedAt',
      tasks: '&id,ownerId,completed,completedAt,priorityOrder,updatedAt',
      activities: '&id,&normalizedName,ownerId,category,archived,order,updatedAt',
      meta: '&key',
      outbox: '&id,ownerId,status,nextAttemptAt,entityType,entityId,updatedAt',
      syncTombstones: '&id,ownerId,entityType,entityId,updatedAt,deletedAt',
    }).upgrade(async transaction => {
      const ownerId = getCurrentOwnerId()
      const deviceId = getInstallationId()
      const now = new Date().toISOString()
      const sessions = transaction.table<StoredSession>('sessions')
      const plannedBlocks = transaction.table<PlannedBlock>('plannedBlocks')
      const tasks = transaction.table<Task>('tasks')
      const activities = transaction.table<ActivityPreset>('activities')
      await sessions.toCollection().modify(session => {
        const updatedAt = session.updatedAt ?? session.finishedAt ?? session.startedAt ?? now
        Object.assign(session, { ownerId: session.ownerId ?? ownerId, deviceId: session.deviceId ?? deviceId, syncSchemaVersion: 1, createdAt: session.createdAt ?? session.startedAt ?? updatedAt, updatedAt, deletedAt: session.deletedAt ?? null })
      })
      await plannedBlocks.toCollection().modify(block => {
        const updatedAt = block.updatedAt ?? block.finishedAt ?? block.startedAt ?? now
        Object.assign(block, { ownerId: block.ownerId ?? ownerId, deviceId: block.deviceId ?? deviceId, syncSchemaVersion: 1, createdAt: block.createdAt ?? block.startedAt ?? updatedAt, updatedAt, deletedAt: block.deletedAt ?? null })
      })
      await tasks.toCollection().modify(task => {
        const updatedAt = task.updatedAt ?? task.createdAt ?? now
        Object.assign(task, { ownerId: task.ownerId ?? ownerId, deviceId: task.deviceId ?? deviceId, syncSchemaVersion: 1, createdAt: task.createdAt ?? updatedAt, updatedAt, deletedAt: task.deletedAt ?? null })
      })
      await activities.toCollection().modify(activity => {
        const updatedAt = activity.updatedAt ?? activity.createdAt ?? now
        Object.assign(activity, { ownerId: activity.ownerId ?? ownerId, deviceId: activity.deviceId ?? deviceId, syncSchemaVersion: 1, createdAt: activity.createdAt ?? updatedAt, updatedAt, deletedAt: activity.deletedAt ?? null })
      })
    })
    this.version(6).stores({}).upgrade(async transaction => {
      await transaction.table<ActivityPreset>('activities').toCollection().modify(activity => {
        const color = normalizeHexColor(activity.color)
        if (color) activity.color = color
      })
    })

  }
}

export const db = new IzaDatabase()
registerSyncHooks(db)

const ACTIVE_KEY = 'iza.active-session.v1'
const COMPLETED_KEY = 'iza.completed-sessions.v1'
const PLANNER_KEY = 'iza.planned-blocks.v1'
const TASKS_KEY = 'iza.tasks.v1'
const MIGRATION_KEY = 'local-storage-v1-migrated'

function parse<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}

export async function migrateLegacyLocalStorage(): Promise<void> {
  if (await db.meta.get(MIGRATION_KEY)) return

  const ownerId = getCurrentOwnerId()
  const deviceId = getInstallationId()
  const active = parse<ActiveSession | null>(ACTIVE_KEY, null)
  const completed = parse<CompletedSession[]>(COMPLETED_KEY, [])
  const planned = parse<PlannedBlock[]>(PLANNER_KEY, [])
  const tasks = parse<Task[]>(TASKS_KEY, [])
  const migratedAt = new Date().toISOString()
  const stamp = <T extends Record<string, unknown>>(record: T, updatedAt = migratedAt): T => syncMetadata({
    ...record,
    ownerId,
    deviceId,
    createdAt: record.createdAt ?? record.startedAt ?? updatedAt,
    updatedAt: record.updatedAt ?? updatedAt,
    deletedAt: record.deletedAt ?? null,
  }, updatedAt) as T

  await db.transaction('rw', [db.sessions, db.plannedBlocks, db.tasks, db.outbox, db.syncTombstones, db.meta], async () => {
    const existingSessionIds = new Set(await db.sessions.toCollection().primaryKeys())
    if (active && !existingSessionIds.has(active.id)) {
      await db.sessions.add(stamp({ ...active, status: active.status ?? 'running' }))
      existingSessionIds.add(active.id)
    }
    const missingCompleted = completed.filter(session => !existingSessionIds.has(session.id))
    if (missingCompleted.length) await db.sessions.bulkAdd(missingCompleted.map((session) => stamp({ ...session, status: 'completed', taskTitleSnapshot: session.taskTitleSnapshot ?? tasks.find(task => task.id === session.taskId)?.title }, session.finishedAt ?? migratedAt)))
    const existingPlanIds = new Set(await db.plannedBlocks.toCollection().primaryKeys())
    const missingPlans = planned.filter(block => !existingPlanIds.has(block.id))
    if (missingPlans.length) await db.plannedBlocks.bulkAdd(missingPlans.map((block) => stamp(block, block.updatedAt ?? block.finishedAt ?? migratedAt)))
    if (tasks.length) {
      const existingTaskIds = new Set(await db.tasks.toCollection().primaryKeys())
      const missingTasks = tasks.filter(task => !existingTaskIds.has(task.id))
      if (missingTasks.length) await db.tasks.bulkAdd(missingTasks.map((task) => stamp(task, task.updatedAt ?? migratedAt)))
    }
    await db.meta.put({ key: MIGRATION_KEY, value: new Date().toISOString() })
  })
}

export async function loadDatabaseState() {
  await migrateLegacyLocalStorage()
  const ownerId = getCurrentOwnerId()
  const [active, completed, planned, tasks, activities] = await Promise.all([
    db.sessions.where('ownerId').equals(ownerId).filter(session => (session.status === 'running' || session.status === 'paused') && !session.deletedAt).first(),
    db.sessions.where('ownerId').equals(ownerId).filter(session => session.status === 'completed' && !session.deletedAt).reverse().sortBy('startedAt'),
    db.plannedBlocks.where('ownerId').equals(ownerId).filter(block => !block.deletedAt).sortBy('startedAt'),
    db.tasks.where('ownerId').equals(ownerId).filter(task => !task.deletedAt).sortBy('updatedAt'),
    db.activities.where('ownerId').equals(ownerId).filter(activity => !activity.deletedAt).sortBy('order'),
  ])
  return {
    active: active ?? null,
    completed: completed as CompletedSession[],
    planned,
    tasks: tasks.reverse(),
    activities,
  }
}

export async function replaceDatabaseState(input: {
  sessions: StoredSession[]
  plannedBlocks: PlannedBlock[]
  tasks: Task[]
  activities?: ActivityPreset[]
}): Promise<void> {
  const ownerId = getCurrentOwnerId()
  const deviceId = getInstallationId()
  const now = new Date().toISOString()
  const stamp = <T extends Record<string, unknown>>(record: T): T => syncMetadata({ ...record, ownerId, deviceId, updatedAt: now, deletedAt: null }, now) as T
  await db.transaction('rw', [db.sessions, db.plannedBlocks, db.tasks, db.activities, db.outbox, db.syncTombstones], async () => {
    const existing = await Promise.all([
      db.sessions.where('ownerId').equals(ownerId).toArray(),
      db.plannedBlocks.where('ownerId').equals(ownerId).toArray(),
      db.tasks.where('ownerId').equals(ownerId).toArray(),
      db.activities.where('ownerId').equals(ownerId).toArray(),
    ])
    const incomingIds = new Map<string, Set<string>>([
      ['sessions', new Set(input.sessions.map(record => record.id))],
      ['plannedBlocks', new Set(input.plannedBlocks.map(record => record.id))],
      ['tasks', new Set(input.tasks.map(record => record.id))],
      ['activities', new Set((input.activities ?? existing[3]).map(record => record.id))],
    ])
    for (const record of existing[0]) if (!incomingIds.get('sessions')!.has(record.id)) await db.sessions.delete(record.id)
    for (const record of existing[1]) if (!incomingIds.get('plannedBlocks')!.has(record.id)) await db.plannedBlocks.delete(record.id)
    for (const record of existing[2]) if (!incomingIds.get('tasks')!.has(record.id)) await db.tasks.delete(record.id)
    if (input.activities) for (const record of existing[3]) if (!incomingIds.get('activities')!.has(record.id)) await db.activities.delete(record.id)
    if (input.sessions.length) await db.sessions.bulkPut(input.sessions.map(stamp))
    if (input.plannedBlocks.length) await db.plannedBlocks.bulkPut(input.plannedBlocks.map(stamp))
    if (input.tasks.length) await db.tasks.bulkPut(input.tasks.map(stamp))
    if (input.activities?.length) await db.activities.bulkPut(input.activities.map(activity => stamp({ ...activity, color: normalizeHexColor(activity.color) ?? activity.color })))
  })
}

export const legacyKeys = { ACTIVE_KEY, COMPLETED_KEY, PLANNER_KEY, TASKS_KEY }
