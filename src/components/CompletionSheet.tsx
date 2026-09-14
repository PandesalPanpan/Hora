import { useState } from 'react'
import { activityGroups } from '../features/activities/catalog'
import type { CompletedSession } from '../features/timer/types'
import { formatCompactDuration, sessionSeconds } from '../lib/time'

type CompletionSheetProps = {
  session: CompletedSession
  onSave: (session: CompletedSession, patch: Pick<CompletedSession, 'activity' | 'note' | 'mood'>) => void
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function CompletionSheet({ session, onSave }: CompletionSheetProps) {
  const choices = [activityGroups.Focus[0], activityGroups.Focus[1], activityGroups.Life[0]]
  const [activity, setActivity] = useState(session.activity)
  const [note, setNote] = useState(session.note ?? '')
  const [mood, setMood] = useState<CompletedSession['mood']>(session.mood)

  return (
    <div className="completion-backdrop" role="presentation">
      <form className="completion-sheet" aria-label="Complete time log" onSubmit={(event) => { event.preventDefault(); onSave(session, { activity, note: note.trim(), mood }) }}>
        <header><h1>Nice work, that counts ♡</h1><p>Your time is already safely logged.</p></header>
        <section className="session-summary"><span>Session complete</span><strong>{formatCompactDuration(sessionSeconds(session))}</strong><small>{timeFormatter.format(new Date(session.startedAt))} – {timeFormatter.format(new Date(session.finishedAt))}</small></section>
        <fieldset><legend>What were you doing?</legend><p>Pick one or keep the current label.</p><div className="choice-row">{choices.map((choice) => <button type="button" key={choice.id} className={activity.id === choice.id ? 'selected' : ''} onClick={() => setActivity(choice)}>{choice.name}{activity.id === choice.id ? ' ✓' : ''}</button>)}</div></fieldset>
        <label className="note-field"><span>Optional note</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you get done?" /></label>
        <fieldset><legend>How did it feel?</legend><div className="choice-row moods">{(['calm', 'focused', 'tired'] as const).map((choice) => <button type="button" key={choice} className={mood === choice ? 'selected' : ''} onClick={() => setMood(choice)}>{choice === 'calm' ? '☁' : choice === 'focused' ? '✦' : '☕'} {choice}</button>)}</div></fieldset>
        <button className="save-log" type="submit">Save time log</button>
      </form>
    </div>
  )
}
