import type { ActivityPreset } from '../features/activities/types'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { PlannedBlock } from '../features/planner/types'
import type { StoredSession } from './db'
import type { Task } from '../features/tasks/types'
import { db, legacyKeys, migrateLegacyLocalStorage, replaceDatabaseState } from './db'

type BackupPayload = {
  format: 'iza-backup'
  version: 1
  exportedAt: string
  sessions: StoredSession[]
  plannedBlocks: PlannedBlock[]
  tasks: Task[]
  activities?: ActivityPreset[]
}

function backupName(date = new Date()): string {
  return `iza-backup-${date.toISOString().slice(0, 10)}.json`
}

export async function createBackup(): Promise<void> {
  await migrateLegacyLocalStorage()
  const [sessions, plannedBlocks, tasks, activities] = await Promise.all([
    db.sessions.toArray(),
    db.plannedBlocks.toArray(),
    db.tasks.toArray(),
    db.activities.toArray(),
  ])
  const payload: BackupPayload = { format: 'iza-backup', version: 1, exportedAt: new Date().toISOString(), sessions, plannedBlocks, tasks, activities }
  const json = JSON.stringify(payload, null, 2)
  const name = backupName()

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
    const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache })
    await Share.share({ title: 'Save Iza backup', text: 'Keep this file somewhere safe.', files: [uri], dialogTitle: 'Save Iza backup' })
    return
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BackupPayload>
  return candidate.format === 'iza-backup' && candidate.version === 1
    && Array.isArray(candidate.sessions) && Array.isArray(candidate.plannedBlocks) && Array.isArray(candidate.tasks)
}

export async function restoreBackup(file: File): Promise<void> {
  const parsed: unknown = JSON.parse(await file.text())
  if (!isBackupPayload(parsed)) throw new Error('That file is not an Iza backup.')
  await replaceDatabaseState(parsed)

  const active = parsed.sessions.find((session) => session.status === 'running' || session.status === 'paused') ?? null
  const completed = parsed.sessions.filter((session): session is StoredSession & { finishedAt: string } => session.status === 'completed' && Boolean(session.finishedAt))
  if (active) localStorage.setItem(legacyKeys.ACTIVE_KEY, JSON.stringify(active))
  else localStorage.removeItem(legacyKeys.ACTIVE_KEY)
  localStorage.setItem(legacyKeys.COMPLETED_KEY, JSON.stringify(completed))
  localStorage.setItem(legacyKeys.PLANNER_KEY, JSON.stringify(parsed.plannedBlocks))
  localStorage.setItem(legacyKeys.TASKS_KEY, JSON.stringify(parsed.tasks))
}
