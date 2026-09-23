import type { ActivityPreset } from '../activities/types'
import { normalizeHexColor } from '../activities/color'
import type { PlannedBlock } from './types'

export type PlannerActivityPresentation = Pick<ActivityPreset, 'id' | 'name' | 'color'>

/** A custom title belongs to the block; the Activity name is only a display fallback. */
export function plannedBlockDisplayTitle(block: Pick<PlannedBlock, 'title' | 'activityId'>, activities: readonly PlannerActivityPresentation[]): string {
  const customTitle = typeof block.title === 'string' ? block.title.trim() : ''
  if (customTitle) return customTitle
  const activityName = activities.find(activity => activity.id === block.activityId)?.name.trim()
  return activityName || 'Planned block'
}

/** Linked plans follow the current Activity color; unlinked plans retain their saved color. */
export function plannedBlockDisplayColor(block: Pick<PlannedBlock, 'color' | 'activityId'>, activities: readonly PlannerActivityPresentation[]): string {
  const activityColor = activities.find(activity => activity.id === block.activityId)?.color
  return normalizeHexColor(activityColor ?? '') ?? normalizeHexColor(block.color) ?? '#B92F60'
}
