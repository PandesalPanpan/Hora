import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { checkForUpdate, downloadUpdate, installDownloadedUpdate, openInstallSettings } from './repository'
import type { NativeDownloadProgress } from './native'
import type { AppVersion, UpdateInfo } from './types'
import { UpdateServiceError } from './types'
import { currentVersion, currentVersionCode } from '../releases/changelog'

export type UpdateStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'readyToInstall' | 'permissionRequired' | 'error'

export type UpdateManagerState = {
  status: UpdateStatus
  installed: AppVersion
  update: UpdateInfo | null
  progress: NativeDownloadProgress | null
  message: string
  checkedAt: number | null
}

export type UpdateManager = {
  supportsUpdates: boolean
  state: UpdateManagerState
  checkForUpdates: () => Promise<void>
  later: () => void
  download: () => Promise<void>
  install: () => Promise<void>
  openInstallSettings: () => Promise<void>
}

const DISMISSED_UPDATE_KEY = 'iza.update.dismissed.v1'

function initialState(): UpdateManagerState {
  return {
    status: 'idle',
    installed: { versionCode: currentVersionCode, versionName: currentVersion },
    update: null,
    progress: null,
    message: '',
    checkedAt: null,
  }
}

function dismissedVersionCode(): number | null {
  try {
    const value = Number(sessionStorage.getItem(DISMISSED_UPDATE_KEY))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function rememberDismissed(versionCode: number): void {
  try { sessionStorage.setItem(DISMISSED_UPDATE_KEY, String(versionCode)) } catch { /* best-effort session preference */ }
}

function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android'
}

function errorMessage(error: unknown): string {
  if (error instanceof UpdateServiceError) return error.message
  return error instanceof Error ? error.message : 'The update could not be completed. Try again later.'
}

export function useUpdateManager(): UpdateManager {
  const supportsUpdates = isAndroid()
  const [state, setState] = useState<UpdateManagerState>(initialState)
  const stateRef = useRef(state)
  const checkingRef = useRef(false)

  const replaceState = useCallback((next: UpdateManagerState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const checkForUpdates = useCallback(async () => {
    if (!supportsUpdates || checkingRef.current) return
    if (navigator.onLine === false) {
      replaceState({ ...stateRef.current, status: 'idle', message: 'No internet connection. Iza will try again when you are online.', progress: null })
      return
    }

    checkingRef.current = true
    replaceState({ ...stateRef.current, status: 'checking', message: '', progress: null })
    try {
      const result = await checkForUpdate({ force: true })
      const update = result.update
      if (!update) {
        replaceState({ ...stateRef.current, status: 'upToDate', installed: result.installed, update: null, progress: null, message: 'Iza is up to date.', checkedAt: result.checkedAt })
      } else {
        replaceState({ ...stateRef.current, status: 'available', installed: result.installed, update, progress: null, message: '', checkedAt: result.checkedAt })
      }
    } catch (error) {
      replaceState({ ...stateRef.current, status: 'error', update: null, progress: null, message: errorMessage(error) })
    } finally {
      checkingRef.current = false
    }
  }, [replaceState, supportsUpdates])

  const runAutomaticCheck = useCallback(async () => {
    if (!supportsUpdates || checkingRef.current || navigator.onLine === false) return
    checkingRef.current = true
    replaceState({ ...stateRef.current, status: 'checking', message: '', progress: null })
    try {
      const result = await checkForUpdate()
      const update = result.update
      if (!update || result.skipped || dismissedVersionCode() === update.versionCode) {
        replaceState({ ...stateRef.current, status: 'idle', installed: result.installed, update: null, progress: null, message: '', checkedAt: result.checkedAt })
      } else {
        replaceState({ ...stateRef.current, status: 'available', installed: result.installed, update, progress: null, message: '', checkedAt: result.checkedAt })
      }
    } catch {
      // An automatic check is background work. It must never interrupt startup or offline use.
      replaceState({ ...stateRef.current, status: 'idle', update: null, progress: null, message: '' })
    } finally {
      checkingRef.current = false
    }
  }, [replaceState, supportsUpdates])

  useEffect(() => {
    if (!supportsUpdates) return
    let disposed = false
    let resumeHandle: { remove: () => Promise<void> } | undefined
    const start = () => { if (!disposed) void runAutomaticCheck() }
    const timer = window.setTimeout(start, 1200)
    const online = () => { if (navigator.onLine !== false) void runAutomaticCheck() }
    window.addEventListener('online', online)
    void CapacitorApp.addListener('resume', () => {
      // The user can retry the install button after returning from Android settings.
      if (stateRef.current.status === 'permissionRequired' && stateRef.current.update) {
        replaceState({ ...stateRef.current, status: 'readyToInstall', message: 'Ready to install. Android will ask you to confirm.' })
      }
    }).then((handle) => { if (disposed) void handle.remove(); else resumeHandle = handle })
    return () => {
      disposed = true
      window.clearTimeout(timer)
      window.removeEventListener('online', online)
      if (resumeHandle) void resumeHandle.remove()
    }
  }, [replaceState, runAutomaticCheck, supportsUpdates])

  const later = useCallback(() => {
    const update = stateRef.current.update
    if (!update) return
    rememberDismissed(update.versionCode)
    replaceState({ ...stateRef.current, status: 'idle', update: null, progress: null, message: '' })
  }, [replaceState])

  const download = useCallback(async () => {
    const update = stateRef.current.update
    if (!update || stateRef.current.status === 'downloading') return
    replaceState({ ...stateRef.current, status: 'downloading', progress: { bytesDownloaded: 0, totalBytes: 0, percent: 0 }, message: 'Downloading update…' })
    try {
      await downloadUpdate(update, (progress) => replaceState({ ...stateRef.current, status: 'downloading', progress, message: 'Downloading update…' }))
      replaceState({ ...stateRef.current, status: 'readyToInstall', progress: { bytesDownloaded: stateRef.current.progress?.totalBytes ?? 0, totalBytes: stateRef.current.progress?.totalBytes ?? 0, percent: 100 }, message: 'The update is ready to install.' })
    } catch (error) {
      replaceState({ ...stateRef.current, status: 'error', progress: null, message: errorMessage(error) })
    }
  }, [replaceState])

  const install = useCallback(async () => {
    const update = stateRef.current.update
    if (!update) return
    try {
      const result = await installDownloadedUpdate(update)
      if (result === 'permission-required') {
        replaceState({ ...stateRef.current, status: 'permissionRequired', message: 'Allow Iza to install this update in Android settings.' })
      } else {
        replaceState({ ...stateRef.current, status: 'readyToInstall', message: 'The Android installer is opening.' })
      }
    } catch (error) {
      replaceState({ ...stateRef.current, status: 'error', message: errorMessage(error) })
    }
  }, [replaceState])

  const goToInstallSettings = useCallback(async () => {
    try {
      await openInstallSettings()
    } catch (error) {
      replaceState({ ...stateRef.current, status: 'error', message: errorMessage(error) })
    }
  }, [replaceState])

  return { supportsUpdates, state, checkForUpdates, later, download, install, openInstallSettings: goToInstallSettings }
}
