import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { toLocalInput } from './lib/completionTime'
import { currentVersion } from './features/releases/changelog'

async function flushAppWork() {
  await act(async () => { await vi.advanceTimersByTimeAsync(100) })
}

describe('Iza timer and navigation', () => {
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

  it('starts, restores, and finishes a session into History', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })

    expect(screen.getByRole('heading', { name: 'Your time, kept gently' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reports' })).toHaveAttribute('aria-current', 'page')
    expect(within(screen.getByLabelText('Recent dates')).getAllByRole('button')).toHaveLength(7)
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

  it('uses, persists, restores, changes, and removes the selected Flowtime goal', async () => {
    const first = render(<App />)
    expect(screen.getByRole('button', { name: 'Set 25 minute goal' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Set 30 minute goal' }))
    expect(screen.getByRole('button', { name: 'Set 30 minute goal' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))

    expect(screen.getByText('Goal 30 min')).toBeInTheDocument()
    await flushAppWork()
    expect(JSON.parse(localStorage.getItem('iza.active-session.v1') ?? '{}')).toMatchObject({ status: 'running', targetMinutes: 30 })
    vi.setSystemTime(new Date('2026-09-12T06:30:00.000Z'))
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText(/Goal reached · keep going/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish session' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Reports' }))
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    first.unmount()
    localStorage.clear()

    render(<App />)
    await flushAppWork()
    expect(screen.getByText('Goal 30 min')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change goal to 60 minutes' }))
    expect(screen.getByText('Goal 60 min')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('iza.active-session.v1') ?? '{}')).toMatchObject({ status: 'running', targetMinutes: 60 })

    fireEvent.click(screen.getByRole('button', { name: 'Remove goal' }))
    expect(screen.getByText('No time goal')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('iza.active-session.v1') ?? '{}')).toMatchObject({ status: 'running', targetMinutes: null })
  })

  it('saves a feeling on the completed record, shows it in History, and restores edits', async () => {
    const view = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))
    act(() => vi.advanceTimersByTime(1_000))
    fireEvent.click(screen.getByRole('button', { name: 'Finish session' }))

    const calm = screen.getByRole('button', { name: /calm/i })
    const focused = screen.getByRole('button', { name: /focused/i })
    const tired = screen.getByRole('button', { name: /tired/i })
    expect(calm).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(calm)
    expect(calm).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(focused)
    expect(calm).toHaveAttribute('aria-pressed', 'false')
    expect(focused).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(tired)
    expect(focused).toHaveAttribute('aria-pressed', 'false')
    expect(tired).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(focused)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await flushAppWork()
    const focusedRow = screen.getByRole('button', { name: 'Edit Study time log, feeling focused' })
    expect(focusedRow).toHaveTextContent('Feeling: Focused')

    fireEvent.click(focusedRow)
    const review = within(screen.getByRole('form', { name: 'Complete time log' }))
    expect(review.getByRole('button', { name: /focused/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(review.getByRole('button', { name: /calm/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await flushAppWork()
    const calmRow = screen.getByRole('button', { name: 'Edit Study time log, feeling calm' })
    expect(calmRow).toHaveTextContent('Feeling: Calm')

    fireEvent.click(calmRow)
    const calmReview = within(screen.getByRole('form', { name: 'Complete time log' }))
    expect(calmReview.getByRole('button', { name: /calm/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(calmReview.getByRole('button', { name: 'Clear feeling' }))
    fireEvent.click(calmReview.getByRole('button', { name: 'Save changes' }))
    await flushAppWork()
    const clearedRow = screen.getByRole('button', { name: 'Edit Study time log' })
    expect(clearedRow).not.toHaveTextContent('Feeling:')

    view.unmount()
    localStorage.clear()
    render(<App />)
    await flushAppWork()
    expect(screen.getByRole('button', { name: 'Edit Study time log' })).not.toHaveTextContent('Feeling:')
  })

  it('marks a newly selected past goal as reached without stopping', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))
    vi.setSystemTime(new Date('2026-09-12T06:26:00.000Z'))
    act(() => vi.advanceTimersByTime(1_000))

    expect(screen.getByText(/Goal reached/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause session' })).toBeEnabled()
  })

  it('lets a user correct and delete a completed session, then undo', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Study session' }))
    act(() => vi.advanceTimersByTime(60_000))
    fireEvent.click(screen.getByRole('button', { name: 'Finish session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(screen.getByRole('button', { name: 'Edit Study time log' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Study time log' }))
    fireEvent.change(screen.getByLabelText('Finished'), { target: { value: toLocalInput('2026-09-12T06:02:00.000Z') } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(screen.getAllByText('2m').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Edit Study time log' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete this session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Session deleted')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Edit Study time log' })).toBeInTheDocument()
  })

  it('starts an editable Pomodoro and advances to a break without auto-stopping', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Pomodoro' }))
    expect(screen.getByLabelText('Pomodoro timer')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Focus minutes'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Focus rounds'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start Study Pomodoro' }))
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('button', { name: 'Keep focusing' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start break' }))
    expect(screen.getByText(/Break · 1 of 2/i)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('iza.active-session.v1') ?? '{}')).toMatchObject({ activity: { name: 'Break' }, pomodoro: { phase: 'break', round: 1, totalRounds: 2 } })
  })

  it('keeps a paused Pomodoro break frozen while navigating', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Pomodoro' }))
    fireEvent.change(screen.getByLabelText('Focus minutes'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start Study Pomodoro' }))
    act(() => vi.advanceTimersByTime(60_000))
    fireEvent.click(screen.getByRole('button', { name: 'Start break' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause break' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }))
    act(() => vi.advanceTimersByTime(120_000))
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('drills from the week into a day and creates a planned block', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Planner' }))
    fireEvent.click(screen.getByRole('button', { name: /Open Saturday, September 12, 2026/ }))
    expect(screen.getByRole('heading', { name: 'September 12, 2026' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add block' }))
    fireEvent.change(screen.getByLabelText('What are you planning?'), { target: { value: 'Review biology notes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save as planned' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(screen.getByRole('button', { name: 'Review biology notes Planned' })).toBeInTheDocument()
  })

  it('can start an immediate Timeflow from the planner', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Planner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add block' }))
    fireEvent.change(screen.getByLabelText('What are you planning?'), { target: { value: 'Essay outline' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start via Timeflow' }))
    expect(screen.getByRole('button', { name: /^Essay outline Live Live/ })).toBeInTheDocument()
  })

  it('uses URL-backed navigation for Planner and Reports', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Planner' }))
    expect(window.location.hash).toBe('#/planner')
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }))
    expect(window.location.hash).toBe('#/reports')
    expect(screen.getByRole('heading', { name: 'Where your time went' })).toBeInTheDocument()
    expect(screen.queryByText(/12%|rhythm/i)).not.toBeInTheDocument()
  })

  it('makes Settings reachable from the desktop navigation rail', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(window.location.hash).toBe('#/settings')
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Open settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Your gentle corner' })).toBeInTheDocument()
  })

  it('opens a URL-backed version history from Your gentle corner', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    fireEvent.click(screen.getByRole('button', { name: /What’s new/i }))
    expect(window.location.hash).toBe('#/changelog')
    expect(screen.getByRole('heading', { name: 'What’s new' })).toBeInTheDocument()
    expect(screen.getByText(`Latest · v${currentVersion}`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to your gentle corner' }))
    expect(window.location.hash).toBe('#/settings')
  })

  it('canonicalizes an unknown URL route to Today', () => {
    window.history.replaceState(null, '', '#/unknown')
    render(<App />)
    expect(window.location.hash).toBe('#/today')
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  })

  it('defaults an 11 PM quick-add block to the end of the day', () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Planner' }))
    const dayColumn = container.querySelector('.day-column')
    expect(dayColumn).not.toBeNull()
    fireEvent.click(dayColumn as Element, { clientY: 23 * 68 + 1 })
    expect(screen.getByLabelText('Starts')).toHaveValue('23:00')
    expect(screen.getByLabelText('Ends')).toHaveValue('23:59')
  })
})
