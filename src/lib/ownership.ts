import { useSyncExternalStore } from 'react'

const INSTALLATION_KEY = 'iza.installation-id.v1'
const LOCAL_OWNER_PREFIX = 'local:'
const USER_OWNER_PREFIX = 'user:'

let currentOwnerId: string | undefined

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `installation-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

export function getInstallationId(): string {
  try {
    const existing = localStorage.getItem(INSTALLATION_KEY)
    if (existing) return existing
    const created = newId()
    localStorage.setItem(INSTALLATION_KEY, created)
    return created
  } catch {
    return 'ephemeral-installation'
  }
}

export function localOwnerId(): string {
  return `${LOCAL_OWNER_PREFIX}${getInstallationId()}`
}

export function userOwnerId(uid: string): string {
  return `${USER_OWNER_PREFIX}${uid}`
}

export function isLocalOwner(ownerId: string | undefined): boolean {
  return Boolean(ownerId?.startsWith(LOCAL_OWNER_PREFIX))
}

export function isUserOwner(ownerId: string | undefined): boolean {
  return Boolean(ownerId?.startsWith(USER_OWNER_PREFIX))
}

export function uidFromOwnerId(ownerId: string): string | null {
  return isUserOwner(ownerId) ? ownerId.slice(USER_OWNER_PREFIX.length) : null
}

export function getCurrentOwnerId(): string {
  return currentOwnerId ?? localOwnerId()
}

export function setCurrentOwnerId(ownerId: string): void {
  if (currentOwnerId === ownerId) return
  currentOwnerId = ownerId
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('iza-data-scope-changed'))
}

export function resetToLocalOwner(): void {
  setCurrentOwnerId(localOwnerId())
}

function subscribeToOwner(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener('iza-data-scope-changed', listener)
  return () => window.removeEventListener('iza-data-scope-changed', listener)
}

export function useCurrentOwnerId(): string {
  return useSyncExternalStore(subscribeToOwner, getCurrentOwnerId, getCurrentOwnerId)
}

export const ownershipKeys = { INSTALLATION_KEY }
