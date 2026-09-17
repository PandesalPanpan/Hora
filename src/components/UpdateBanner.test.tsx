import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from './UpdateBanner'
import type { UpdateManagerState } from '../features/updates/useUpdateManager'

const update = {
  versionCode: 2,
  versionName: '0.2.0',
  releaseNotes: '- A calmer way to update',
  releaseName: 'Iza 0.2.0',
  releaseUrl: 'https://github.com/PandesalPanpan/Hora/releases/tag/v0.2.0',
  apkFileName: 'app-release.apk',
  apkUrl: 'https://github.com/PandesalPanpan/Hora/releases/download/v0.2.0/app-release.apk',
  checksumSha256: 'a'.repeat(64),
}

function state(status: UpdateManagerState['status'], extra: Partial<UpdateManagerState> = {}): UpdateManagerState {
  return { status, installed: { versionCode: 1, versionName: '0.1.0' }, update, progress: null, message: '', checkedAt: null, ...extra }
}

describe('UpdateBanner', () => {
  afterEach(cleanup)

  it('shows the available update and exposes release notes', () => {
    render(<UpdateBanner state={state('available')} onLater={vi.fn()} onDownload={vi.fn()} onInstall={vi.fn()} onOpenInstallSettings={vi.fn()} />)
    expect(screen.getByText('Update available')).toBeInTheDocument()
    expect(screen.getByText('Version 0.2.0 is available.')).toBeInTheDocument()
    expect(screen.getByText('Current version: 0.1.0')).toBeInTheDocument()
    fireEvent.click(screen.getByText('What’s new'))
    expect(screen.getByText('- A calmer way to update')).toBeInTheDocument()
  })

  it('lets the user defer or start the update', () => {
    const onLater = vi.fn()
    const onDownload = vi.fn()
    render(<UpdateBanner state={state('available')} onLater={onLater} onDownload={onDownload} onInstall={vi.fn()} onOpenInstallSettings={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }))
    expect(onLater).toHaveBeenCalledOnce()
    expect(onDownload).toHaveBeenCalledOnce()
  })

  it('shows download progress', () => {
    render(<UpdateBanner state={state('downloading', { progress: { bytesDownloaded: 1024 * 1024, totalBytes: 2 * 1024 * 1024, percent: 50 }, message: 'Downloading update…' })} onLater={vi.fn()} onDownload={vi.fn()} onInstall={vi.fn()} onOpenInstallSettings={vi.fn()} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('50% · 1.0 MB of 2.0 MB')).toBeInTheDocument()
  })

  it('guides the user when Android install permission is missing', () => {
    const onOpenInstallSettings = vi.fn()
    render(<UpdateBanner state={state('permissionRequired', { message: 'Allow Iza to install this update in Android settings.' })} onLater={vi.fn()} onDownload={vi.fn()} onInstall={vi.fn()} onOpenInstallSettings={onOpenInstallSettings} />)
    expect(screen.getByText('Allow the update to install')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open install settings' }))
    expect(onOpenInstallSettings).toHaveBeenCalledOnce()
  })
})
