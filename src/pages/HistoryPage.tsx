import { useMemo } from 'react'
import type { CompletedSession } from '../features/timer/types'
import { formatCompactDuration, isSameLocalDay, sessionSeconds } from '../lib/time'

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function HistoryPage({ completed }: { completed: CompletedSession[] }) {
  const today = useMemo(() => completed.filter((session) => isSameLocalDay(session.startedAt)), [completed])
  const total = today.reduce((sum, session) => sum + sessionSeconds(session), 0)
  const dates = Array.from({ length: 5 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index - 3)
    return date
  })

  return (
    <section className="hora-page history-page">
      <header className="hora-page-heading">
        <h1>Your time, kept gently</h1>
        <p>A little story of what your day held.</p>
      </header>

      <div className="history-date-strip" aria-label="Recent dates">
        {dates.map((date) => {
          const selected = date.toDateString() === new Date().toDateString()
          return <button type="button" key={date.toISOString()} className={selected ? 'selected' : ''} aria-pressed={selected}><span>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span><strong>{date.getDate()}</strong></button>
        })}
      </div>

      <section className="today-total">
        <span>Today’s total</span>
        <strong>{formatCompactDuration(total)}</strong>
        <small>{today.length} {today.length === 1 ? 'session' : 'sessions'} · your real tracked time</small>
      </section>

      <h2>Timeline</h2>
      <div className="history-timeline">
        {today.length === 0 ? (
          <div className="soft-empty"><strong>Your day is still open</strong><span>Finished sessions will settle here.</span></div>
        ) : today.map((session) => (
          <article key={session.id} style={{ '--session-color': session.activity.color } as React.CSSProperties}>
            <i aria-hidden="true" />
            <div><time>{timeFormatter.format(new Date(session.startedAt))}</time><strong>{session.activity.name}</strong>{session.note && <span>{session.note}</span>}</div>
            <b>{formatCompactDuration(sessionSeconds(session))}</b>
          </article>
        ))}
      </div>
    </section>
  )
}
