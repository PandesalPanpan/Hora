import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('first timer vertical slice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-12T06:00:00.000Z'))
    vi.stubGlobal('crypto', { randomUUID: () => 'session-one' })
  })

  afterEach(() => {
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
    expect(screen.getByText('Min goal reached')).toBeInTheDocument()
    restored.unmount()
  })
})
