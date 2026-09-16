import Dexie, { type EntityTable } from 'dexie'
import type { PlannedBlock } from '../features/planner/types'
import type { ActiveSession, CompletedSession } from '../features/timer/types'
import type { Task } from '../features/tasks/types'
import type { ActivityPreset } from '../features/activities/types'
import { activityGroups } from '../features/activities/catalog'
import { normalizeActivityName } from '../features/activities/types'

export type StoredSession = ActiveSession & { finishedAt?: string }

type MetaRecord = { key: string; value: string }

class IzaDatabase extends Dexie {
  sessions!: EntityTable<StoredSession, 'id'>
  plannedBlocks!: EntityTable<PlannedBlock, 'id'>
  tasks!: EntityTable<Task, 'id'>
  activities!: EntityTable<ActivityPreset, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>

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

  }
}

export const db = new IzaDatabase()

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

  const active = parse<ActiveSession | null>(ACTIVE_KEY, null)
  const completed = parse<CompletedSession[]>(COMPLETED_KEY, [])
  const planned = parse<PlannedBlock[]>(PLANNER_KEY, [])
  const tasks = parse<Task[]>(TASKS_KEY, [])

  await db.transaction('rw', db.sessions, db.plannedBlocks, db.tasks, db.meta, async () => {
    if (active) await db.sessions.put({ ...active, status: active.status ?? 'running' })
    if (completed.length) await db.sessions.bulkPut(completed.map((session) => ({ ...session, status: 'completed', taskTitleSnapshot: session.taskTitleSnapshot ?? tasks.find(task => task.id === session.taskId)?.title })))
    if (planned.length) await db.plannedBlocks.bulkPut(planned)
    if (tasks.length) {
      const migratedAt = new Date().toISOString()
      await db.tasks.bulkPut(tasks.map((task) => ({ ...task, createdAt: task.createdAt ?? migratedAt, updatedAt: task.updatedAt ?? migratedAt })))
    }
    await db.meta.put({ key: MIGRATION_KEY, value: new Date().toISOString() })
  })
}

export async function loadDatabaseState() {
  await migrateLegacyLocalStorage()
  const [active, completed, planned, tasks, activities] = await Promise.all([
    db.sessions.where('status').anyOf('running', 'paused').first(),
    db.sessions.where('status').equals('completed').reverse().sortBy('startedAt'),
    db.plannedBlocks.orderBy('startedAt').toArray(),
    db.tasks.orderBy('updatedAt').toArray(),
    db.activities.orderBy('order').toArray(),
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
  await db.transaction('rw', db.sessions, db.plannedBlocks, db.tasks, db.activities, async () => {
    await Promise.all([db.sessions.clear(), db.plannedBlocks.clear(), db.tasks.clear()])
    if (input.sessions.length) await db.sessions.bulkPut(input.sessions)
    if (input.plannedBlocks.length) await db.plannedBlocks.bulkPut(input.plannedBlocks)
    if (input.tasks.length) await db.tasks.bulkPut(input.tasks)
    if (input.activities) { await db.activities.clear(); if (input.activities.length) await db.activities.bulkPut(input.activities) }
  })
}

export const legacyKeys = { ACTIVE_KEY, COMPLETED_KEY, PLANNER_KEY, TASKS_KEY }
