import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CompletedSession } from '../features/timer/types'
import { formatCompactDuration, sessionSeconds } from '../lib/time'
import type { PlannedBlock } from '../features/planner/types'
import { db, migrateLegacyLocalStorage } from '../lib/db'
import { localDateKey, reportWeek, startOfLocalWeek } from '../features/reports/period'

const colors = ['#d9547c', '#e9a6b8', '#ffc8b3', '#91bd78']
export function ReportsPage({ completed, onOpenHistory }: { completed: CompletedSession[]; onOpenHistory: (date: string) => void }) {
  const [planned, setPlanned] = useState<PlannedBlock[]>([])
  const today = useMemo(() => new Date(), [])
  const currentWeek = useMemo(() => startOfLocalWeek(today), [today])
  const [weekStart, setWeekStart] = useState(currentWeek)
  const [selectedKey, setSelectedKey] = useState(localDateKey(today))
  useEffect(() => { let cancelled = false; void migrateLegacyLocalStorage().then(() => db.plannedBlocks.toArray()).then((value) => { if (!cancelled) setPlanned(value) }).catch(() => undefined); return () => { cancelled = true } }, [])
  const summary = useMemo(() => reportWeek(completed, planned, weekStart), [completed, planned, weekStart])
  const selectedIndex = Math.max(0, summary.days.findIndex((day) => localDateKey(day) === selectedKey))
  const selectedSessions = summary.sessions.filter((item) => localDateKey(new Date(item.startedAt)) === selectedKey)
  const byActivity = new Map<string, number>(); selectedSessions.forEach((item) => byActivity.set(item.activity.name, (byActivity.get(item.activity.name) ?? 0) + sessionSeconds(item)))
  const breakdown = [...byActivity.entries()].sort((a, b) => b[1] - a[1]); const max = Math.max(...summary.actualByDay, 1)
  const moveWeek = (amount: number) => { const next = new Date(weekStart); next.setDate(next.getDate() + amount * 7); setWeekStart(next); setSelectedKey(localDateKey(next)) }
  return <section className="hora-page insights-page">
    <header className="hora-page-heading"><h1>Where your time went</h1><p>Planned intention and completed Timeflow stay separate.</p></header>
    <div className="report-view-switch" aria-label="Reports views"><button type="button" className="selected" aria-pressed="true">Overview</button><button type="button" aria-pressed="false" onClick={() => onOpenHistory(selectedKey)}>History</button></div>
    <div className="report-week-nav"><button type="button" onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft /></button><strong>{weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {summary.days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong><button type="button" onClick={() => moveWeek(1)} disabled={weekStart >= currentWeek} aria-label="Next week"><ChevronRight /></button></div>
    <section className="report-comparison"><span><small>Planned this week</small><strong>{formatCompactDuration(summary.plannedTotal)}</strong></span><span><small>Actually tracked</small><strong>{formatCompactDuration(summary.actualTotal)}</strong></span></section>
    <section className="weekly-chart"><header><h2>Select a day</h2><strong>{formatCompactDuration(summary.actualTotal)}</strong></header><div className="report-day-strip">{summary.days.map((day, index) => <button type="button" key={localDateKey(day)} aria-pressed={localDateKey(day) === selectedKey} className={localDateKey(day) === selectedKey ? 'selected' : ''} onClick={() => setSelectedKey(localDateKey(day))} aria-label={`Show ${day.toLocaleDateString(undefined, { dateStyle: 'full' })}`}><i style={{ height: summary.actualByDay[index] ? `${summary.actualByDay[index] / max * 88}px` : '0' }} /><small>{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</small></button>)}</div></section>
    <section className="time-breakdown"><h2>{summary.days[selectedIndex].toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2><div className="report-comparison"><span><small>Planned</small><strong>{formatCompactDuration(summary.plannedByDay[selectedIndex])}</strong></span><span><small>Actually tracked</small><strong>{formatCompactDuration(summary.actualByDay[selectedIndex])}</strong></span></div><p className="report-session-count">{selectedSessions.length} completed {selectedSessions.length === 1 ? 'session' : 'sessions'}</p>{breakdown.length ? <div className="breakdown-list">{breakdown.map(([name, seconds], index) => <p key={name}><i style={{ background: colors[index % colors.length] }} /><span>{name}</span><b>{formatCompactDuration(seconds)}</b></p>)}</div> : <div className="soft-empty"><strong>No tracked time</strong><span>Finished Timeflow sessions for this day will appear here.</span></div>}<button className="history-day-link" type="button" onClick={() => onOpenHistory(selectedKey)}>View this day in History</button></section>
  </section>
}
