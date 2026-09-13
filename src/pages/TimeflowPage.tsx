import { Minus, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { IzaCharacter } from '../components/IzaCharacter'
import { activityGroups, categoryColors, type ActivityGroup } from '../features/activities/catalog'
import type { ActiveSession, Activity, CompletedSession } from '../features/timer/types'
import { formatCompactDuration, isSameLocalDay, sessionSeconds } from '../lib/time'

type TimeflowPageProps = {
  active: ActiveSession | null
  completed: CompletedSession[]
  elapsed: number
  start: (activity: Activity, targetMinutes?: number | null) => void
  pause: () => void
  resume: () => void
  finish: () => void
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function TimeflowPage({ active, completed, elapsed, start, pause, resume, finish }: TimeflowPageProps) {
  const [mode, setMode] = useState<'flowtime' | 'pomodoro'>('flowtime')
  const [group, setGroup] = useState<ActivityGroup>('Focus')
  const [selected, setSelected] = useState<Activity>(activityGroups.Focus[0])
  const [goal, setGoal] = useState<number | null>(25)
  const todaySessions = useMemo(() => completed.filter((session) => isSameLocalDay(session.startedAt)), [completed])
  const currentActivity = active?.activity ?? selected
  const currentGoal = active ? active.targetMinutes ?? null : goal
  const goalReached = Boolean(active && currentGoal && elapsed >= currentGoal * 60)

  const selectGroup = (nextGroup: ActivityGroup) => {
    setGroup(nextGroup)
    setSelected(activityGroups[nextGroup][0])
  }

  return <>
    <div className="mode-switch" aria-label="Timer mode">
      <button className={mode === 'flowtime' ? 'selected' : ''} type="button" onClick={() => setMode('flowtime')}>Flowtime</button>
      <button className={mode === 'pomodoro' ? 'selected' : ''} type="button" onClick={() => setMode('pomodoro')}>Pomodoro</button>
    </div>

    <div className="timeflow-layout">
      <div className="timeflow-primary">
        <h1>What are you working on?</h1>
        <section className={`timer-scene ${goalReached ? 'goal-reached' : ''}`} aria-label="Timer">
          <IzaCharacter
            active={active}
            activity={selected}
            elapsed={elapsed}
            goalReached={goalReached}
            onFinish={finish}
            onPause={pause}
            onResume={resume}
            onStart={() => start(selected, goal)}
          />
          <div className="timer-options">
            <div className="speech-bubble"><span>{goalReached ? 'Goal reached—keep going!' : active?.status === 'paused' ? `${currentActivity.name} is paused` : currentActivity.name}</span></div>
            <fieldset className="goal-picker" disabled={Boolean(active)}>
              <legend>Set min goal:</legend>
              {[25, 30, 60].map((minutes) => (
                <button key={minutes} className={goal === minutes ? 'selected' : ''} type="button" onClick={() => setGoal(minutes)} aria-label={`Set ${minutes} minute goal`}>{minutes}</button>
              ))}
              <button className={goal === null ? 'selected no-goal' : 'no-goal'} type="button" onClick={() => setGoal(null)} aria-label="No time goal"><Minus /></button>
            </fieldset>
          </div>
        </section>

        <section className="label-section" aria-labelledby="labels-title">
          <div className="category-tabs" role="tablist" aria-label="Activity categories">
            {(Object.keys(activityGroups) as ActivityGroup[]).map((name) => (
              <button key={name} type="button" role="tab" aria-selected={group === name} onClick={() => selectGroup(name)} style={{ '--tab-color': categoryColors[name] } as React.CSSProperties}>{name}</button>
            ))}
          </div>
          <div className="label-picker">
            <h2 id="labels-title" className="sr-only">{group} labels</h2>
            <div className="label-list">
              {activityGroups[group].map((activity) => (
                <button key={activity.id} className={selected.id === activity.id ? 'selected' : ''} type="button" onClick={() => setSelected(activity)} aria-label={activity.name} disabled={Boolean(active)}>
                  <span className="label-dot" style={{ backgroundColor: activity.color }} aria-hidden="true">{activity.id === 'custom' && <Plus />}</span>
                  <span>{activity.name}</span>
                </button>
              ))}
            </div>
            <span className="fake-scrollbar" aria-hidden="true"><i /></span>
          </div>
        </section>
      </div>

      <section className="quick-labels" aria-labelledby="quick-title">
        <h2 id="quick-title">Today’s Timeflow</h2>
        {todaySessions.length === 0 ? (
          <div className="quick-card empty-quick">
            <div><strong>{selected.name}</strong><span>Ready when you are</span></div>
            <button type="button" onClick={() => start(selected, goal)} disabled={Boolean(active)} aria-label={`Start ${selected.name} from quick label`}><Plus /></button>
          </div>
        ) : todaySessions.slice(0, 4).map((session) => {
          const reached = Boolean(session.targetMinutes && sessionSeconds(session) >= session.targetMinutes * 60)
          return (
            <article className="quick-card" key={session.id}>
              <div className="quick-main"><p><strong style={{ color: session.activity.color }}>{session.activity.name}</strong> <span>Timeflow</span></p><b>{formatCompactDuration(sessionSeconds(session))}</b></div>
              <div className="quick-meta"><strong>{timeFormatter.format(new Date(session.startedAt))} - {timeFormatter.format(new Date(session.finishedAt))}</strong><span>{reached ? 'Goal reached' : 'Session complete'}</span></div>
              <div className="quick-actions" aria-hidden="true"><span><Plus /></span><span><Pencil /></span></div>
            </article>
          )
        })}
      </section>
    </div>
  </>
}

