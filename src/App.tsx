import { useSheetNavigation } from './components/useSheetNavigation'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { BarChart3, CalendarDays, CheckSquare, Clock3, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CompletionSheet } from './components/CompletionSheet'
import { UpdateBanner } from './components/UpdateBanner'
import { AuthProvider } from './features/auth/AuthProvider'
import { useAuth } from './features/auth/context'
import { Planner } from './features/planner/Planner'
import { startCloudSync, stopCloudSync } from './features/sync/engine'
import { SyncIndicator } from './features/sync/SyncIndicator'
import type { CompletedSession } from './features/timer/types'
import { useTimer } from './features/timer/useTimer'
import { useUpdateManager } from './features/updates/useUpdateManager'
import { formatDuration } from './lib/time'
import { initializeNotifications, reconcileAllNotifications } from './lib/notifications'
import { HistoryPage } from './pages/HistoryPage'
import { ChangelogPage } from './pages/ChangelogPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TasksPage } from './pages/TasksPage'
import { TimeflowPage } from './pages/TimeflowPage'
import './App.css'

export type AppRoute = '/today' | '/history' | '/tasks' | '/planner' | '/reports' | '/settings' | '/changelog'

const routes = new Set<AppRoute>(['/today', '/history', '/tasks', '/planner', '/reports', '/settings', '/changelog'])

function routeFromHash(): AppRoute {
  const route = window.location.hash.slice(1).split('?')[0] as AppRoute
  return routes.has(route) ? route : '/today'
}

const primaryNav: Array<{ route: AppRoute; label: string; icon: typeof Clock3 }> = [
  { route: '/today', label: 'Today', icon: Clock3 },
  { route: '/planner', label: 'Planner', icon: CalendarDays },
  { route: '/tasks', label: 'Tasks', icon: CheckSquare },
  { route: '/reports', label: 'Reports', icon: BarChart3 },
]

