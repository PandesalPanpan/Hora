import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('first timer vertical slice', () => {
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

  it('starts, restores, and finishes a session into Today', () => {
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Study' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))
    expect(screen.getByText('Study in progress')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(65_000))
    expect(screen.getByLabelText('01:05 elapsed')).toBeInTheDocument()

    first.unmount()
    const restored = render(<App />)
    expect(screen.getByText('Study in progress')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Finish session' }))

    expect(screen.getByText('1m')).toBeInTheDocument()
    expect(screen.getByText('Session complete')).toBeInTheDocument()
    restored.unmount()
  })

  it('excludes paused time and resumes the same session', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))
    act(() => vi.advanceTimersByTime(60_000))
    fireEvent.click(screen.getByRole('button', { name: 'Pause session' }))
    act(() => vi.advanceTimersByTime(120_000))
    expect(screen.getByLabelText('01:00 elapsed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resume session' }))
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByLabelText('01:30 elapsed')).toBeInTheDocument()
  })

  it('drills from the week into a day and creates a planned block', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Planner calendar' }))

    fireEvent.click(screen.getByRole('button', { name: /Open Saturday, September 12, 2026/ }))
    expect(screen.getByRole('heading', { name: 'September 12, 2026' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add block' }))
    fireEvent.change(screen.getByLabelText('What are you planning?'), { target: { value: 'Review biology notes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save as planned' }))

    expect(screen.getByRole('button', { name: 'Review biology notes Focus' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review biology notes Focus' }))
    expect(screen.getByText('Not tracked yet')).toBeInTheDocument()
  })

  it('can start an immediate Timeflow from the planner', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Planner calendar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add block' }))
    fireEvent.change(screen.getByLabelText('What are you planning?'), { target: { value: 'Essay outline' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start via Timeflow' }))

    expect(screen.getByRole('button', { name: /^Essay outline Timeflow Live/ })).toBeInTheDocument()
  })

  it('uses URL-backed navigation for tasks and reports', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(window.location.hash).toBe('#/tasks')
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }))
    expect(window.location.hash).toBe('#/reports')
    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument()
  })
})
