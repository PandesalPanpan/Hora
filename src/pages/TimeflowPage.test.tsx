import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TimeflowPage } from './TimeflowPage'
import type { ActiveSession } from '../features/timer/types'
afterEach(cleanup)
const actions = { onReview:vi.fn(),start:vi.fn(),pause:vi.fn(),resume:vi.fn(),setTargetMinutes:vi.fn(),setNote:vi.fn(),acknowledgeTarget:vi.fn(),advancePomodoro:vi.fn(),finish:vi.fn() }
it('filters without changing the selected ready activity, then explicitly selects', () => {
  render(<TimeflowPage active={null} completed={[]} elapsed={0} {...actions}/>)
  expect(screen.getByRole('img', { name: 'Hora clock character' })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'Iza clock character' })).not.toBeInTheDocument()
  expect(screen.queryByText('Selected activity')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Leisure'}))
  expect(screen.getByRole('button',{name:'Leisure'})).toHaveAttribute('aria-pressed','true')
  expect(screen.getByRole('heading',{name:'Ready for Study?'})).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Reading'}))
  expect(screen.getByRole('heading',{name:'Ready for Reading?'})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Reading'})).toHaveAttribute('aria-pressed','true')
  expect(screen.getByRole('button',{name:'Start Reading session'})).toBeInTheDocument()
})
it('keeps the running activity unambiguous while browsing filters', () => {
  const active: ActiveSession = {id:'live',activity:{id:'study',name:'Study',color:'#b92f60'},startedAt:new Date().toISOString(),status:'running'}
  render(<TimeflowPage active={active} completed={[]} elapsed={12} {...actions}/>)
  fireEvent.click(screen.getByRole('button',{name:'Leisure'}))
  expect(screen.getByRole('button',{name:'Reading'})).toBeDisabled()
  expect(screen.getByText('Finish this session to choose another activity.')).toBeInTheDocument()
})
it('retains the same Pomodoro regions in ready, active, paused and milestone states', () => {
  const active: ActiveSession = {id:'live',activity:{id:'study',name:'Study',color:'#b92f60'},startedAt:new Date().toISOString(),status:'running',targetMinutes:25,timerMode:'pomodoro',pomodoro:{phase:'focus',round:1,focusMinutes:25,breakMinutes:5,focusActivity:{id:'study',name:'Study',color:'#b92f60'}}}
  const view = render(<TimeflowPage active={null} completed={[]} elapsed={0} {...actions}/>);fireEvent.click(screen.getByRole('button',{name:'Pomodoro'}))
  const regions = () => [...view.container.querySelector('.pomodoro-card')!.children].map(node => node.className)
  const initial = regions()
  for (const [status,elapsed] of [['running',20],['paused',20],['running',1500]] as const) {
    view.rerender(<TimeflowPage active={{...active,status}} completed={[]} elapsed={elapsed} {...actions}/> )
    const current = regions();expect(current.slice(0,3)).toEqual(initial.slice(0,3));expect(current).toHaveLength(initial.length)
  }
  expect(screen.getByRole('button',{name:'Keep focusing'})).toBeInTheDocument()
})
it('configures one to eight Pomodoro rounds and passes the choice into the session', () => {
  const start = vi.fn()
  render(<TimeflowPage active={null} completed={[]} elapsed={0} {...actions} start={start}/>)
  fireEvent.click(screen.getByRole('button',{name:'Pomodoro'}))
  fireEvent.change(screen.getByLabelText('Focus rounds'),{target:{value:'2'}})
  fireEvent.click(screen.getByRole('button',{name:'Start Study Pomodoro'}))
  expect(start).toHaveBeenCalledWith(expect.anything(),25,expect.objectContaining({pomodoro:expect.objectContaining({totalRounds:2})}))
})
it('allows clearing Pomodoro fields while typing and clamps committed values', () => {
  const start = vi.fn()
  render(<TimeflowPage active={null} completed={[]} elapsed={0} {...actions} start={start}/>)
  fireEvent.click(screen.getByRole('button',{name:'Pomodoro'}))
  const focus = screen.getByLabelText('Focus minutes')
  fireEvent.change(focus,{target:{value:''}}); expect(focus).toHaveValue(null)
  fireEvent.change(focus,{target:{value:'999'}}); fireEvent.blur(focus); expect(focus).toHaveValue(180)
  const rounds = screen.getByLabelText('Focus rounds')
  fireEvent.change(rounds,{target:{value:'0'}})
  fireEvent.click(screen.getByRole('button',{name:'Start Study Pomodoro'}))
  expect(start).toHaveBeenCalledWith(expect.anything(),180,expect.objectContaining({pomodoro:expect.objectContaining({totalRounds:1})}))
})
it('edits the persisted note of an active Timeflow session', () => {
  const active: ActiveSession = {id:'live',activity:{id:'study',name:'Study',color:'#b92f60'},startedAt:new Date().toISOString(),status:'running',note:'First thought'}
  const setNote = vi.fn()
  render(<TimeflowPage active={active} completed={[]} elapsed={12} {...actions} setNote={setNote}/>)
  fireEvent.change(screen.getByLabelText(/Session note/),{target:{value:'Chapter three'}})
  expect(setNote).toHaveBeenCalledWith('Chapter three')
})
