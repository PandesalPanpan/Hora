import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { db } from '../lib/db'
import { TasksPage } from './TasksPage'
import type { Task } from '../features/tasks/types'
afterEach(cleanup)
const task = (id: string, completed=false): Task => ({id,title:`Task ${id}`,description:'biology notes',completed,estimateMinutes:null,priorityOrder:Number(id),completedAt:completed ? new Date(2026,8,15,0,Number(id)).toISOString() : null,createdAt:'2026-09-15',updatedAt:'2026-09-15'})
it('edits notes and estimates, starts with a snapshot, and persists manual priority', async () => {
  await db.tasks.bulkPut([task('1'),task('2')]); const start = vi.fn(); const view = render(<TasksPage active={null} onStart={start}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Actions for Task 1'}))
  fireEvent.click(screen.getByRole('button',{name:'Edit task'}))
  fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Review chapter'}})
  fireEvent.change(screen.getByLabelText('Focus estimate'),{target:{value:'30'}})
  fireEvent.click(screen.getByRole('button',{name:'Save task'})); await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument())
  fireEvent.click(await screen.findByRole('button',{name:'Start Review chapter'})); expect(start).toHaveBeenCalledWith(expect.objectContaining({name:'Review chapter'}),30,expect.objectContaining({taskTitleSnapshot:'Review chapter'}))
  fireEvent.click(screen.getByRole('button',{name:'Actions for Task 2'})); fireEvent.click(screen.getByRole('button',{name:'Move up'})); await waitFor(async () => expect((await db.tasks.get('2'))?.priorityOrder).toBe(0))
  fireEvent.click(screen.getByRole('button',{name:'Actions for Task 2'})); fireEvent.click(screen.getByRole('button',{name:'Move down'})); await waitFor(async () => expect((await db.tasks.get('2'))?.priorityOrder).toBe(1))
  view.unmount(); render(<TasksPage active={null} onStart={start}/>); await screen.findByRole('button',{name:'Actions for Task 2'})
  expect(screen.getAllByRole('article')[0]).toHaveTextContent('Review chapter')
})
it('pages completed tasks and searches across statuses', async () => {
  await db.tasks.bulkPut([task('0'),...Array.from({length:75},(_,i) => task(String(i+1),true))])
  render(<TasksPage active={null} onStart={vi.fn()}/>); await screen.findByRole('button',{name:'Actions for Task 0'})
  expect(screen.getAllByRole('article')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button',{name:'Completed'})); expect(screen.getAllByRole('article')).toHaveLength(30)
  fireEvent.click(screen.getByRole('button',{name:'Load more completed tasks'})); expect(screen.getAllByRole('article')).toHaveLength(60)
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Task 0'}}); expect(screen.getByRole('article')).toHaveTextContent('Open')
})
it('deletes with confirmation, retains historical sessions and supports Undo', async () => {
  await db.tasks.put(task('1')); await db.sessions.put({id:'log',taskId:'1',activity:{id:'study',name:'Study',color:'#b92f60'},status:'completed',startedAt:'2026-09-15T01:00:00Z',finishedAt:'2026-09-15T02:00:00Z'})
  render(<TasksPage active={null} onStart={vi.fn()}/>);fireEvent.click(await screen.findByRole('button',{name:'Actions for Task 1'}));fireEvent.click(screen.getByRole('button',{name:'Edit task'}));fireEvent.click(screen.getByRole('button',{name:'Delete task'}));expect(await db.tasks.get('1')).toBeDefined();fireEvent.click(screen.getByRole('button',{name:'Confirm delete'}))
  await screen.findByRole('button',{name:'Undo'});expect(await db.tasks.get('1')).toBeUndefined();expect((await db.sessions.get('log'))?.taskTitleSnapshot).toBe('Task 1')
  fireEvent.click(within(screen.getByRole('status')).getByRole('button',{name:'Undo'}));await screen.findByRole('button',{name:'Actions for Task 1'});expect((await db.sessions.get('log'))?.taskId).toBe('1')
})
it('shows sorting controls only in the unfiltered open view', async () => {
  await db.tasks.bulkPut([task('1'),task('2',true)])
  render(<TasksPage active={null} onStart={vi.fn()}/>)
  expect(await screen.findByRole('button',{name:'Drag Task 1 to reorder'})).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Task'}})
  expect(screen.queryByRole('button',{name:/Drag .* to reorder/})).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Actions for Task 1'}))
  expect(screen.queryByRole('button',{name:'Move up'})).not.toBeInTheDocument()
})
