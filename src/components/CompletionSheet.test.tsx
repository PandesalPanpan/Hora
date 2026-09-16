import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CompletionSheet } from './CompletionSheet'
import type { CompletedSession } from '../features/timer/types'
const session: CompletedSession = { id:'review', activity:{id:'study',name:'Study',color:'#b92f60'}, status:'completed', startedAt:'2026-09-15T06:02:05.123Z', finishedAt:'2026-09-15T06:12:37.456Z' }
afterEach(cleanup)
it('preserves exact timestamps and locks duplicate submission until success', async () => {
  let resolve!: () => void
  const save = vi.fn(() => new Promise<void>(done => { resolve = done }))
  render(<CompletionSheet session={session} onSave={save}/> )
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
it('reveals and saves explicit seconds', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<CompletionSheet session={session} onSave={save}/> )
  fireEvent.click(screen.getByRole('button',{name:/Edit seconds 05 start/}))
  fireEvent.change(screen.getByLabelText('Started seconds'),{target:{value:'59'}})
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}))
  await waitFor(() => expect(save).toHaveBeenCalledWith(session,expect.objectContaining({startedAt:'2026-09-15T06:02:59.000Z'})))
})
