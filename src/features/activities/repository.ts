import { db } from '../../lib/db'
import { getCurrentOwnerId, getInstallationId } from '../../lib/ownership'
import { activityGroups } from './catalog'
import type { ActivityGroup } from './catalog'
import { normalizeActivityName, type ActivityPreset } from './types'
import { normalizeHexColor } from './color'
export async function ensureActivities() {
  const ownerId = getCurrentOwnerId()
  await db.transaction('rw', db.activities, db.outbox, db.syncTombstones, async () => {
    const existing = await db.activities.where('ownerId').equals(ownerId).filter(item => !item.deletedAt).toArray()
    const now = new Date().toISOString()
    const missing: ActivityPreset[] = []
    for (const [category, items] of Object.entries(activityGroups)) for (const item of items) {
      if (item.id === 'custom' || existing.some(value => value.id === item.id || value.normalizedName === normalizeActivityName(item.name))) continue
      missing.push({ ...item, color: normalizeHexColor(item.color) ?? item.color, normalizedName: normalizeActivityName(item.name), category: category as ActivityPreset['category'], archived: false, order: existing.length + missing.length, builtIn: true, createdAt: now, updatedAt: now, ownerId, deviceId: getInstallationId(), deletedAt: null, syncSchemaVersion: 1 })
    }
    if (missing.length) await db.activities.bulkAdd(missing)
  })
}
export async function activityCounts(id: string) {
  const ownerId = getCurrentOwnerId()
  const [sessions, plans] = await Promise.all([db.sessions.where('ownerId').equals(ownerId).filter(s => s.activity.id === id && s.status === 'completed' && !s.deletedAt).count(), db.plannedBlocks.where('ownerId').equals(ownerId).filter(block => block.activityId === id && !block.deletedAt).count()])
  return { sessions, plans }
}
export async function saveActivity(preset: ActivityPreset, everywhere = false) {
  const ownerId = getCurrentOwnerId()
  const color = normalizeHexColor(preset.color)
  if (!color) throw new Error('Enter a valid HEX color.')
  const next = { ...preset, name: preset.name.trim(), normalizedName: normalizeActivityName(preset.name), color, ownerId: preset.ownerId ?? ownerId, deviceId: preset.deviceId ?? getInstallationId(), updatedAt: new Date().toISOString() }
  if (!next.name) throw new Error('Enter an activity name.')
  await db.transaction('rw', db.activities, db.sessions, db.plannedBlocks, db.outbox, db.syncTombstones, async () => {
    const match = await db.activities.where('ownerId').equals(ownerId).filter(item => item.normalizedName === next.normalizedName).first()
    if (match && match.id !== next.id) throw new Error(match.archived ? 'An archived activity has this name. Restore it below.' : 'An activity already has this name.')
    await db.activities.put(next)
    if (everywhere) {
      await db.sessions.where('ownerId').equals(ownerId).filter(s => s.activity.id === next.id && s.status === 'completed' && !s.deletedAt).modify({ activity: { id: next.id, name: next.name, color: next.color, category: next.category } })
      await db.plannedBlocks.where('ownerId').equals(ownerId).filter(block => block.activityId === next.id && !block.deletedAt).modify({ color: next.color, category: next.category === 'Life' ? 'Others' : next.category })
    }
  })
  window.dispatchEvent(new Event('iza-data-changed'))
}
export async function reorderActivities(ids: string[]) {
  await db.transaction('rw', db.activities, db.outbox, db.syncTombstones, async () => { for (const [order,id] of ids.entries()) await db.activities.update(id,{ order }) })
}

export async function moveActivity(id: string, category: ActivityGroup, targetIndex: number, updateExisting = false) {
  const ownerId = getCurrentOwnerId()
  await db.transaction('rw', db.activities, db.sessions, db.plannedBlocks, db.outbox, db.syncTombstones, async () => {
    const moving = await db.activities.where('ownerId').equals(ownerId).filter(item => item.id === id).first()
    if (!moving || moving.archived) throw new Error('That activity is no longer available to move.')
    const previousCategory = moving.category
    const active = (await db.activities.where('ownerId').equals(ownerId).filter(item => !item.deletedAt).toArray()).filter(item => !item.archived && item.id !== id)
    const target = active.filter(item => item.category === category).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    target.splice(Math.max(0, Math.min(targetIndex, target.length)), 0, { ...moving, category })
    const affected = previousCategory === category ? [category] : [previousCategory, category]
    for (const group of affected) {
      const ordered = group === category
        ? target
        : active.filter(item => item.category === group).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      for (const [order, item] of ordered.entries()) await db.activities.update(item.id, { category: group, order, updatedAt: new Date().toISOString() })
    }
    if (updateExisting && previousCategory !== category) {
      await db.sessions.where('ownerId').equals(ownerId).filter(session => session.activity.id === id && session.status === 'completed' && !session.deletedAt).modify(session => {
        session.activity = { ...session.activity, category }
      })
      await db.plannedBlocks.where('ownerId').equals(ownerId).filter(block => block.activityId === id && !block.deletedAt).modify({ category: category === 'Life' ? 'Others' : category })
    }
  })
  window.dispatchEvent(new Event('iza-data-changed'))
}
