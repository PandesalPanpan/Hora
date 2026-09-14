import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('Iza timer and Hora navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-12T06:00:00.000Z'))
    vi.stubGlobal('crypto', { randomUUID: () => 'session-one' })
    localStorage.clear()
    window.history.replaceState(null, '', '#/today')
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts, restores, and finishes a session into History', () => {
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Study' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))
    expect(screen.getByText(/Live flowtime/i)).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(65_000))
    expect(screen.getByLabelText('00:01:05 elapsed')).toBeInTheDocument()

    first.unmount()
    const restored = render(<App />)
    expect(screen.getByText(/Live flowtime/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Finish session' }))
    expect(screen.getByRole('form', { name: 'Complete time log' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save time log' }))

    expect(screen.getByRole('heading', { name: 'Your time, kept gently' })).toBeInTheDocument()
    expect(screen.getAllByText('1m').length).toBeGreaterThan(0)
    restored.unmount()
  })

  it('excludes paused time and resumes the same session', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))
    act(() => vi.advanceTimersByTime(60_000))
    fireEvent.click(screen.getByRole('button', { name: 'Pause session' }))
    act(() => vi.advanceTimersByTime(120_000))
    expect(screen.getByLabelText('00:01:00 elapsed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resume session' }))
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByLabelText('00:01:30 elapsed')).toBeInTheDocument()
  })

  it('starts with the Figma default goal and allows changing it before starting', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Set 25 minute goal' })).toHaveClass('selected')
    fireEvent.click(screen.getByRole('button', { name: 'Set 30 minute goal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))

    expect(JSON.parse(localStorage.getItem('iza.active-session.v1') ?? '{}')).toMatchObject({ targetMinutes: 30 })
    expect(screen.getByText(/Live flowtime/i)).toBeInTheDocument()
  })

  it('marks a newly selected past goal as reached without stopping', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))
    vi.setSystemTime(new Date('2026-09-12T06:26:00.000Z'))
    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.getByText(/Goal reached/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause session' })).toBeEnabled()
  })

  it('opens the Pomodoro presentation and keeps Tasks reachable from Me', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Pomodoro' }))
    expect(screen.getByLabelText('Pomodoro timer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Me' }))
    fireEvent.click(screen.getByRole('button', { name: /Open tasks/i }))
    expect(screen.getByPlaceholderText('Add a task')).toBeInTheDocument()
  })

  it('drills from the week into a day and creates a planned block', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Me' }))
    fireEvent.click(screen.getByRole('button', { name: /Open planner/i }))
    fireEvent.click(screen.getByRole('button', { name: /Open Saturday, September 12, 2026/ }))
    expect(screen.getByRole('heading', { name: 'September 12, 2026' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add block' }))
    fireEvent.change(screen.getByLabelText('What are you planning?'), { target: { value: 'Review biology notes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save as planned' }))
    expect(screen.getByRole('button', { name: 'Review biology notes Focus' })).toBeInTheDocument()
  })

  it('can start an immediate Timeflow from the planner', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Me' }))
    fireEvent.click(screen.getByRole('button', { name: /Open planner/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Add block' }))
    fireEvent.change(screen.getByLabelText('What are you planning?'), { target: { value: 'Essay outline' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start via Timeflow' }))
    expect(screen.getByRole('button', { name: /^Essay outline Timeflow Live/ })).toBeInTheDocument()
  })

  it('uses URL-backed navigation for History and Stats', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(window.location.hash).toBe('#/history')
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }))
    expect(window.location.hash).toBe('#/reports')
    expect(screen.getByRole('heading', { name: 'Little wins add up ✦' })).toBeInTheDocument()
  })

  it('canonicalizes an unknown URL route to Today', () => {
    window.history.replaceState(null, '', '#/unknown')
    render(<App />)
    expect(window.location.hash).toBe('#/today')
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  })

  it('defaults an 11 PM quick-add block to the end of the day', () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Me' }))
    fireEvent.click(screen.getByRole('button', { name: /Open planner/i }))
    const dayColumn = container.querySelector('.day-column')
    expect(dayColumn).not.toBeNull()
    fireEvent.click(dayColumn as Element, { clientY: 23 * 68 + 1 })
    expect(screen.getByLabelText('Starts')).toHaveValue('23:00')
    expect(screen.getByLabelText('Ends')).toHaveValue('23:59')
  })
})
