import { localDateKey } from '../features/reports/period'
import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { CompletedSession } from '../features/timer/types'
import { formatCompactDuration, isSameLocalDay, sessionSeconds } from '../lib/time'
import { mixHexColors, readableColorForeground } from '../features/activities/color'

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function HistoryPage({ completed, onEdit, onOpenReports }: { completed: CompletedSession[]; onEdit: (session: CompletedSession) => void; onOpenReports: () => void }) {
  const [selectedDate, setSelectedDate] = useState(() => { const value = new URLSearchParams(window.location.hash.split('?')[1]).get('date'); return value ? new Date(`${value}T12:00:00`) : new Date() })
  const selectedIsToday = isSameLocalDay(selectedDate.toISOString(), new Date())
  const today = useMemo(() => completed.filter((session) => isSameLocalDay(session.startedAt, selectedDate)), [completed, selectedDate])
  const total = today.reduce((sum, session) => sum + sessionSeconds(session), 0)
  const weekStart = new Date(selectedDate)
  const weekday = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (weekday === 0 ? 6 : weekday - 1))
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + index)
    return date
  })

  return (
    <section className="hora-page history-page">
      <header className="hora-page-heading">
        <h1>Your time, kept gently</h1>
        <p>A little story of what your day held.</p>
      </header>
      <div className="report-view-switch" aria-label="Reports views"><button type="button" aria-pressed="false" onClick={onOpenReports}>Overview</button><button type="button" className="selected" aria-pressed="true">History</button></div>

      <div className="history-date-strip" aria-label="Recent dates">
        {dates.map((date) => {
          const selected = date.toDateString() === selectedDate.toDateString()
          return <button type="button" key={date.toISOString()} className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => { setSelectedDate(date); window.history.replaceState(null, '', `#/history?date=${localDateKey(date)}`) }}><span>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span><strong>{date.getDate()}</strong></button>
        })}
      </div>

      <section className="today-total">
        <span>{selectedIsToday ? 'Today’s total' : 'Selected day total'}</span>
        <strong>{formatCompactDuration(total)}</strong>
        <small>{today.length} {today.length === 1 ? 'session' : 'sessions'} · your real tracked time</small>
      </section>

      <div className="history-timeline-heading"><div><h2>Timeline</h2><span>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div><label className="history-date-picker"><CalendarDays aria-hidden="true"/><span className="sr-only">Choose history date</span><input aria-label="Choose history date" type="date" value={localDateKey(selectedDate)} onChange={event => { if (event.target.value) { const date = new Date(`${event.target.value}T12:00:00`); setSelectedDate(date); window.history.replaceState(null, '', `#/history?date=${localDateKey(date)}`) } }} /></label></div>
      <div className="history-timeline">
        {today.length === 0 ? (
          <div className="soft-empty"><strong>Your day is still open</strong><span>Finished sessions will settle here.</span></div>
        ) : today.map((session) => (
          <button type="button" className="history-session" aria-current={new URLSearchParams(window.location.hash.split('?')[1]).get('session') === session.id ? 'true' : undefined} key={session.id} style={{ '--session-color': session.activity.color, '--session-badge-foreground': readableColorForeground(mixHexColors(session.activity.color, '#FFFFFF', 0.32) ?? '#FFFFFF') } as React.CSSProperties} onClick={() => onEdit(session)} aria-label={`Edit ${session.activity.name} time log`}>
            <i aria-hidden="true" />
            <div><time>{timeFormatter.format(new Date(session.startedAt))}</time><strong>{session.activity.name}</strong>{session.note && <span>{session.note}</span>}</div>
            <b>{formatCompactDuration(sessionSeconds(session))}</b>
          </button>
        ))}
      </div>
    </section>
  )
}
