import { Check, Circle, Play, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { IzaCharacter } from '../components/IzaCharacter'
import type { Activity, ActiveSession } from '../features/timer/types'

type Task = { id: string; title: string; estimateMinutes: number; completed: boolean }
type TasksPageProps = { active: ActiveSession | null; onStart: (activity: Activity, targetMinutes?: number | null) => void }
const TASKS_KEY = 'iza.tasks.v1'

function loadTasks(): Task[] {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY) ?? '[]') as Task[] } catch { return [] }
}

export function TasksPage({ active, onStart }: TasksPageProps) {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [title, setTitle] = useState('')
  const openCount = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks])

  const persist = (next: Task[]) => { localStorage.setItem(TASKS_KEY, JSON.stringify(next)); setTasks(next) }
  const addTask = () => {
    if (!title.trim()) return
    persist([...tasks, { id: crypto.randomUUID(), title: title.trim(), estimateMinutes: 25, completed: false }])
    setTitle('')
  }

  return (
    <section className="feature-page tasks-page">
      <header className="feature-heading"><div><p>Your next steps</p><h1>Tasks</h1></div><span>{openCount} open</span></header>
      <form className="task-composer" onSubmit={(event) => { event.preventDefault(); addTask() }}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task" aria-label="New task" />
        <button type="submit" aria-label="Add task"><Plus /></button>
      </form>
      {tasks.length === 0 ? (
        <div className="character-empty-state"><IzaCharacter compact mood="encouraging" /><div><h2>Nothing is waiting</h2><p>Add a task, then start it through Timeflow whenever you are ready.</p></div></div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <article className={task.completed ? 'task-row completed' : 'task-row'} key={task.id}>
              <button type="button" className="task-check" onClick={() => persist(tasks.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item))} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`}>{task.completed ? <Check /> : <Circle />}</button>
              <div><strong>{task.title}</strong><span>{task.estimateMinutes} minute focus target</span></div>
              <button type="button" className="task-start" disabled={Boolean(active) || task.completed} onClick={() => onStart({ id: `task-${task.id}`, name: task.title, color: '#d92f6f' }, task.estimateMinutes)} aria-label={`Start ${task.title}`}><Play fill="currentColor" /></button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
