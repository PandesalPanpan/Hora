import { CheckCircle2, Download, ExternalLink, ShieldCheck } from 'lucide-react'
import type { UpdateManagerState } from '../features/updates/useUpdateManager'

type UpdateBannerProps = {
  state: UpdateManagerState
  onLater: () => void
  onDownload: () => void
  onInstall: () => void
  onOpenInstallSettings: () => void
}

function progressText(state: UpdateManagerState): string {
  const progress = state.progress
  if (!progress || progress.totalBytes <= 0) return 'Downloading…'
  const megabytes = (progress.bytesDownloaded / 1024 / 1024).toFixed(1)
  const totalMegabytes = (progress.totalBytes / 1024 / 1024).toFixed(1)
  return `${progress.percent}% · ${megabytes} MB of ${totalMegabytes} MB`
}

export function UpdateBanner({ state, onLater, onDownload, onInstall, onOpenInstallSettings }: UpdateBannerProps) {
  if (!state.update) return null

  const { update } = state
  const title = state.status === 'permissionRequired'
    ? 'Allow the update to install'
    : state.status === 'readyToInstall'
      ? 'Update ready'
      : state.status === 'error'
        ? 'Update could not finish'
        : state.status === 'downloading'
          ? 'Downloading update'
          : 'Update available'

  return (
    <aside className="update-banner" aria-live="polite">
      <header className="update-banner-heading">
        <span className="update-banner-icon"><Download aria-hidden="true" /></span>
        <div>
          <strong>{title}</strong>
          <p>Version {update.versionName} is available.</p>
          <small>Current version: {state.installed.versionName}</small>
        </div>
      </header>

      {state.status === 'available' && <details className="update-notes">
        <summary>What’s new</summary>
        <pre>{update.releaseNotes || 'No release notes were included with this release.'}</pre>
        <a href={update.releaseUrl} target="_blank" rel="noreferrer">View release on GitHub <ExternalLink aria-hidden="true" /></a>
      </details>}

      {state.status === 'downloading' && <div className="update-download-progress">
        <div className="update-progress-track" role="progressbar" aria-label="Update download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, state.progress?.percent ?? 0)}>
          <span style={{ width: `${Math.max(0, Math.min(100, state.progress?.percent ?? 0))}%` }} />
        </div>
        <small>{progressText(state)}</small>
      </div>}

      {(state.status === 'readyToInstall' || state.status === 'permissionRequired' || state.status === 'error') && <p className="update-banner-message">
        {state.message}
      </p>}

      {state.status === 'readyToInstall' && <p className="update-banner-safety"><ShieldCheck aria-hidden="true" /> The APK was checked before installation.</p>}
      {state.status === 'permissionRequired' && <p className="update-banner-safety"><ShieldCheck aria-hidden="true" /> Android asks once before an app can install updates outside Google Play.</p>}
      {state.status === 'error' && <p className="update-banner-safety"><CheckCircle2 aria-hidden="true" /> Your current app and data are still safe.</p>}

      <div className="update-banner-actions">
        {(state.status === 'available' || state.status === 'downloading' || state.status === 'readyToInstall' || state.status === 'permissionRequired' || state.status === 'error') && <button type="button" onClick={onLater} disabled={state.status === 'downloading'}>Later</button>}
        {state.status === 'available' && <button type="button" className="primary" onClick={onDownload}>Update now</button>}
        {state.status === 'readyToInstall' && <button type="button" className="primary" onClick={onInstall}>Install update</button>}
        {state.status === 'permissionRequired' && <button type="button" className="primary" onClick={onOpenInstallSettings}>Open install settings</button>}
        {state.status === 'error' && <button type="button" className="primary" onClick={onDownload}>Try again</button>}
      </div>
    </aside>
  )
}
