import { useState } from 'react'
import { activityGroups } from '../features/activities/catalog'
import type { CompletedSession } from '../features/timer/types'
import { formatCompactDuration, sessionSeconds } from '../lib/time'

type CompletionSheetProps = {
  session: CompletedSession
  onSave: (session: CompletedSession, patch: Pick<CompletedSession, 'activity' | 'note' | 'mood' | 'startedAt' | 'finishedAt'>) => Promise<void>
  onDelete?: (session: CompletedSession) => void
  onClose?: () => void
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function toLocalInput(iso: string) {
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function CompletionSheet({ session, onSave, onDelete, onClose }: CompletionSheetProps) {
  const choices = [activityGroups.Focus[0], activityGroups.Focus[1], activityGroups.Life[0]]
  const [activity, setActivity] = useState(session.activity)
  const [note, setNote] = useState(session.note ?? '')
  const [mood, setMood] = useState<CompletedSession['mood']>(session.mood)
  const [startedAt, setStartedAt] = useState(toLocalInput(session.startedAt))
  const [finishedAt, setFinishedAt] = useState(toLocalInput(session.finishedAt))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (saving) return
    const start = new Date(startedAt)
    const finish = new Date(finishedAt)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(finish.getTime()) || finish <= start) {
      setError('Finish time must be after the start time.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSave(session, { activity, note: note.trim(), mood, startedAt: start.toISOString(), finishedAt: finish.toISOString() })
    } catch {
      setError('Changes could not be saved on this device. Try again.')
      setSaving(false)
    }
  }

  return (
    <div className="completion-backdrop" role="presentation">
      <form className="completion-sheet" aria-label="Complete time log" onSubmit={(event) => { event.preventDefault(); save() }}>
        <header><div><h1>Check your time log</h1><p>Your time is already safely logged.</p></div>{onClose && <button className="sheet-close" type="button" onClick={onClose} aria-label="Close time log">×</button>}</header>
        <section className="session-summary"><span>Session complete</span><strong>{formatCompactDuration(sessionSeconds(session))}</strong><small>{timeFormatter.format(new Date(session.startedAt))} – {timeFormatter.format(new Date(session.finishedAt))}</small></section>
        <fieldset><legend>What were you doing?</legend><p>Pick one or keep the current label.</p><div className="choice-row">{choices.map((choice) => <button type="button" key={choice.id} className={activity.id === choice.id ? 'selected' : ''} onClick={() => setActivity(choice)}>{choice.name}{activity.id === choice.id ? ' ✓' : ''}</button>)}</div></fieldset>
        <label className="note-field"><span>Optional note</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you get done?" /></label>
        <fieldset><legend>Correct the time</legend><div className="datetime-fields"><label>Started<input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label><label>Finished<input type="datetime-local" value={finishedAt} onChange={(event) => setFinishedAt(event.target.value)} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}</fieldset>
        <fieldset><legend>How did it feel?</legend><div className="choice-row moods">{(['calm', 'focused', 'tired'] as const).map((choice) => <button type="button" key={choice} className={mood === choice ? 'selected' : ''} onClick={() => setMood(choice)}>{choice === 'calm' ? '☁' : choice === 'focused' ? '✦' : '☕'} {choice}</button>)}</div></fieldset>
        <button className="save-log" type="submit" disabled={saving}>{saving ? 'Saving changes…' : 'Save changes'}</button>
        {onDelete && (!confirmDelete ? <button className="delete-log" type="button" onClick={() => setConfirmDelete(true)}>Delete this session</button> : <div className="confirm-delete"><span>Delete this session?</span><button type="button" onClick={() => setConfirmDelete(false)}>Keep it</button><button type="button" onClick={() => onDelete(session)}>Delete</button></div>)}
      </form>
    </div>
  )
}
