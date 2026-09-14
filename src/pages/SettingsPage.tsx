import { BellRing, CalendarDays, CheckSquare, Database, Smartphone } from 'lucide-react'
import type { AppRoute } from '../App'

export function SettingsPage({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <section className="hora-page me-page">
      <header className="hora-page-heading"><h1>Your gentle corner</h1><p>Plan what helps. Keep the rest simple.</p></header>
      <section className="profile-card"><span>P</span><div><strong>Peter</strong><small>Student plan · local-first</small></div></section>
      <h2>Planning tools</h2>
      <div className="tool-links"><button type="button" onClick={() => onNavigate('/planner')}><CalendarDays /><span><strong>Open planner</strong><small>Plan blocks beside actual time</small></span></button><button type="button" onClick={() => onNavigate('/tasks')}><CheckSquare /><span><strong>Open tasks</strong><small>Keep the next step close</small></span></button></div>
      <h2>App status</h2>
      <div className="settings-list"><article><Smartphone /><div><strong>Android app</strong><span>Capacitor shell configured</span></div><b>Ready</b></article><article><Database /><div><strong>Offline data</strong><span>Saved on this device first</span></div><b>Local</b></article><article><BellRing /><div><strong>Goal reminders</strong><span>Native integration is next</span></div><b>Next</b></article></div>
    </section>
  )
}
