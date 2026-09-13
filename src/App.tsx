import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  Clock3,
  Menu,
  Minus,
  Pencil,
  Play,
  Plus,
  Square,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTimer } from './features/timer/useTimer'
import type { Activity } from './features/timer/types'
import { Planner } from './features/planner/Planner'
import { formatCompactDuration, formatDuration, isSameLocalDay, sessionSeconds } from './lib/time'
import './App.css'

type ActivityGroup = 'Focus' | 'Leisure' | 'Others' | 'Rest'

const groups: Record<ActivityGroup, Activity[]> = {
  Focus: [
    { id: 'study', name: 'Study', color: '#d92f6f' },
    { id: 'work', name: 'Work', color: '#dda1aa' },
    { id: 'self-study', name: 'Self-study', color: '#f5c8b8' },
    { id: 'custom', name: 'Custom', color: '#cfd2d2' },
  ],
  Leisure: [
    { id: 'reading', name: 'Reading', color: '#d92f6f' },
    { id: 'games', name: 'Games', color: '#dda1aa' },
    { id: 'music', name: 'Music', color: '#f5c8b8' },
  ],
  Others: [
    { id: 'exercise', name: 'Exercise', color: '#ff8b45' },
    { id: 'errands', name: 'Errands', color: '#dda1aa' },
  ],
  Rest: [
    { id: 'break', name: 'Break', color: '#4d862a' },
    { id: 'sleep', name: 'Sleep', color: '#91bd78' },
  ],
}