function AppContent() {
  useSheetNavigation()
  const appCanvasRef = useRef<HTMLElement>(null)
  const auth = useAuth()
  const authUid = auth.user?.uid
  const timer = useTimer()
  const updates = useUpdateManager()
  const [routeKey, setRouteKey] = useState(window.location.hash)
  const [route, setRoute] = useState<AppRoute>(routeFromHash)
  const [completedReview, setCompletedReview] = useState<CompletedSession | null>(null)
  const [deletedSession, setDeletedSession] = useState<CompletedSession | null>(null)
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    if (auth.status === 'authenticated' && authUid) startCloudSync(authUid)
    else stopCloudSync()
    return () => stopCloudSync()
  }, [auth.status, authUid])

  useEffect(() => {
    if (!routes.has(window.location.hash.slice(1).split('?')[0] as AppRoute)) window.history.replaceState(null, '', '#/today')
    const syncRoute = () => { setRoute(routeFromHash()); setRouteKey(window.location.hash) }
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => { window.removeEventListener('hashchange', syncRoute); window.removeEventListener('popstate', syncRoute) }
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let disposed = false
    const handles: Array<{ remove: () => Promise<void> }> = []
    void Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('keyboard-open')).then((handle) => disposed ? void handle.remove() : handles.push(handle))
    void Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('keyboard-open')).then((handle) => disposed ? void handle.remove() : handles.push(handle))
    return () => { disposed = true; document.body.classList.remove('keyboard-open'); handles.forEach((handle) => void handle.remove()) }
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let disposed = false
    let handle: { remove: () => Promise<void> } | undefined
    void CapacitorApp.addListener('backButton', () => { if (document.querySelector('.completion-sheet, .quick-add-popover, .event-inspector')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); else if (route !== '/today') window.history.back(); else void CapacitorApp.exitApp() }).then((listener) => disposed ? void listener.remove() : handle = listener)
    return () => { disposed = true; if (handle) void handle.remove() }
  }, [route])

  useEffect(() => {
    let disposed = false
    let initialization: { dispose: () => Promise<void> } | undefined
    void initializeNotifications((destination) => {
      if (!disposed) window.location.hash = destination
    }).then((value) => {
      if (disposed) void value.dispose()
      else initialization = value
    }).catch(() => undefined)
    return () => {
      disposed = true
      if (initialization) void initialization.dispose()
    }
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let disposed = false
    let handle: { remove: () => Promise<void> } | undefined
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || disposed) return
      document.dispatchEvent(new Event('iza-app-foreground'))
      void reconcileAllNotifications()
    }).then((listener) => disposed ? void listener.remove() : handle = listener)
    return () => {
      disposed = true
      if (handle) void handle.remove()
    }
  }, [])

  useEffect(() => {
    const onNativeCompletion = (event: Event) => {
      const session = (event as CustomEvent<CompletedSession>).detail
      if (session?.id && session.finishedAt) setCompletedReview(session)
    }
    window.addEventListener('iza-native-completion', onNativeCompletion)
    return () => window.removeEventListener('iza-native-completion', onNativeCompletion)
  }, [])

  useEffect(() => {
    document.documentElement.scrollTop = 0
    if (appCanvasRef.current) appCanvasRef.current.scrollTop = 0
    const names: Record<AppRoute, string> = { '/today': 'Today', '/history': 'History', '/tasks': 'Tasks', '/planner': 'Planner', '/reports': 'Stats', '/settings': 'Me', '/changelog': 'What’s new' }
    document.title = `${names[route]} · Iza`
  }, [route])

  const navigate = useCallback((next: AppRoute) => {
    if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`)
    setRoute(next)
  }, [])

  const finishWithReview = useCallback(() => {
    const session = timer.finish()
    if (session) setCompletedReview(session)
    return session
  }, [timer])

  return (
    <main className="app-canvas" ref={appCanvasRef}>
      <section className="app-shell" id="top">
        <nav className="desktop-rail" aria-label="Primary navigation">
          <button className="rail-mark" type="button" onClick={() => navigate('/today')} aria-label="Iza home">I</button>
          {primaryNav.map(({ route: target, label, icon: Icon }) => <button type="button" key={target} aria-label={`${label} desktop`} onClick={() => navigate(target)} aria-current={route === target || route === '/history' && target === '/reports' ? 'page' : undefined}><Icon /><span>{label}</span></button>)}
          <div className="desktop-rail-secondary">
            <button type="button" aria-label="Settings" onClick={() => navigate('/settings')} aria-current={route === '/settings' ? 'page' : undefined}><UserRound aria-hidden="true" /><span>Settings</span></button>
          </div>
        </nav>

        <div className="app-main">
          <header className="topbar">
            <button className="brand" type="button" onClick={() => navigate('/today')} aria-label="Iza home">Iza</button>
            <span className="tagline">make time feel softer</span>
            <div className="topbar-actions">
              <SyncIndicator />
              <button className="notification-button" type="button" aria-label="Open settings" onClick={() => navigate('/settings')} aria-current={route === '/settings' ? 'page' : undefined}><UserRound aria-hidden="true" /></button>
            </div>
          </header>

          <UpdateBanner state={updates.state} onLater={updates.later} onDownload={() => void updates.download()} onInstall={() => void updates.install()} onOpenInstallSettings={() => void updates.openInstallSettings()} />

          {timer.active && route !== '/today' && <button className="active-session-dock" type="button" onClick={() => navigate('/today')}><span style={{ backgroundColor: timer.active.activity.color }}><Clock3 /></span><span><strong>{timer.active.activity.name}</strong><small>{timer.active.status === 'paused' ? 'Paused' : 'Tracking now'}</small></span><b>{formatDuration(timer.elapsed)}</b></button>}

          <section className="content-panel">
            {route === '/today' && <TimeflowPage onReview={setCompletedReview} {...timer} finish={finishWithReview} />}
            {route === '/history' && <HistoryPage key={routeKey} completed={timer.completed} onEdit={setCompletedReview} onOpenReports={() => navigate('/reports')} />}
            {route === '/tasks' && <TasksPage active={timer.active} onStart={timer.start} />}
            {route === '/planner' && <Planner key={routeKey} active={timer.active} completed={timer.completed} elapsed={timer.elapsed} onFinish={timer.finish} onStart={timer.start} onReview={setCompletedReview} />}
            {route === '/reports' && <ReportsPage completed={timer.completed} onOpenHistory={(date) => { window.history.pushState(null, '', `#/history?date=${date}`); setRoute('/history') }} />}
            {route === '/settings' && <SettingsPage onNavigate={navigate} updates={updates} />}
            {route === '/changelog' && <ChangelogPage onBack={() => navigate('/settings')} />}
          </section>
        </div>

        <nav className="bottom-nav" aria-label="Primary navigation">
          {primaryNav.map(({ route: target, label, icon: Icon }) => <button type="button" key={target} onClick={() => navigate(target)} aria-current={route === target || route === '/history' && target === '/reports' ? 'page' : undefined} aria-label={label}><Icon /><span>{label}</span></button>)}
        </nav>

        {completedReview && <CompletionSheet session={completedReview} onClose={() => setCompletedReview(null)} onDelete={(session) => { timer.deleteCompleted(session.id); setDeletedSession(session); setCompletedReview(null) }} onSave={async (session, patch) => { await timer.updateCompleted(session.id, patch); setCompletedReview(null); setConfirmation('Changes saved'); window.location.hash = `/history?date=${patch.startedAt ? new Date(patch.startedAt).getFullYear() + '-' + String(new Date(patch.startedAt).getMonth() + 1).padStart(2, '0') + '-' + String(new Date(patch.startedAt).getDate()).padStart(2, '0') : ''}&session=${session.id}`; setRoute('/history'); window.setTimeout(() => setConfirmation(''), 3000) }} />}
        {confirmation && <div className="undo-toast" role="status"><span>{confirmation}</span></div>}
        {deletedSession && <div className="undo-toast" role="status"><span>Session deleted</span><button type="button" onClick={() => { timer.restoreCompleted(deletedSession); setDeletedSession(null) }}>Undo</button><button type="button" onClick={() => setDeletedSession(null)} aria-label="Dismiss">×</button></div>}
      </section>
    </main>
  )
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>
}
