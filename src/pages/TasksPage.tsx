import { Check, Circle, Play, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { IzaCharacter } from '../components/IzaCharacter'
import type { Activity, ActiveSession } from '../features/timer/types'
import type { TimerStartOptions } from '../features/timer/useTimer'
import type { Task } from '../features/tasks/types'
import { db, legacyKeys, migrateLegacyLocalStorage } from '../lib/db'
import { useEffect } from 'react'

type TasksPageProps = { active: ActiveSession | null; onStart: (activity: Activity, targetMinutes?: number | null, options?: TimerStartOptions) => void }
const TASKS_KEY = legacyKeys.TASKS_KEY

function loadTasks(): Task[] {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY) ?? '[]') as Task[] } catch { return [] }
}

export function TasksPage({ active, onStart }: TasksPageProps) {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [title, setTitle] = useState('')
  const [view, setView] = useState<'open' | 'completed'>('open')
  const [query, setQuery] = useState('')
  const [visibleCompleted, setVisibleCompleted] = useState(30)
  const [error, setError] = useState('')
  const openCount = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks])

  useEffect(() => {
    let cancelled = false
    void migrateLegacyLocalStorage().then(() => db.tasks.toArray()).then((stored) => {
      if (!cancelled) setTasks(stored.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')))
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const persist = async (next: Task[]) => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(next))
    setTasks(next)
    try { await db.tasks.bulkPut(next); setError('') } catch { setError('Tasks could not be saved on this device. Try again.') }
  }
  const addTask = () => {
    if (!title.trim()) return
    const now = new Date().toISOString()
    void persist([...tasks, { id: crypto.randomUUID(), title: title.trim(), estimateMinutes: null, priorityOrder: openCount, completed: false, completedAt: null, createdAt: now, updatedAt: now }])
    setTitle('')
  }

  const matches = (task: Task) => `${task.title} ${task.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  const shown = tasks.filter(matches).filter((task) => view === 'open' ? !task.completed : task.completed).sort((a, b) => view === 'open' ? (a.priorityOrder ?? 0) - (b.priorityOrder ?? 0) : (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, view === 'completed' ? visibleCompleted : undefined)
  return (
    <section className="feature-page tasks-page">
      <header className="feature-heading"><div><p>Your next steps</p><h1>Tasks</h1></div><span>{openCount} open</span></header>
      <form className="task-composer" onSubmit={(event) => { event.preventDefault(); addTask() }}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task" aria-label="New task" />
        <button type="submit" aria-label="Add task"><Plus /></button>
      </form>
      <div className="task-view-switch"><button type="button" className={view === 'open' ? 'selected' : ''} onClick={() => setView('open')}>Open</button><button type="button" className={view === 'completed' ? 'selected' : ''} onClick={() => setView('completed')}>Completed</button></div>
      <label className="task-search"><Search aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks and notes" /></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      {tasks.length === 0 ? (
        <div className="character-empty-state"><IzaCharacter compact mood="encouraging" /><div><h2>Nothing is waiting</h2><p>Add a task, then start it through Timeflow whenever you are ready.</p></div></div>
      ) : (
        <div className="task-list">
          {shown.map((task) => (
            <article className={task.completed ? 'task-row completed' : 'task-row'} key={task.id}>
              <button type="button" className="task-check" onClick={() => void persist(tasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed, completedAt: item.completed ? null : new Date().toISOString(), updatedAt: new Date().toISOString() } : item))} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`}>{task.completed ? <Check /> : <Circle />}</button>
              <div><strong>{task.title}</strong><span>{task.estimateMinutes ? `${task.estimateMinutes} minute focus target` : 'No estimate'}{query && ` · ${task.completed ? 'Completed' : 'Open'}`}</span></div>
              <button type="button" className="task-start" disabled={Boolean(active) || task.completed} onClick={() => onStart({ id: `task-${task.id}`, name: task.title, color: '#d92f6f' }, task.estimateMinutes ?? null, { taskId: task.id, taskTitleSnapshot: task.title, timerMode: 'flowtime' })} aria-label={`Start ${task.title}`}><Play fill="currentColor" /></button>
            </article>
          ))}
        </div>
      )}
      {view === 'completed' && shown.length < tasks.filter((task) => task.completed && matches(task)).length && <button type="button" className="history-day-link" onClick={() => setVisibleCompleted((count) => count + 30)}>Load more completed tasks</button>}
    </section>
  )
}
