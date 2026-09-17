import { BellRing, CalendarDays, CheckSquare, ChevronRight, Database, Download, RefreshCw, Sparkles, Smartphone, Upload } from 'lucide-react'
import type { AppRoute } from '../App'
import { currentVersion } from '../features/releases/changelog'
import { createBackup, restoreBackup } from '../lib/backup'
import type { UpdateManager } from '../features/updates/useUpdateManager'
import { useRef, useState } from 'react'

export function SettingsPage({ onNavigate, updates }: { onNavigate: (route: AppRoute) => void; updates: UpdateManager }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [backupStatus, setBackupStatus] = useState('')

  const saveBackup = async () => {
    try {
      await createBackup()
      setBackupStatus('Backup ready to save.')
    } catch {
      setBackupStatus('Iza could not create the backup. Please try again.')
    }
  }

  const restore = async (file?: File) => {
    if (!file) return
    try {
      await restoreBackup(file)
      window.location.reload()
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : 'Iza could not restore that backup.')
    }
  }

  return (
    <section className="hora-page me-page">
      <header className="hora-page-heading"><h1>Your gentle corner</h1><p>Plan what helps. Keep the rest simple.</p></header>
      <section className="profile-card"><span>I</span><div><strong>App version {currentVersion}</strong><small>Your data stays on this device first</small></div></section>
      <h2>About Iza</h2>
      <div className="tool-links">
        <button type="button" onClick={() => onNavigate('/changelog')}><Sparkles /><span><strong>What’s new</strong><small>See changes in every version</small></span><ChevronRight /></button>
        {updates.supportsUpdates && <button type="button" className="update-check-button" onClick={() => void updates.checkForUpdates()} disabled={updates.state.status === 'checking'}><RefreshCw /><span><strong>Check for updates</strong><small>{updates.state.status === 'checking' ? 'Checking GitHub…' : 'Look for a newer Android APK'}</small></span><ChevronRight /></button>}
      </div>
      {updates.supportsUpdates && updates.state.message && updates.state.status !== 'available' && <p className="update-settings-status" role="status">{updates.state.message}</p>}
      {updates.supportsUpdates && updates.state.status === 'available' && <p className="update-settings-status" role="status">Version {updates.state.update?.versionName} is available above.</p>}
      <h2>Planning tools</h2>
      <div className="tool-links"><button type="button" onClick={() => onNavigate('/planner')}><CalendarDays /><span><strong>Open planner</strong><small>Plan blocks beside actual time</small></span></button><button type="button" onClick={() => onNavigate('/tasks')}><CheckSquare /><span><strong>Open tasks</strong><small>Keep the next step close</small></span></button></div>
      <h2>App status</h2>
      <div className="settings-list"><article><Smartphone /><div><strong>Android app</strong><span>Capacitor shell configured</span></div><b>Ready</b></article><article><Database /><div><strong>Offline data</strong><span>Saved on this device first</span></div><b>Local</b></article><article><BellRing /><div><strong>Goal reminders</strong><span>Scheduled on this device</span></div><b>Ready</b></article></div>
      <h2>Keep your data safe</h2>
      <div className="tool-links backup-actions">
        <button type="button" onClick={() => void saveBackup()}><Download /><span><strong>Save backup file</strong><small>Keep a copy before uninstalling Iza</small></span></button>
        <button type="button" onClick={() => fileInput.current?.click()}><Upload /><span><strong>Restore from backup</strong><small>Replace this device's data from an Iza file</small></span></button>
      </div>
      <input ref={fileInput} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void restore(event.target.files?.[0])} />
      {backupStatus && <p className="backup-status" role="status">{backupStatus}</p>}
    </section>
  )
}
