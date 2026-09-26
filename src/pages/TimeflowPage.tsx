import { ActivityManager } from '../features/activities/ActivityManager'
import { ensureActivities } from '../features/activities/repository'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useCurrentOwnerId } from '../lib/ownership'
import { todayFeed } from '../features/planner/todayFeed'
import { localDateKey } from '../features/reports/period'
import { CalendarDays, ChevronRight, Pause, Play, SlidersHorizontal, Square } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import clockMascot from '../assets/hora-clock.png'
import { activityGroups, categoryColors, type ActivityGroup } from '../features/activities/catalog'
import { mixHexColors, readableColorForeground } from '../features/activities/color'
import type { ActiveSession, Activity, CompletedSession } from '../features/timer/types'
import type { TimerStartOptions } from '../features/timer/useTimer'
import { formatCompactDuration, isSameLocalDay, sessionSeconds } from '../lib/time'

type TimeflowPageProps = {
  onReview: (session: CompletedSession) => void
  active: ActiveSession | null
  completed: CompletedSession[]
  elapsed: number
  start: (activity: Activity, targetMinutes?: number | null, options?: TimerStartOptions) => void
  pause: () => void
  resume: () => void
  setTargetMinutes: (targetMinutes: number | null) => void
  setNote: (note: string) => void
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

export function TimeflowPage({ onReview, active, completed, elapsed, start, pause, resume, setTargetMinutes, setNote, acknowledgeTarget, advancePomodoro, finish }: TimeflowPageProps) {
  const ownerId = useCurrentOwnerId()
  const presets = useLiveQuery(() => db.activities.where('ownerId').equals(ownerId).filter(activity => !activity.deletedAt).sortBy('order'), [ownerId])
  const [manage, setManage] = useState(false)
  const [activityError, setActivityError] = useState('')
  useEffect(() => { void ensureActivities().catch(() => setActivityError('Activities could not be loaded. Reopen Today to try again.')) }, [])
  const plans = useLiveQuery(() => db.plannedBlocks.where('ownerId').equals(ownerId).filter(block => !block.deletedAt).toArray(), [ownerId]) ?? []
  const feed = todayFeed(active, completed, plans, new Date(), 3, presets ?? [])
  const [group, setGroup] = useState<ActivityGroup>('Focus')
  const [selected, setSelected] = useState<Activity>(activityGroups.Focus[0])
  const [goal, setGoal] = useState<number | null>(25)
  const [mode, setMode] = useState<'flowtime' | 'pomodoro'>('flowtime')
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [pomodoroRounds, setPomodoroRounds] = useState(4)
  const [focusDraft, setFocusDraft] = useState('25')
  const [breakDraft, setBreakDraft] = useState('5')
  const [roundsDraft, setRoundsDraft] = useState('4')
  const todaySessions = useMemo(() => completed.filter((session) => isSameLocalDay(session.startedAt)), [completed])
  const selectedPreset = presets?.find(item => item.id === selected.id && !item.archived) ?? presets?.find(item => !item.archived) ?? selected
  const currentActivity = active?.activity ?? selectedPreset
  const currentGoal = active ? active.targetMinutes ?? null : goal
  const effectiveMode = active?.timerMode ?? mode
  const goalReached = Boolean(active && currentGoal && elapsed >= currentGoal * 60 && !active.targetAcknowledged)
  const pomodoroRemaining = Math.max(0, (active?.targetMinutes ?? focusMinutes) * 60 - (active ? elapsed : 0))
  const totalRounds = active?.pomodoro?.totalRounds ?? pomodoroRounds

  const chooseGoal = (minutes: number) => {
    if (active) setTargetMinutes(minutes)
    else setGoal(minutes)
  }

  const selectGroup = (nextGroup: ActivityGroup) => setGroup(nextGroup)

  const commitNumber = (draft: string, minimum: number, maximum: number, fallback: number, setDraft: (value: string) => void, setValue: (value: number) => void) => {
    const parsed = Number(draft)
    const value = Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) && draft.trim() ? Math.round(parsed) : fallback))
    setDraft(String(value)); setValue(value)
    return value
  }

  const commitPomodoro = () => ({
    focus: commitNumber(focusDraft, 1, 180, focusMinutes, setFocusDraft, setFocusMinutes),
    rest: commitNumber(breakDraft, 1, 60, breakMinutes, setBreakDraft, setBreakMinutes),
    rounds: commitNumber(roundsDraft, 1, 8, pomodoroRounds, setRoundsDraft, setPomodoroRounds),
  })

  const startCurrent = () => {
    if (mode === 'pomodoro') {
      const values = commitPomodoro()
      start(selectedPreset, values.focus, {
        timerMode: 'pomodoro',
        pomodoro: { phase: 'focus', round: 1, focusMinutes: values.focus, breakMinutes: values.rest, totalRounds: values.rounds, focusActivity: selectedPreset },
      })
      return
    }
    start(selectedPreset, goal, { timerMode: 'flowtime' })
  }

  return (
    <section className="today-page">
      {manage && <ActivityManager onClose={() => setManage(false)} />}
      <div className="mode-switch" aria-label="Timer mode">
        <button className={effectiveMode === 'flowtime' ? 'selected' : ''} type="button" aria-pressed={effectiveMode === 'flowtime'} onClick={() => !active && setMode('flowtime')}>Flowtime</button>
        <button className={effectiveMode === 'pomodoro' ? 'selected' : ''} type="button" aria-pressed={effectiveMode === 'pomodoro'} onClick={() => !active && setMode('pomodoro')}>Pomodoro</button>
      </div>

      <div className="today-layout">
        <div className="timer-column">
          <h1>{effectiveMode === 'pomodoro' ? (active ? 'A tiny focus sprint ✦' : `Ready for ${selectedPreset.name}?`) : active ? 'Stay with this one thing ♡' : `Ready for ${selectedPreset.name}?`}</h1>

          {effectiveMode === 'pomodoro' ? (
            <section className="pomodoro-card" aria-label="Pomodoro timer">
              <span className="live-kicker">{active?.pomodoro ? `${active.pomodoro.phase === 'focus' ? 'Focus' : 'Break'} · ${active.pomodoro.round} of ${totalRounds}` : `${pomodoroRounds} gentle focus ${pomodoroRounds === 1 ? 'round' : 'rounds'}`}</span>
              {!active ? <div className="pomodoro-settings"><label>Focus<input aria-label="Focus minutes" inputMode="numeric" type="number" min="1" max="180" value={focusDraft} onChange={(event) => setFocusDraft(event.target.value)} onBlur={() => commitNumber(focusDraft,1,180,focusMinutes,setFocusDraft,setFocusMinutes)} onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} /></label><label>Break<input aria-label="Break minutes" inputMode="numeric" type="number" min="1" max="60" value={breakDraft} onChange={(event) => setBreakDraft(event.target.value)} onBlur={() => commitNumber(breakDraft,1,60,breakMinutes,setBreakDraft,setBreakMinutes)} onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} /></label><label>Rounds<input aria-label="Focus rounds" inputMode="numeric" type="number" min="1" max="8" value={roundsDraft} onChange={(event) => setRoundsDraft(event.target.value)} onBlur={() => commitNumber(roundsDraft,1,8,pomodoroRounds,setRoundsDraft,setPomodoroRounds)} onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} /></label></div> : <div className="pomodoro-settings"><p>{active.pomodoro?.phase === 'break' ? 'Break' : 'Focus'} · Round {active.pomodoro?.round ?? 1} of {totalRounds}{active.status === 'paused' ? ' · Paused' : ''}</p></div>}
              <div className="pomodoro-ring"><strong aria-label={`${pomodoroRemaining} seconds remaining`}>{String(Math.floor(pomodoroRemaining / 60)).padStart(2, '0')}:{String(pomodoroRemaining % 60).padStart(2, '0')}</strong><span>{currentActivity.name}</span></div>
              {goalReached && active?.pomodoro ? (
                <div className="timer-actions milestone-actions">
                  <button type="button" onClick={acknowledgeTarget}>{active.pomodoro.phase === 'focus' ? 'Keep focusing' : 'Keep resting'}</button>
                  <button className="primary" type="button" onClick={advancePomodoro}>{active.pomodoro.phase === 'focus' ? 'Start break' : active.pomodoro.round >= totalRounds ? 'Finish cycle' : 'Next focus'}</button>
                </div>
              ) : (
                <div className="timer-actions">
                  {!active ? <button className="primary" type="button" onClick={startCurrent} aria-label={`Start ${selectedPreset.name} Pomodoro`}><Play fill="currentColor" />Start focus</button> : <>
                    <button type="button" onClick={active.status === 'paused' ? resume : pause} aria-label={`${active.status === 'paused' ? 'Resume' : 'Pause'} ${active.pomodoro?.phase === 'break' ? 'break' : 'focus'}`}>{active.status === 'paused' ? <Play fill="currentColor" /> : <Pause />} {active.status === 'paused' ? 'Resume' : 'Pause'} {active.pomodoro?.phase === 'break' ? 'break' : 'focus'}</button>
                    <button className="primary" type="button" onClick={finish} aria-label={`Finish ${active.pomodoro?.phase === 'break' ? 'break' : 'focus'}`}><Square fill="currentColor" />Finish {active.pomodoro?.phase === 'break' ? 'break' : 'focus'}</button>
                  </>}
                </div>
              )}
              <small>{active?.pomodoro?.phase === 'break' ? (active.pomodoro.round >= totalRounds ? 'Next: finish this cycle' : `Next: focus round ${active.pomodoro.round + 1}`) : `Next: ${active?.pomodoro?.breakMinutes ?? breakMinutes} min soft break`}</small>
            </section>
          ) : active ? (
            <section className="live-timer-card" aria-label="Timer">
              <span className="live-kicker">{goalReached ? 'Goal reached · keep going' : active.status === 'paused' ? 'Flowtime paused' : 'Live flowtime'}</span>
<img src={clockMascot} alt="Hora clock character" />
              <strong className="timer-digits" aria-label={`${fullClock(elapsed)} elapsed`}>{fullClock(elapsed)}</strong>
              <small>started {timeFormatter.format(new Date(active.startedAt))}</small>
              <span className="active-label"><i style={{ background: currentActivity.color }} />{currentActivity.name}</span>
              <div className="active-goal-controls" role="group" aria-label="Time goal">
                <span aria-live="polite">{active.targetMinutes ? `Goal ${active.targetMinutes} min` : 'No time goal'}</span>
                {[25, 30, 60].map((minutes) => <button key={minutes} type="button" className={active.targetMinutes === minutes ? 'selected' : ''} aria-pressed={active.targetMinutes === minutes} onClick={() => setTargetMinutes(minutes)} aria-label={`Change goal to ${minutes} minutes`}>{minutes}</button>)}
                {active.targetMinutes && <button type="button" onClick={() => setTargetMinutes(null)}>Remove goal</button>}
              </div>
              <div className="timer-actions">
                <button type="button" onClick={active.status === 'paused' ? resume : pause} aria-label={active.status === 'paused' ? 'Resume session' : 'Pause session'}>{active.status === 'paused' ? <Play fill="currentColor" /> : <Pause />} {active.status === 'paused' ? 'Resume' : 'Pause'}</button>
                <button className="primary" type="button" onClick={finish} aria-label="Finish session"><Square fill="currentColor" />Stop & log</button>
              </div>
            </section>
          ) : (
            <section className="ready-timer-card" aria-label="Timer" style={{ borderColor: selectedPreset.color }}>
<img src={clockMascot} alt="Hora clock character" />
              <div className="ready-controls">
                <strong className="timer-digits">00:00:00</strong>
                <small>Time goal</small>
                <div className="goal-row" role="group" aria-label="Choose a time goal">{[25, 30, 60].map((minutes) => <button key={minutes} className={currentGoal === minutes ? 'selected' : ''} type="button" aria-pressed={currentGoal === minutes} onClick={() => chooseGoal(minutes)} aria-label={`Set ${minutes} minute goal`}>{minutes}</button>)}</div>
                <small className="goal-selection" aria-live="polite">Goal {currentGoal} min · reaching it won’t stop Flowtime.</small>
                <button className="start-flowtime" type="button" onClick={startCurrent} aria-label={`Start ${selectedPreset.name} session`}><Play fill="currentColor" />Start flowtime</button>
              </div>
            </section>
          )}

          {active && <label className="active-note-editor"><span>Session note <small>Optional</small></span><textarea value={active.note ?? ''} onChange={(event) => setNote(event.target.value)} placeholder="What are you working on?" /></label>}

          <section className="vibe-picker" aria-labelledby="vibe-title">
            <header className="activity-picker-heading"><div><h2 id="vibe-title">Choose an activity</h2><p>Your timer uses the activity you select below.</p></div><button type="button" onClick={() => setManage(true)} aria-label="Manage activities"><SlidersHorizontal /></button></header>{activityError && <p role="alert">{activityError}</p>}
            <span className="filter-label">Filter activities</span><div aria-label="Filter activities">{(Object.keys(activityGroups) as ActivityGroup[]).map((name) => <button type="button" key={name} aria-label={name} aria-pressed={group === name} onClick={() => selectGroup(name)} style={{ '--vibe': categoryColors[name] } as React.CSSProperties}>{name}{group === name ? ' ✓' : ''}</button>)}</div>
            <p className="filter-summary">Showing {group.toLocaleLowerCase()} activities</p><div className="activity-pills" aria-label={`${group} activities`}>{(presets ? presets.filter(preset => preset.category === group && !preset.archived) : activityGroups[group].filter(activity => activity.id !== 'custom')).map((activity) => <button type="button" key={activity.id} aria-label={activity.name} aria-pressed={selectedPreset.id === activity.id} className={selectedPreset.id === activity.id ? 'selected' : ''} onClick={() => setSelected(activity)} disabled={Boolean(active)}>{activity.name}{selectedPreset.id === activity.id ? ' ✓' : ''}</button>)}</div>{active && <p>Finish this session to choose another activity.</p>}
          </section>
        </div>

        <aside className="today-side">
          <section className="today-feed">
            <h2>Today so far</h2>
            {feed.map((row) => {
              const duration = row.kind === 'Live' ? elapsed : row.durationSeconds
              return <button
                className={`today-feed-row ${row.kind.toLowerCase()}`}
                type="button"
                key={row.id}
                style={{ '--feed-color': row.color, '--feed-badge-foreground': readableColorForeground(mixHexColors(row.color, '#FFFFFF', 0.25) ?? '#FFFFFF') } as React.CSSProperties}
                onClick={() => { if (row.session) onReview(row.session); else if (row.kind === 'Live') { document.querySelector<HTMLElement>('.timer-column')?.scrollIntoView({ block: 'start' }); document.querySelector<HTMLButtonElement>('.timer-actions button')?.focus() } else window.location.hash = row.destination }}
              >
                <i aria-hidden="true" />
                <div>
                  <time>{row.kind} · {timeFormatter.format(new Date(row.startedAt))}</time>
                  <strong>{row.title}</strong>
                  {row.note && <small>{row.note}</small>}
                </div>
                {duration !== undefined && <b>{formatCompactDuration(duration)}</b>}
              </button>
            })}
            {!feed.length && <p>Choose an activity in the timer above to begin your day.</p>}
            <button className="today-card-action" type="button" onClick={() => { window.location.hash = `#/planner?view=day&date=${localDateKey(new Date())}` }}><CalendarDays /><span>View full day</span><ChevronRight /></button>
          </section>
          <section className="today-summary"><span>Today</span><strong>{formatCompactDuration(todaySessions.reduce((sum, session) => sum + sessionSeconds(session), 0))}</strong><small>{todaySessions.length} {todaySessions.length === 1 ? 'session' : 'sessions'}</small><i><b style={{ width: `${Math.min(100, todaySessions.reduce((sum, session) => sum + sessionSeconds(session), 0) / 21600 * 100)}%` }} /></i></section>

        </aside>
      </div>
    </section>
  )
}
