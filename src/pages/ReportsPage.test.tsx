import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ReportsPage } from './ReportsPage'
afterEach(cleanup)
it('selects today, shows honest empty bars, navigates weeks and links the selected day', () => {
  const open = vi.fn();const view=render(<ReportsPage completed={[]} onOpenHistory={open}/>)
  expect(screen.getByRole('button',{name:'Next week'})).toBeDisabled()
  expect([...view.container.querySelectorAll('.weekly-chart i')].every(node => (node as HTMLElement).style.height === '0px')).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'Previous week'}));expect(screen.getByRole('button',{name:'Next week'})).toBeEnabled()
  const days = screen.getAllByRole('button',{name:/^Show /});fireEvent.click(days[3]);expect(days[3]).toHaveClass('selected')
  fireEvent.click(screen.getByRole('button',{name:'View this day in History'}));expect(open).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  fireEvent.click(screen.getByRole('button',{name:'History'}));expect(open).toHaveBeenCalledTimes(2)
  expect(screen.getByText('No tracked time')).toBeInTheDocument()
})
