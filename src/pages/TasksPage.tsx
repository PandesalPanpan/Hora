import { Check, Circle, GripVertical, MoreVertical, Play, Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Activity, ActiveSession } from '../features/timer/types'
import type { TimerStartOptions } from '../features/timer/useTimer'
import type { Task } from '../features/tasks/types'
import { db, migrateLegacyLocalStorage } from '../lib/db'
import { useCurrentOwnerId } from '../lib/ownership'

type TasksPageProps = { active: ActiveSession | null; onStart: (activity: Activity, targetMinutes?: number | null, options?: TimerStartOptions) => void }
export function TasksPage({ active, onStart }: TasksPageProps) {
  const ownerId = useCurrentOwnerId()
  const tasks = useLiveQuery(() => db.tasks.where('ownerId').equals(ownerId).filter(task => !task.deletedAt).toArray(), [ownerId]) ?? []
  const [title, setTitle] = useState('')
  const [view, setView] = useState<'open' | 'completed'>('open')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(30)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState<Task | null>(null)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [menu, setMenu] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragTarget, setDragTarget] = useState<{ id: string; after: boolean } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ title: string; detail: string; left: number; top: number; width: number } | null>(null)
  const open = tasks.filter(task => !task.completed).sort((a,b) => (a.priorityOrder ?? 0) - (b.priorityOrder ?? 0) || a.id.localeCompare(b.id))
  useEffect(() => { void migrateLegacyLocalStorage().catch(() => setError('Tasks could not be loaded. Reopen this page to try again.')) }, [])
  useEffect(() => { if (!deleted) return; const timeout = setTimeout(() => setDeleted(null), 8000); return () => clearTimeout(timeout) }, [deleted])
  const run = async (action: () => Promise<unknown>) => { if (locked.current) return; locked.current = true; setBusy(true); try { await action(); setError('') } catch { setError('Tasks could not be saved on this device. Try again.') } finally { locked.current = false; setBusy(false) } }
  const save = (task: Task) => db.transaction('rw', db.tasks, db.outbox, db.syncTombstones, async () => db.tasks.put({ ...task, ownerId: task.ownerId ?? ownerId, updatedAt: new Date().toISOString() }))
  const move = (id: string, target: string, placeAfter = false) => run(async () => {
    const ordered = open.filter(task => task.id !== id); const moving = open.find(task => task.id === id)
    if (!moving) return
    const targetIndex = Math.max(0, ordered.findIndex(task => task.id === target))
    ordered.splice(placeAfter ? targetIndex + 1 : targetIndex,0,moving)
    await db.transaction('rw', db.tasks, db.outbox, db.syncTombstones, async () => { for (const [priorityOrder, task] of ordered.entries()) await db.tasks.update(task.id,{ priorityOrder }) })
  })
  const reorderable = view === 'open' && !query.trim()
  const pointTarget = (clientX: number, clientY: number, movingId: string) => {
    const row = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-task-id]')
    if (!row?.dataset.taskId || row.dataset.taskId === movingId) return null
    return { id: row.dataset.taskId, after: clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 }
  }
  const autoScroll = (clientY: number) => {
    const scroller = document.querySelector<HTMLElement>('.app-canvas')
    if (!scroller) return
    if (clientY < 84) scroller.scrollBy({ top: -14, behavior: 'auto' })
    else if (clientY > window.innerHeight - 104) scroller.scrollBy({ top: 14, behavior: 'auto' })
  }
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, task: Task) => {
    const row = event.currentTarget.closest<HTMLElement>('[data-task-id]')
    if (!row) return
    const rect = row.getBoundingClientRect()
    setMenu(null); setDragging(task.id); setDragTarget(null)
    setDragPreview({ title: task.title, detail: task.estimateMinutes ? `${task.estimateMinutes} minute focus target` : 'No estimate', left: rect.left, top: rect.top, width: rect.width })
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const updateDrag = (event: React.PointerEvent<HTMLButtonElement>, task: Task) => {
    if (dragging !== task.id) return
    const row = event.currentTarget.closest<HTMLElement>('[data-task-id]')
    if (!row) return
    const rect = row.getBoundingClientRect()
    setDragPreview(preview => preview ? { ...preview, left: event.clientX - rect.width / 2, top: event.clientY - rect.height / 2 } : null)
    setDragTarget(pointTarget(event.clientX, event.clientY, task.id))
    autoScroll(event.clientY)
  }
  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>, task: Task) => {
    const target = pointTarget(event.clientX, event.clientY, task.id) ?? dragTarget
    setDragging(null); setDragTarget(null); setDragPreview(null)
    if (target) void move(task.id, target.id, target.after)
  }
  const results = tasks.filter(task => query.trim() ? `${task.title} ${task.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) : task.completed === (view === 'completed')).sort((a,b) => Number(a.completed)-Number(b.completed) || (a.completed ? (b.completedAt ?? b.updatedAt ?? '').localeCompare(a.completedAt ?? a.updatedAt ?? '') : (a.priorityOrder ?? 0)-(b.priorityOrder ?? 0)))
  const shown = results.slice(0, query || view === 'completed' ? limit : undefined)
  return <section className="feature-page tasks-page">
    <header className="feature-heading"><div><p>Your next steps</p><h1>Tasks</h1></div><span>{open.length} open</span></header>
    <form className="task-composer" onSubmit={event => { event.preventDefault(); if (!title.trim()) return; void run(async () => { const now = new Date().toISOString(); await save({ id: crypto.randomUUID(), title: title.trim(), estimateMinutes: null, priorityOrder: Math.max(-1,...open.map(task => task.priorityOrder ?? 0))+1, completed: false, completedAt: null, createdAt: now, updatedAt: now }); setTitle('') }) }}><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Add a task" aria-label="New task"/><button type="submit" aria-label="Add task" disabled={busy}><Plus /></button></form>
    <div className="task-view-switch">{(['open','completed'] as const).map(value => <button type="button" key={value} aria-pressed={view === value} className={view === value ? 'selected' : ''} onClick={() => { setView(value); setQuery(''); setLimit(30); setMenu(null) }}>{value === 'open' ? 'Open' : 'Completed'}</button>)}</div>
    <label className="task-search"><Search aria-hidden="true"/><input aria-label="Search tasks and notes" type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(30); setMenu(null) }} placeholder="Search tasks and notes"/></label>
    {error && <p role="alert">{error}</p>}
    {!shown.length && <p>No {query ? 'matching' : view} tasks. Add a task above when you need one.</p>}
    <div className="task-list">{shown.map(task => <article key={task.id} data-task-id={task.id} className={`task-row ${task.completed ? 'completed' : ''} ${dragging === task.id ? 'dragging' : ''} ${dragTarget?.id === task.id ? (dragTarget.after ? 'drop-after' : 'drop-before') : ''}`}>
      <div className="task-row-content"><strong>{task.title}</strong><span>{task.estimateMinutes ? `${task.estimateMinutes} minute focus target` : 'No estimate'}{query && ` · ${task.completed ? 'Completed' : 'Open'}`}</span>{task.description && <small>{task.description}</small>}</div>
      <div className="task-row-actions">
        <button type="button" className="task-check" disabled={busy} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`} onClick={() => void run(() => save({ ...task, completed: !task.completed, completedAt: task.completed ? null : new Date().toISOString(), priorityOrder: task.completed ? open.length : task.priorityOrder }))}>{task.completed ? <Check/> : <Circle/>}</button>
        {reorderable && !task.completed ? <button type="button" className="task-drag-handle" aria-label={`Drag ${task.title} to reorder`} disabled={busy} onPointerDown={event => startDrag(event,task)} onPointerMove={event => updateDrag(event,task)} onPointerUp={event => finishDrag(event,task)} onPointerCancel={() => { setDragging(null); setDragTarget(null); setDragPreview(null) }}><GripVertical /></button> : <span className="task-drag-slot" aria-hidden="true" />}
        <button type="button" className="task-menu-trigger" aria-label={`Actions for ${task.title}`} aria-expanded={menu === task.id} onClick={() => setMenu(menu === task.id ? null : task.id)}><MoreVertical /></button>
        <button type="button" className="task-start" disabled={Boolean(active) || task.completed} onClick={() => onStart({ id: `task-${task.id}`, name: task.title, color: '#d92f6f' },task.estimateMinutes ?? null,{ taskId: task.id, taskTitleSnapshot: task.title, timerMode: 'flowtime' })} aria-label={`Start ${task.title}`}><Play fill="currentColor"/></button>
      </div>
      {menu === task.id && <div className="task-row-menu"><button type="button" onClick={() => { setMenu(null); setEditing(task); setDeleting(false) }}>Edit task</button>{reorderable && !task.completed && <><button type="button" disabled={busy || open[0]?.id === task.id} onClick={() => { setMenu(null); void move(task.id,open[Math.max(0,open.findIndex(item => item.id === task.id)-1)].id) }}>Move up</button><button type="button" disabled={busy || open.at(-1)?.id === task.id} onClick={() => { setMenu(null); void move(task.id,open[Math.min(open.length-1,open.findIndex(item => item.id === task.id)+1)].id,true) }}>Move down</button></>}</div>}
    </article>)}</div>
    {dragPreview && <div className="pointer-drag-preview task-drag-preview" aria-hidden="true" style={{ left: dragPreview.left, top: dragPreview.top, width: dragPreview.width }}><GripVertical/><div><strong>{dragPreview.title}</strong><small>{dragPreview.detail}</small></div></div>}
    {shown.length < results.length && <button className="history-day-link" type="button" onClick={() => setLimit(limit+30)}>Load more completed tasks</button>}
    {editing && <div className="completion-backdrop"><form className="completion-sheet" aria-label="Edit task" onSubmit={event => { event.preventDefault(); void run(async () => { await save({ ...editing, title: editing.title.trim() }); setEditing(null) }) }}><header><h1>Edit task</h1><button className="sheet-close" type="button" onClick={() => setEditing(null)} aria-label="Close task">×</button></header><label className="note-field">Title<input required value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })}/></label><label className="note-field">Notes<textarea value={editing.description ?? ''} onChange={event => setEditing({ ...editing, description: event.target.value })}/></label><label className="note-field">Focus estimate<select value={editing.estimateMinutes == null ? 'none' : [15,25,30,60].includes(editing.estimateMinutes) ? String(editing.estimateMinutes) : 'custom'} onChange={event => setEditing({ ...editing, estimateMinutes: event.target.value === 'none' ? null : event.target.value === 'custom' ? 45 : Number(event.target.value) })}><option value="none">No estimate</option>{[15,25,30,60].map(value => <option key={value} value={value}>{value} minutes</option>)}<option value="custom">Custom duration</option></select></label>{editing.estimateMinutes != null && <label className="note-field">Minutes<input type="number" required min="1" max="1440" value={editing.estimateMinutes} onChange={event => setEditing({ ...editing, estimateMinutes: Number(event.target.value) })}/></label>}
      {error && <p role="alert">{error}</p>}<button className="save-log" disabled={busy}>Save task</button>{!deleting ? <button className="delete-log" type="button" onClick={() => setDeleting(true)}>Delete task</button> : <div className="confirm-delete"><span>Delete this task? Tracked sessions will stay.</span><button type="button" onClick={() => setDeleting(false)}>Keep task</button><button type="button" disabled={busy} onClick={() => void run(async () => { await db.transaction('rw', db.tasks, db.sessions, db.outbox, db.syncTombstones, async () => { await db.sessions.where('ownerId').equals(ownerId).filter(session => session.taskId === editing.id).modify(session => { session.taskTitleSnapshot ??= editing.title }); await db.tasks.delete(editing.id) }); setDeleted(editing); setEditing(null) })}>Confirm delete</button></div>}
    </form></div>}
    {deleted && <div className="undo-toast" role="status"><span>Task deleted</span><button type="button" disabled={busy} onClick={() => void run(async () => { await save(deleted); setDeleted(null) })}>Undo</button></div>}
  </section>
}
