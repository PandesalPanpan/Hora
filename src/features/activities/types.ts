import type { ActivityGroup } from './catalog'
import type { SyncMetadata } from '../../lib/syncTypes'

export type ActivityPreset = {
  id: string
  name: string
  normalizedName: string
  category: ActivityGroup
  color: string
  archived: boolean
  order: number
  builtIn?: boolean
  createdAt: string
  updatedAt: string
} & SyncMetadata

export const normalizeActivityName = (name: string) => name.trim().toLocaleLowerCase()
