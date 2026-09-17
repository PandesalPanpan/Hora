import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import type { UpdateManager } from '../features/updates/useUpdateManager'
import { currentVersion } from '../features/releases/changelog'

function manager(): UpdateManager {
  return {
    supportsUpdates: true,
    state: { status: 'idle', installed: { versionCode: 1, versionName: '0.1.0' }, update: null, progress: null, message: '', checkedAt: null },
    checkForUpdates: vi.fn(async () => undefined),
    later: vi.fn(),
    download: vi.fn(async () => undefined),
    install: vi.fn(async () => undefined),
    openInstallSettings: vi.fn(async () => undefined),
  }
}

describe('SettingsPage updates', () => {
  afterEach(cleanup)

  it('offers a manual update check under About Iza', () => {
    const updates = manager()
    render(<SettingsPage onNavigate={vi.fn()} updates={updates} />)
    fireEvent.click(screen.getByRole('button', { name: /Check for updates/i }))
    expect(updates.checkForUpdates).toHaveBeenCalledOnce()
    expect(screen.getByText(`App version ${currentVersion}`)).toBeInTheDocument()
  })
})
