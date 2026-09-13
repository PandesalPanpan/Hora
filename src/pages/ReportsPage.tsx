import { useMemo } from 'react'
import { IzaCharacter } from '../components/IzaCharacter'
import type { CompletedSession } from '../features/timer/types'
import { formatCompactDuration, sessionSeconds } from '../lib/time'

export function ReportsPage({ completed }: { completed: CompletedSession[] }) {
  const summary = useMemo(() => {
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
    const sessions = completed.filter((session) => new Date(session.startedAt) >= weekStart)
    const byActivity = new Map<string, { color: string; seconds: number }>()
    sessions.forEach((session) => {
      const current = byActivity.get(session.activity.name) ?? { color: session.activity.color, seconds: 0 }
      current.seconds += sessionSeconds(session)
      byActivity.set(session.activity.name, current)
    })
    return { total: sessions.reduce((sum, session) => sum + sessionSeconds(session), 0), rows: [...byActivity.entries()].sort((a, b) => b[1].seconds - a[1].seconds) }
  }, [completed])
  const max = Math.max(...summary.rows.map(([, value]) => value.seconds), 1)

  return (
    <section className="feature-page reports-page">
      <header className="feature-heading"><div><p>Where your time went</p><h1>This week</h1></div><strong className="report-total">{formatCompactDuration(summary.total)}</strong></header>
      {summary.rows.length === 0 ? (
        <div className="character-empty-state"><IzaCharacter compact mood="resting" /><div><h2>Your week is still open</h2><p>Finished Timeflow sessions will build a clear picture here.</p></div></div>
      ) : (
        <div className="report-list">
          {summary.rows.map(([name, value]) => (
            <article className="report-row" key={name}>
              <div><strong>{name}</strong><span>{formatCompactDuration(value.seconds)}</span></div>
              <span className="report-track"><i style={{ width: `${Math.max(8, value.seconds / max * 100)}%`, backgroundColor: value.color }} /></span>
            </article>
          ))}
        </div>
      )}
      <section className="report-note"><h2>Planned and actual stay separate</h2><p>Calendar blocks show your intention. These totals use only time you actually tracked.</p></section>
    </section>
  )
}

