import { BellRing, CalendarDays, CheckSquare, ChevronRight, Clock3, Database, Download, RefreshCw, Sparkles, Smartphone, Upload } from 'lucide-react'
import type { AppRoute } from '../App'
import { currentVersion } from '../features/releases/changelog'
import { createBackup, restoreBackup } from '../lib/backup'
import type { UpdateManager } from '../features/updates/useUpdateManager'
import { useRef, useState } from 'react'
import { useEffect } from 'react'
import { getNotificationCapability, openExactAlarmSettings, requestNotificationPermission, scheduleTestNotification, type NotificationCapabilityState } from '../lib/notifications'

export function SettingsPage({ onNavigate, updates }: { onNavigate: (route: AppRoute) => void; updates: UpdateManager }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [backupStatus, setBackupStatus] = useState('')
  const [notificationStatus, setNotificationStatus] = useState<NotificationCapabilityState | null>(null)
  const [notificationMessage, setNotificationMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const refresh = () => { void getNotificationCapability().then((status) => { if (!cancelled) setNotificationStatus(status) }).catch(() => undefined) }
    refresh()
    window.addEventListener('iza-notification-status-changed', refresh)
    return () => { cancelled = true; window.removeEventListener('iza-notification-status-changed', refresh) }
  }, [])

  const enableNotifications = async () => {
    try {
      const status = await requestNotificationPermission()
      setNotificationStatus(status)
      setNotificationMessage(status.notifications === 'enabled' ? 'Notifications enabled.' : 'Notifications are still turned off.')
    } catch {
      setNotificationMessage('Notifications could not be updated. Please try again.')
    }
  }

  const enablePreciseAlarms = async () => {
    try {
      const status = await openExactAlarmSettings()
      setNotificationStatus(status)
      setNotificationMessage(status.preciseAlarms === 'enabled' ? 'Precise timer alerts enabled.' : 'Precise timer alerts are still off.')
    } catch {
      setNotificationMessage('Precise alarm settings could not be opened. Please try again.')
    }
  }

  const testNotification = async () => {
    try {
      const scheduled = await scheduleTestNotification()
      setNotificationMessage(scheduled ? 'Test alert scheduled.' : 'Turn on notifications first.')
    } catch {
      setNotificationMessage('The test alert could not be scheduled. Please try again.')
    }
  }

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
      <h2>Notifications and reminders</h2>
      <div className="settings-list notification-status-list">
        <article><BellRing /><div><strong>Notifications</strong><span>{notificationStatus?.platform === 'web' ? 'Native alerts are available in the Android app.' : notificationStatus?.notifications === 'enabled' ? 'Alerts can appear while Hora is closed.' : notificationStatus?.notifications === 'disabled' ? 'Android notification permission is off.' : 'Permission is needed before alerts can appear.'}</span></div><b>{notificationStatus?.platform === 'web' ? 'Web' : notificationStatus?.notifications === 'enabled' ? 'Enabled' : notificationStatus?.notifications === 'disabled' ? 'Disabled' : 'Needs access'}</b></article>
        <article><Smartphone /><div><strong>Active timer notification</strong><span>{notificationStatus?.platform === 'android' && notificationStatus.notifications !== 'enabled' ? 'Turn on notifications to show controls while tracking.' : 'Shown while tracking with quiet Pause, Resume, and Finish controls.'}</span></div><b>{notificationStatus?.platform === 'android' ? notificationStatus.notifications === 'enabled' ? 'Shown while tracking' : 'Needs access' : 'Android app'}</b></article>
        <article><Clock3 /><div><strong>Precise timer alerts</strong><span>{notificationStatus?.platform !== 'android' ? 'Android controls are not needed here.' : notificationStatus.preciseAlarms === 'enabled' ? 'Timeflow and Pomodoro can alert at the intended time.' : 'Android may deliver timer alerts late without precise alarms.'}</span></div><b>{notificationStatus?.platform !== 'android' ? 'N/A' : notificationStatus.preciseAlarms === 'enabled' ? 'Enabled' : 'Not enabled'}</b></article>
      </div>
      {notificationStatus?.platform === 'android' && <div className="tool-links notification-actions">
        {notificationStatus.notifications !== 'enabled' && <button type="button" onClick={() => void enableNotifications()}><BellRing /><span><strong>Enable notifications</strong><small>Allow timer and planner alerts</small></span><ChevronRight /></button>}
        {notificationStatus.preciseAlarms !== 'enabled' && <button type="button" onClick={() => void enablePreciseAlarms()}><Clock3 /><span><strong>Enable precise alarms</strong><small>Help timer alerts arrive on time</small></span><ChevronRight /></button>}
        <button type="button" onClick={() => void testNotification()}><BellRing /><span><strong>Test notification</strong><small>Schedule an alert in a few seconds</small></span><ChevronRight /></button>
      </div>}
      {notificationMessage && <p className="backup-status" role="status">{notificationMessage}</p>}
      <h2>App status</h2>
      <div className="settings-list"><article><Smartphone /><div><strong>Android app</strong><span>Capacitor shell configured</span></div><b>Ready</b></article><article><Database /><div><strong>Offline data</strong><span>Saved on this device first</span></div><b>Local</b></article></div>
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
