import { useEffect, useMemo, useState } from 'react'
import type { CompletedSession } from '../features/timer/types'
import { formatCompactDuration, sessionSeconds } from '../lib/time'
import type { PlannedBlock } from '../features/planner/types'
import { db, migrateLegacyLocalStorage } from '../lib/db'

const insightColors = ['#d9547c', '#e9dfff', '#ffc8b3', '#bfe8d4']

export function ReportsPage({ completed }: { completed: CompletedSession[] }) {
  const [planned, setPlanned] = useState<PlannedBlock[]>([])
  useEffect(() => {
    let cancelled = false
    void migrateLegacyLocalStorage().then(() => db.plannedBlocks.toArray()).then((blocks) => { if (!cancelled) setPlanned(blocks) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const summary = useMemo(() => {
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const isThisWeek = (timestamp: string) => {
      const date = new Date(timestamp)
      return date >= weekStart && date < weekEnd
    }
    const sessions = completed.filter((session) => isThisWeek(session.startedAt))
    const byActivity = new Map<string, number>()
    const byDay = Array(7).fill(0) as number[]
    sessions.forEach((session) => {
      const seconds = sessionSeconds(session)
      byActivity.set(session.activity.name, (byActivity.get(session.activity.name) ?? 0) + seconds)
      const day = (new Date(session.startedAt).getDay() + 6) % 7
      byDay[day] += seconds
    })
    const plannedSeconds = planned.filter((block) => isThisWeek(block.startedAt)).reduce((sum, block) => sum + Math.max(0, (new Date(block.finishedAt).getTime() - new Date(block.startedAt).getTime()) / 1000), 0)
    return { total: sessions.reduce((sum, session) => sum + sessionSeconds(session), 0), rows: [...byActivity.entries()].sort((a, b) => b[1] - a[1]), byDay, sessionCount: sessions.length, plannedSeconds }
  }, [completed, planned])
  const maxDay = Math.max(...summary.byDay, 1)
  let segmentStart = 0
  const donutFill = summary.total ? summary.rows.slice(0, 4).map(([, seconds], index) => {
    const start = segmentStart
    segmentStart += seconds / summary.total * 100
    return `${insightColors[index]} ${start}% ${segmentStart}%`
  }).join(', ') : '#f2e7e4 0 100%'

  return (
    <section className="hora-page insights-page">
      <header className="hora-page-heading"><h1>Where your time went</h1><p>Only time you actually tracked appears here.</p></header>
      <section className="report-comparison"><span><small>Planned this week</small><strong>{formatCompactDuration(summary.plannedSeconds)}</strong></span><span><small>Actually tracked</small><strong>{formatCompactDuration(summary.total)}</strong></span></section>
      <section className="weekly-chart"><header><h2>This week</h2><strong>{formatCompactDuration(summary.total)}</strong></header><p>{summary.sessionCount ? `From ${summary.sessionCount} completed ${summary.sessionCount === 1 ? 'session' : 'sessions'}` : 'Finish a session to see your week'}</p><div>{summary.byDay.map((seconds, index) => <span key={index}><i style={{ height: `${Math.max(14, seconds / maxDay * 88)}px` }} /><small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</small></span>)}</div></section>
      <section className="time-breakdown"><h2>Actual time by activity</h2><div className="donut" style={{ '--donut-fill': donutFill } as React.CSSProperties}><span><strong>{formatCompactDuration(summary.total)}</strong></span></div><div className="breakdown-list">{summary.rows.length ? summary.rows.slice(0, 4).map(([name, seconds], index) => <p key={name}><i style={{ background: insightColors[index] }} /><span>{name}</span><b>{Math.round(seconds / summary.total * 100)}%</b></p>) : <p><span>No sessions yet</span><b>0%</b></p>}</div><small>{summary.total ? 'Calculated from your completed Timeflow sessions.' : 'Start and finish a Timeflow session first.'}</small></section>
    </section>
  )
}
