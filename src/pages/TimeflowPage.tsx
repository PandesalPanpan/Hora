import { Pause, Play, Plus, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import clockMascot from '../assets/hora-clock.png'
import { activityGroups, categoryColors, type ActivityGroup } from '../features/activities/catalog'
import type { ActiveSession, Activity, CompletedSession } from '../features/timer/types'
import type { TimerStartOptions } from '../features/timer/useTimer'
import { formatCompactDuration, isSameLocalDay, sessionSeconds } from '../lib/time'

type TimeflowPageProps = {
  active: ActiveSession | null
  completed: CompletedSession[]
  elapsed: number
  start: (activity: Activity, targetMinutes?: number | null, options?: TimerStartOptions) => void
  pause: () => void
  resume: () => void
  setTargetMinutes: (targetMinutes: number | null) => void
  acknowledgeTarget: () => void
  advancePomodoro: () => CompletedSession | undefined
  finish: () => CompletedSession | undefined
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function fullClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds % 3600 / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

export function TimeflowPage({ active, completed, elapsed, start, pause, resume, setTargetMinutes, acknowledgeTarget, advancePomodoro, finish }: TimeflowPageProps) {
  const [group, setGroup] = useState<ActivityGroup>('Focus')
  const [selected, setSelected] = useState<Activity>(activityGroups.Focus[0])
  const [goal, setGoal] = useState<number | null>(25)
  const [mode, setMode] = useState<'flowtime' | 'pomodoro'>('flowtime')
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const todaySessions = useMemo(() => completed.filter((session) => isSameLocalDay(session.startedAt)), [completed])
  const currentActivity = active?.activity ?? selected
  const currentGoal = active ? active.targetMinutes ?? null : goal
  const effectiveMode = active?.timerMode ?? mode
  const goalReached = Boolean(active && currentGoal && elapsed >= currentGoal * 60 && !active.targetAcknowledged)
  const pomodoroRemaining = Math.max(0, (active?.targetMinutes ?? focusMinutes) * 60 - (active ? elapsed : 0))

  const chooseGoal = (minutes: number) => {
    if (active) setTargetMinutes(minutes)
    else setGoal(minutes)
  }

  const selectGroup = (nextGroup: ActivityGroup) => setGroup(nextGroup)

  const startCurrent = () => {
    if (mode === 'pomodoro') {
      start(selected, focusMinutes, {
        timerMode: 'pomodoro',
        pomodoro: { phase: 'focus', round: 1, focusMinutes, breakMinutes, focusActivity: selected },
      })
      return
    }
    start(selected, goal, { timerMode: 'flowtime' })
  }

  return (
    <section className="today-page">
      <div className="mode-switch" aria-label="Timer mode">
        <button className={effectiveMode === 'flowtime' ? 'selected' : ''} type="button" aria-pressed={effectiveMode === 'flowtime'} onClick={() => !active && setMode('flowtime')}>Flowtime</button>
        <button className={effectiveMode === 'pomodoro' ? 'selected' : ''} type="button" aria-pressed={effectiveMode === 'pomodoro'} onClick={() => !active && setMode('pomodoro')}>Pomodoro</button>
      </div>

      <div className="today-layout">
        <div className="timer-column">
          <h1>{effectiveMode === 'pomodoro' ? 'A tiny focus sprint ✦' : active ? 'Stay with this one thing ♡' : `Ready for ${selected.name}?`}</h1>

          {effectiveMode === 'pomodoro' ? (
            <section className="pomodoro-card" aria-label="Pomodoro timer">
              <span className="live-kicker">{active?.pomodoro ? `${active.pomodoro.phase === 'focus' ? 'Focus' : 'Break'} · ${active.pomodoro.round} of 4` : 'Four gentle focus rounds'}</span>
              {!active && <div className="pomodoro-settings"><label>Focus<input aria-label="Focus minutes" type="number" min="1" max="180" value={focusMinutes} onChange={(event) => setFocusMinutes(Math.max(1, Number(event.target.value) || 1))} /></label><label>Break<input aria-label="Break minutes" type="number" min="1" max="60" value={breakMinutes} onChange={(event) => setBreakMinutes(Math.max(1, Number(event.target.value) || 1))} /></label></div>}
              <div className="pomodoro-ring"><strong aria-label={`${pomodoroRemaining} seconds remaining`}>{String(Math.floor(pomodoroRemaining / 60)).padStart(2, '0')}:{String(pomodoroRemaining % 60).padStart(2, '0')}</strong><span>{currentActivity.name}</span></div>
              {goalReached && active?.pomodoro ? (
                <div className="timer-actions milestone-actions">
                  <button type="button" onClick={acknowledgeTarget}>{active.pomodoro.phase === 'focus' ? 'Keep focusing' : 'Keep resting'}</button>
                  <button className="primary" type="button" onClick={advancePomodoro}>{active.pomodoro.phase === 'focus' ? 'Start break' : active.pomodoro.round >= 4 ? 'Finish cycle' : 'Next focus'}</button>
                </div>
              ) : (
                <div className="timer-actions">
                  {!active ? <button className="primary" type="button" onClick={startCurrent} aria-label={`Start ${selected.name} Pomodoro`}><Play fill="currentColor" />Start focus</button> : <>
                    <button type="button" onClick={active.status === 'paused' ? resume : pause} aria-label={active.status === 'paused' ? 'Resume session' : 'Pause session'}>{active.status === 'paused' ? <Play fill="currentColor" /> : <Pause />} {active.status === 'paused' ? 'Resume' : 'Pause'}</button>
                    <button className="primary" type="button" onClick={finish} aria-label="Finish session"><Square fill="currentColor" />End</button>
                  </>}
                </div>
              )}
              <small>{active?.pomodoro?.phase === 'break' ? `Next: focus round ${Math.min(4, active.pomodoro.round + 1)}` : `Next: ${active?.pomodoro?.breakMinutes ?? breakMinutes} min soft break`}</small>
            </section>
          ) : active ? (
            <section className="live-timer-card" aria-label="Timer">
              <span className="live-kicker">{goalReached ? 'Goal reached · keep going' : active.status === 'paused' ? 'Flowtime paused' : 'Live flowtime'}</span>
              <img src={clockMascot} alt="Iza clock character" />
              <strong className="timer-digits" aria-label={`${fullClock(elapsed)} elapsed`}>{fullClock(elapsed)}</strong>
              <small>started {timeFormatter.format(new Date(active.startedAt))}</small>
              <span className="active-label"><i style={{ background: currentActivity.color }} />{currentActivity.name}</span>
              <div className="timer-actions">
                <button type="button" onClick={active.status === 'paused' ? resume : pause} aria-label={active.status === 'paused' ? 'Resume session' : 'Pause session'}>{active.status === 'paused' ? <Play fill="currentColor" /> : <Pause />} {active.status === 'paused' ? 'Resume' : 'Pause'}</button>
                <button className="primary" type="button" onClick={finish} aria-label="Finish session"><Square fill="currentColor" />Stop & log</button>
              </div>
            </section>
          ) : (
            <section className="ready-timer-card" aria-label="Timer">
              <span className="activity-chip">{selected.name}</span>
              <img src={clockMascot} alt="Iza clock character" />
              <div className="ready-controls">
                <strong className="timer-digits">00:00:00</strong>
                <small>minimum goal</small>
                <div className="goal-row">{[25, 30, 60].map((minutes) => <button key={minutes} className={currentGoal === minutes ? 'selected' : ''} type="button" onClick={() => chooseGoal(minutes)} aria-label={`Set ${minutes} minute goal`}>{minutes}</button>)}</div>
                <button className="start-flowtime" type="button" onClick={startCurrent} aria-label={`Start ${selected.name} session`}><Play fill="currentColor" />Start flowtime</button>
              </div>
            </section>
          )}

          <section className="vibe-picker" aria-labelledby="vibe-title">
            <h2 id="vibe-title">Choose an activity</h2>
            <div>{(Object.keys(activityGroups) as ActivityGroup[]).map((name) => <button type="button" key={name} aria-pressed={group === name} onClick={() => selectGroup(name)} style={{ '--vibe': categoryColors[name] } as React.CSSProperties}>{name}</button>)}</div>
            <div className="activity-pills" aria-label={`${group} activities`}>{activityGroups[group].map((activity) => <button type="button" key={activity.id} className={selected.id === activity.id ? 'selected' : ''} onClick={() => setSelected(activity)} disabled={Boolean(active)}>{activity.name}</button>)}</div>
          </section>
        </div>

        <aside className="today-side">
          <section className="quick-label-card">
            <h2>Quick start</h2>
            <div><strong>{todaySessions[0]?.activity.name ?? selected.name}</strong>{todaySessions[0] && <time>{timeFormatter.format(new Date(todaySessions[0].startedAt))} – {timeFormatter.format(new Date(todaySessions[0].finishedAt))}</time>}</div>
            <p>{todaySessions.length ? `${formatCompactDuration(todaySessions.reduce((sum, session) => sum + sessionSeconds(session), 0))} today` : 'Ready when you are'}</p>
            <button type="button" onClick={startCurrent} disabled={Boolean(active)} aria-label={`Start ${selected.name} from quick label`}><Plus /></button>
          </section>
          <section className="today-summary"><span>Today</span><strong>{formatCompactDuration(todaySessions.reduce((sum, session) => sum + sessionSeconds(session), 0))}</strong><small>{todaySessions.length} {todaySessions.length === 1 ? 'session' : 'sessions'}</small><i><b style={{ width: `${Math.min(100, todaySessions.reduce((sum, session) => sum + sessionSeconds(session), 0) / 21600 * 100)}%` }} /></i></section>
          <section className="recent-card"><h2>Recent sessions</h2>{todaySessions.slice(0, 2).map((session) => <div key={session.id}><span>{session.activity.name}</span><b style={{ background: session.activity.color }}>{formatCompactDuration(sessionSeconds(session))}</b></div>)}{todaySessions.length === 0 && <p>Completed sessions will appear here.</p>}</section>
        </aside>
      </div>
    </section>
  )
}
