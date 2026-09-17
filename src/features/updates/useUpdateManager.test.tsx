import { act, renderHook, waitFor } from '@testing-library/react'
import { Capacitor } from '@capacitor/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateManager } from './useUpdateManager'
import type { UpdateInfo } from './types'
import { checkForUpdate } from './repository'

vi.mock('./repository', () => ({
  checkForUpdate: vi.fn(),
  downloadUpdate: vi.fn(),
  installDownloadedUpdate: vi.fn(),
  openInstallSettings: vi.fn(),
}))

vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn(async () => ({ remove: vi.fn(async () => undefined) })) },
}))

const update: UpdateInfo = {
  versionCode: 2,
  versionName: '0.2.0',
  releaseNotes: '- A calmer way to update',
  releaseName: 'Iza 0.2.0',
  releaseUrl: 'https://github.com/PandesalPanpan/Hora/releases/tag/v0.2.0',
  apkFileName: 'app-release.apk',
  apkUrl: 'https://github.com/PandesalPanpan/Hora/releases/download/v0.2.0/app-release.apk',
  checksumSha256: 'a'.repeat(64),
}

describe('useUpdateManager', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    vi.mocked(checkForUpdate).mockResolvedValue({
      installed: { versionCode: 1, versionName: '0.1.0' },
      update,
      checkedAt: 1000,
      skipped: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('checks in the background, lets Later suppress the current session, and lets a manual check show it again', async () => {
    const rendered = renderHook(() => useUpdateManager())

    await waitFor(() => expect(rendered.result.current.state.status).toBe('available'), { timeout: 3000 })

    act(() => rendered.result.current.later())
    expect(rendered.result.current.state.status).toBe('idle')
    expect(sessionStorage.getItem('iza.update.dismissed.v1')).toBe('2')

    await act(async () => { await rendered.result.current.checkForUpdates() })
    expect(rendered.result.current.state.status).toBe('available')
  })

  it('keeps an automatic check failure silent', async () => {
    vi.mocked(checkForUpdate).mockRejectedValueOnce(new Error('offline'))
    const rendered = renderHook(() => useUpdateManager())

    await waitFor(() => expect(checkForUpdate).toHaveBeenCalledOnce(), { timeout: 3000 })
    expect(rendered.result.current.state.status).toBe('idle')
    expect(rendered.result.current.state.message).toBe('')
  })
})
