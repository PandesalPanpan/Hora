import { BarChart3, Bell, CalendarDays, CheckSquare, Clock3, Menu, Settings, X } from 'lucide-react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { useCallback, useEffect, useState } from 'react'
import { Planner } from './features/planner/Planner'
import { useTimer } from './features/timer/useTimer'
import { formatDuration } from './lib/time'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TasksPage } from './pages/TasksPage'
import { TimeflowPage } from './pages/TimeflowPage'
import './App.css'

type AppRoute = '/today' | '/tasks' | '/planner' | '/reports' | '/settings'

const routes = new Set<AppRoute>(['/today', '/tasks', '/planner', '/reports', '/settings'])

function routeFromHash(): AppRoute {
  const route = window.location.hash.slice(1) as AppRoute
  return routes.has(route) ? route : '/today'
}

export default function App() {
  const timer = useTimer()
  const [route, setRoute] = useState<AppRoute>(routeFromHash)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#/today')
    const syncRoute = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let disposed = false
    const handles: Array<{ remove: () => Promise<void> }> = []

    void Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('keyboard-open')).then((handle) => {
      if (disposed) void handle.remove()
      else handles.push(handle)
    })
    void Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('keyboard-open')).then((handle) => {
      if (disposed) void handle.remove()
      else handles.push(handle)
    })

    return () => {
      disposed = true
      document.body.classList.remove('keyboard-open')
      handles.forEach((handle) => void handle.remove())
    }
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let disposed = false
    let handle: { remove: () => Promise<void> } | undefined
    void CapacitorApp.addListener('backButton', () => {
      if (menuOpen) setMenuOpen(false)
      else if (route !== '/today') window.history.back()
      else void CapacitorApp.exitApp()
    }).then((listener) => {
      if (disposed) void listener.remove()
      else handle = listener
    })
    return () => {
      disposed = true
      if (handle) void handle.remove()
    }
  }, [menuOpen, route])

  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const names: Record<AppRoute, string> = { '/today': 'Timeflow', '/tasks': 'Tasks', '/planner': 'Planner', '/reports': 'Reports', '/settings': 'Settings' }
    document.title = `${names[route]} · Iza`
  }, [route])

  const navigate = useCallback((next: AppRoute) => {
    if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`)
    setRoute(next)
    setMenuOpen(false)
  }, [])

  return (
    <main className="app-canvas">
      <section className="app-shell" id="top">
        <header className="topbar">
          <button className="plain-icon menu-button" type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu /></button>
          <button className="brand" type="button" onClick={() => navigate('/today')} aria-label="Iza home"><span>I</span>za</button>
          <button className="notification-button" type="button" aria-label="Notifications"><Bell aria-hidden="true" /><span aria-hidden="true" /></button>
        </header>

        {timer.active && route !== '/today' && (
          <button className="active-session-dock" type="button" onClick={() => navigate('/today')}>
            <span style={{ backgroundColor: timer.active.activity.color }}><Clock3 /></span>
            <span><strong>{timer.active.activity.name}</strong><small>{timer.active.status === 'paused' ? 'Paused' : 'Tracking now'}</small></span>
            <b>{formatDuration(timer.elapsed)}</b>
          </button>
        )}

        <section className="content-panel">
          {route === '/today' && <TimeflowPage {...timer} />}
          {route === '/tasks' && <TasksPage active={timer.active} onStart={timer.start} />}
          {route === '/planner' && <Planner active={timer.active} completed={timer.completed} elapsed={timer.elapsed} onFinish={timer.finish} onStart={timer.start} />}
          {route === '/reports' && <ReportsPage completed={timer.completed} />}
          {route === '/settings' && <SettingsPage />}

          <nav className="bottom-nav" aria-label="Primary navigation">
            <button type="button" onClick={() => navigate('/today')} aria-current={route === '/today' ? 'page' : undefined} aria-label="Timeflow timer"><Clock3 /><span>Timeflow</span></button>
            <button type="button" onClick={() => navigate('/tasks')} aria-current={route === '/tasks' ? 'page' : undefined} aria-label="Tasks"><CheckSquare /><span>Tasks</span></button>
            <button type="button" onClick={() => navigate('/planner')} aria-current={route === '/planner' ? 'page' : undefined} aria-label="Planner calendar"><CalendarDays /><span>Planner</span></button>
            <button type="button" onClick={() => navigate('/reports')} aria-current={route === '/reports' ? 'page' : undefined} aria-label="Reports"><BarChart3 /><span>Reports</span></button>
          </nav>
        </section>

        {menuOpen && (
          <div className="menu-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}>
            <aside className="app-menu" aria-label="App menu">
              <header><span className="brand-static"><i>I</i>za</span><button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button></header>
              <p>Plan gently. Track honestly.</p>
              <button type="button" onClick={() => navigate('/today')}><Clock3 />Timeflow</button>
              <button type="button" onClick={() => navigate('/planner')}><CalendarDays />Planner</button>
              <button type="button" onClick={() => navigate('/settings')}><Settings />Settings</button>
              <small>Local-first preview · Android ready</small>
            </aside>
          </div>
        )}
      </section>
    </main>
  )
}