const categoryColors: Record<ActivityGroup, string> = {
  Focus: '#915449',
  Leisure: '#d92f6f',
  Others: '#ff8b45',
  Rest: '#4d862a',
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function longDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function App() {
  const { active, completed, elapsed, start, finish } = useTimer()
  const [page, setPage] = useState<'timeflow' | 'calendar'>('timeflow')
  const [mode, setMode] = useState<'flowtime' | 'pomodoro'>('flowtime')
  const [group, setGroup] = useState<ActivityGroup>('Focus')
  const [selected, setSelected] = useState<Activity>(groups.Focus[0])
  const [goal, setGoal] = useState<number | null>(25)

  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [page])
  const todaySessions = useMemo(
    () => completed.filter((session) => isSameLocalDay(session.startedAt)),
    [completed],
  )
  const currentActivity = active?.activity ?? selected

  const selectGroup = (nextGroup: ActivityGroup) => {
    setGroup(nextGroup)
    setSelected(groups[nextGroup][0])
  }

  return (
    <main className="app-canvas">
      <section className="app-shell" id="top">
        <header className="topbar">
          <button className="plain-icon menu-button" type="button" aria-label="Open menu"><Menu /></button>
          <a className="brand" href="#top" aria-label="Iza home"><span>I</span>za</a>
          <button className="notification-button" type="button" aria-label="Notifications">
            <Bell aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </header>

        {page === 'timeflow' && <div className="mode-switch" aria-label="Timer mode">
          <button className={mode === 'flowtime' ? 'selected' : ''} type="button" onClick={() => setMode('flowtime')}>Flowtime</button>
          <button className={mode === 'pomodoro' ? 'selected' : ''} type="button" onClick={() => setMode('pomodoro')}>Pomodoro</button>
        </div>}

        <section className="content-panel">
          {page === 'timeflow' ? <>
          <h1>What are you working on?</h1>

          <section className="timer-scene" aria-label="Timer">
            <div className={`timer-character ${active ? 'running' : ''}`}>
              <span className="ear ear-left" aria-hidden="true" />
              <span className="ear ear-right" aria-hidden="true" />
              <span className="arm arm-left" aria-hidden="true" />
              <span className="arm arm-right" aria-hidden="true" />
              <div className="character-body">
                <span className="sr-only">{active ? `${active.activity.name} in progress` : 'Timer ready'}</span>
                <div className="face" aria-hidden="true">
                  <span className="eye eye-left" />
                  <span className="smile" />
                  <span className="eye eye-right" />
                </div>
                <strong className="character-time" aria-label={`${formatDuration(elapsed)} elapsed`}>{longDuration(elapsed)}</strong>
              </div>
              <button
                className="character-foot stop-foot"
                type="button"
                onClick={finish}
                disabled={!active}
                aria-label="Finish session"
              >
                <Square fill="currentColor" aria-hidden="true" />
              </button>
              <button
                className="character-foot play-foot"
                type="button"
                onClick={() => start(selected)}
                disabled={Boolean(active)}
                aria-label={`Start ${selected.name} session`}
              >
                <Play fill="currentColor" aria-hidden="true" />
              </button>
            </div>

            <div className="timer-options">
              <div className="speech-bubble"><span>{currentActivity.name}</span></div>
              <fieldset className="goal-picker">
                <legend>Set min goal:</legend>
                {[25, 30, 60].map((minutes) => (
                  <button
                    key={minutes}
                    className={goal === minutes ? 'selected' : ''}
                    type="button"
                    onClick={() => setGoal(minutes)}
                    aria-label={`Set ${minutes} minute goal`}
                  >{minutes}</button>
                ))}
                <button className={goal === null ? 'selected no-goal' : 'no-goal'} type="button" onClick={() => setGoal(null)} aria-label="No time goal"><Minus /></button>
              </fieldset>
            </div>
          </section>

          <section className="label-section" aria-labelledby="labels-title">
            <div className="category-tabs" role="tablist" aria-label="Activity categories">
              {(Object.keys(groups) as ActivityGroup[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={group === name}
                  onClick={() => selectGroup(name)}
                  style={{ '--tab-color': categoryColors[name] } as React.CSSProperties}
                >{name}</button>
              ))}
            </div>
            <div className="label-picker">
              <h2 id="labels-title" className="sr-only">{group} labels</h2>
              <div className="label-list">
                {groups[group].map((activity) => (
                  <button
                    key={activity.id}
                    className={selected.id === activity.id ? 'selected' : ''}
                    type="button"
                    onClick={() => setSelected(activity)}
                    aria-label={activity.name}
                  >
                    <span className="label-dot" style={{ backgroundColor: activity.color }} aria-hidden="true">
                      {activity.id === 'custom' && <Plus />}
                    </span>
                    <span>{activity.name}</span>
                  </button>
                ))}
              </div>
              <span className="fake-scrollbar" aria-hidden="true"><i /></span>
            </div>
          </section>

          <section className="quick-labels" aria-labelledby="quick-title">
            <h2 id="quick-title">Quick Labels</h2>
            {todaySessions.length === 0 ? (
              <div className="quick-card empty-quick">
                <div><strong>{selected.name}</strong><span>Ready to track</span></div>
                <button type="button" onClick={() => start(selected)} aria-label={`Start ${selected.name} from quick label`}><Plus /></button>
              </div>
            ) : (
              todaySessions.slice(0, 2).map((session) => (
                <article className="quick-card" key={session.id}>
                  <div className="quick-main">
                    <p><strong style={{ color: session.activity.color }}>{session.activity.name}</strong> <span>(Track)</span></p>
                    <b>{formatCompactDuration(sessionSeconds(session))}</b>
                  </div>
                  <div className="quick-meta">
                    <strong>{timeFormatter.format(new Date(session.startedAt))} - {timeFormatter.format(new Date(session.finishedAt))}</strong>
                    <span>{goal ? 'Min goal reached' : 'Session complete'}</span>
                  </div>
                  <div className="quick-actions" aria-hidden="true"><span><Plus /></span><span><Pencil /></span></div>
                </article>
              ))
            )}
          </section>

          </> : <Planner active={active} completed={completed} elapsed={elapsed} onFinish={finish} onStart={start} />}

          <nav className="bottom-nav" aria-label="Primary navigation">
            <button type="button" className={page === 'timeflow' ? 'active' : ''} onClick={() => setPage('timeflow')} aria-current={page === 'timeflow' ? 'page' : undefined} aria-label="Timeflow timer"><Clock3 /></button>
            <span aria-disabled="true" aria-label="Tasks"><CheckSquare /></span>
            <button type="button" className={page === 'calendar' ? 'active' : ''} onClick={() => setPage('calendar')} aria-current={page === 'calendar' ? 'page' : undefined} aria-label="Planner calendar"><CalendarDays /></button>
            <span aria-disabled="true" aria-label="Reports"><BarChart3 /></span>
          </nav>
        </section>
      </section>
    </main>
  )
}
