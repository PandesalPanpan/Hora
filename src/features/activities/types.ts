import type { ActivityGroup } from './catalog'

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
}

export const normalizeActivityName = (name: string) => name.trim().toLocaleLowerCase()
