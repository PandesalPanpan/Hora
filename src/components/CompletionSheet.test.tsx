import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CompletionSheet } from './CompletionSheet'
import type { CompletedSession } from '../features/timer/types'
const session: CompletedSession = { id:'review', activity:{id:'study',name:'Study',color:'#b92f60'}, status:'completed', startedAt:'2026-09-15T06:02:05.123Z', finishedAt:'2026-09-15T06:12:37.456Z' }
const shortSession: CompletedSession = { ...session, id:'short-review', startedAt:'2026-09-15T06:02:05.123Z', finishedAt:'2026-09-15T06:02:29.456Z' }
const exactlyOneMinuteSession: CompletedSession = { ...shortSession, id:'one-minute-review', finishedAt:'2026-09-15T06:03:05.123Z' }
afterEach(cleanup)
it('preserves exact timestamps and locks duplicate submission until success', async () => {
  let resolve!: () => void
  const save = vi.fn(() => new Promise<void>(done => { resolve = done }))
  render(<CompletionSheet session={session} onSave={save}/> )
  expect(screen.queryByRole('button',{name:/Edit seconds/})).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Started seconds')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Finished seconds')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Save changes'})); fireEvent.submit(screen.getByRole('form'))
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.calls[0]).toEqual([session,expect.objectContaining({startedAt:session.startedAt,finishedAt:session.finishedAt})])
  expect(screen.getByRole('button',{name:'Saving changes…'})).toBeDisabled(); resolve()
})
it('keeps failed changes open and permits retry', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('disk')).mockResolvedValue(undefined)
  render(<CompletionSheet session={session} onSave={save}/> )
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
  fireEvent.click(screen.getByRole('button',{name:'Save changes'})); await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
})
it.each(['calm','focused','tired'])('feeling %s is optional, checked and explicitly clearable', async mood => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<CompletionSheet session={session} onSave={save}/> )
  expect(screen.queryByRole('button',{name:'Clear feeling'})).not.toBeInTheDocument()
  const option = screen.getByRole('button',{name:new RegExp(mood)})
  expect(option).toHaveAttribute('aria-pressed','false'); fireEvent.click(option); expect(option).toHaveAttribute('aria-pressed','true')
  fireEvent.click(screen.getByRole('button',{name:'Clear feeling'})); expect(option).toHaveAttribute('aria-pressed','false')
  fireEvent.click(screen.getByRole('button',{name:'Save changes'})); await waitFor(() => expect(save).toHaveBeenCalledWith(session,expect.objectContaining({mood:undefined})))
})
it('switches between feelings with one pressed choice and saves the final selection', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<CompletionSheet session={session} onSave={save}/> )
  const calm = screen.getByRole('button', { name: /calm/i })
  const focused = screen.getByRole('button', { name: /focused/i })
  const tired = screen.getByRole('button', { name: /tired/i })
  fireEvent.click(calm)
  fireEvent.click(focused)
  expect(calm).toHaveAttribute('aria-pressed', 'false')
  expect(focused).toHaveAttribute('aria-pressed', 'true')
  expect(tired).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(session, expect.objectContaining({ mood: 'focused' })))
})
it('reveals and saves explicit seconds for sessions shorter than a minute', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<CompletionSheet session={shortSession} onSave={save}/> )
  fireEvent.click(screen.getByRole('button',{name:/Edit seconds 05 start · 29 finish/}))
  expect(screen.getByLabelText('Started seconds')).toBeInTheDocument()
  expect(screen.getByLabelText('Finished seconds')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Started seconds'),{target:{value:'12'}})
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}))
  await waitFor(() => expect(save).toHaveBeenCalledWith(shortSession,expect.objectContaining({startedAt:'2026-09-15T06:02:12.000Z',finishedAt:shortSession.finishedAt})))
})

it('hides second correction controls at exactly one minute', () => {
  render(<CompletionSheet session={exactlyOneMinuteSession} onSave={vi.fn().mockResolvedValue(undefined)}/> )
  expect(new Date(exactlyOneMinuteSession.finishedAt).getTime() - new Date(exactlyOneMinuteSession.startedAt).getTime()).toBe(60_000)
  expect(screen.queryByRole('button',{name:/Edit seconds/})).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Started seconds')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Finished seconds')).not.toBeInTheDocument()
})

it('rejects explicit seconds outside 0 to 59', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<CompletionSheet session={shortSession} onSave={save}/> )
  fireEvent.click(screen.getByRole('button',{name:/Edit seconds/}))
  fireEvent.change(screen.getByLabelText('Started seconds'),{target:{value:'60'}})
  fireEvent.submit(screen.getByRole('form'))
  expect(await screen.findByRole('alert')).toHaveTextContent('seconds from 0 to 59')
  expect(save).not.toHaveBeenCalled()
})
