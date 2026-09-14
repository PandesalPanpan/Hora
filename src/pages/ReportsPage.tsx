import { useMemo } from 'react'
import type { CompletedSession } from '../features/timer/types'
import { formatCompactDuration, sessionSeconds } from '../lib/time'

const insightColors = ['#d9547c', '#e9dfff', '#ffc8b3', '#bfe8d4']

export function ReportsPage({ completed }: { completed: CompletedSession[] }) {
  const summary = useMemo(() => {
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
    const sessions = completed.filter((session) => new Date(session.startedAt) >= weekStart)
    const byActivity = new Map<string, number>()
    const byDay = Array(7).fill(0) as number[]
    sessions.forEach((session) => {
      const seconds = sessionSeconds(session)
      byActivity.set(session.activity.name, (byActivity.get(session.activity.name) ?? 0) + seconds)
      const day = (new Date(session.startedAt).getDay() + 6) % 7
      byDay[day] += seconds
    })
    return { total: sessions.reduce((sum, session) => sum + sessionSeconds(session), 0), rows: [...byActivity.entries()].sort((a, b) => b[1] - a[1]), byDay }
  }, [completed])
  const maxDay = Math.max(...summary.byDay, 1)

  return (
    <section className="hora-page insights-page">
      <header className="hora-page-heading"><h1>Little wins add up ✦</h1><p>Small blocks of time still count.</p></header>
      <section className="streak-card"><span aria-hidden="true">🔥</span><div><strong>{completed.length ? `${Math.min(7, completed.length)} day rhythm` : 'Your rhythm starts here'}</strong><small>Your best yet. Keep it gentle.</small></div></section>
      <section className="weekly-chart"><header><h2>This week</h2><strong>{formatCompactDuration(summary.total)}</strong></header><p>{summary.total ? '+12% from your recent pace' : 'Track a session to start the story'}</p><div>{summary.byDay.map((seconds, index) => <span key={index}><i style={{ height: `${Math.max(14, seconds / maxDay * 88)}px` }} /><small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</small></span>)}</div></section>
      <section className="time-breakdown"><h2>Where your time went</h2><div className="donut" style={{ '--donut-fill': summary.total ? '#bfe8d4 0 46%, #ffd5df 46% 80%, #e9dfff 80% 92%, #ffc8b3 92%' : '#f2e7e4 0 100%' } as React.CSSProperties}><span><strong>{formatCompactDuration(summary.total)}</strong></span></div><div className="breakdown-list">{summary.rows.length ? summary.rows.slice(0, 4).map(([name, seconds], index) => <p key={name}><i style={{ background: insightColors[index] }} /><span>{name}</span><b>{Math.round(seconds / summary.total * 100)}%</b></p>) : <p><span>No sessions yet</span><b>0%</b></p>}</div><small>You protected {formatCompactDuration(summary.total)} for what mattered ♡</small></section>
    </section>
  )
}
