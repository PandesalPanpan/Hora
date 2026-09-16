import { useEffect } from 'react'
/** Keep keyboard and Android Back inside the foremost editing sheet. */
export function useSheetNavigation() {
  useEffect(() => {
    let current: HTMLElement | null = null
    let previous: HTMLElement | null = null
    const sheet = () => [...document.querySelectorAll<HTMLElement>('.completion-sheet, .quick-add-popover, .event-inspector')].at(-1) ?? null
    const focusable = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')].filter(node => node.getClientRects().length > 0)
    const observer = new MutationObserver(() => {
      const next = sheet()
      if (next === current) return
      if (next) { previous = document.activeElement as HTMLElement; current = next; if (!next.contains(document.activeElement)) focusable(next)[0]?.focus() }
      else { current = null; previous?.focus() }
    })
    observer.observe(document.body,{childList:true,subtree:true})
    const keydown = (event: KeyboardEvent) => {
      const active = sheet(); if (!active) return
      if (event.key === 'Escape') { event.preventDefault(); active.querySelector<HTMLButtonElement>('button[aria-label^="Close"]')?.click() }
      if (event.key === 'Tab') { const items = focusable(active); const first = items[0], last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() } }
    }
    document.addEventListener('keydown',keydown)
    return () => { observer.disconnect(); document.removeEventListener('keydown',keydown) }
  },[])
}
