import type { PlannedBlock } from './types'

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function expandRecurringBlock(block: PlannedBlock): PlannedBlock[] {
  if (!block.recurrence) return [block]
  const start = new Date(block.startedAt); const end = new Date(block.finishedAt)
  const finalDate = new Date(`${block.recurrence.endsOn}T23:59:59`); const result: PlannedBlock[] = []
  for (const day = new Date(start); day <= finalDate; day.setDate(day.getDate() + 1)) {
    if (block.recurrence.frequency === 'weekdays' && !block.recurrence.weekdays?.includes(day.getDay())) continue
    const occurrenceStart = new Date(day); occurrenceStart.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds())
    const key = dateKey(occurrenceStart)
    const occurrenceEnd = new Date(day); occurrenceEnd.setHours(end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()); if (occurrenceEnd <= occurrenceStart) occurrenceEnd.setDate(occurrenceEnd.getDate() + 1)
    result.push({ ...block, id: `${block.id}:${key}`, recurrenceSeriesId: block.recurrenceSeriesId ?? block.id, occurrenceDate: key, startedAt: occurrenceStart.toISOString(), finishedAt: occurrenceEnd.toISOString() })
  }
  return result
}

export function splitRecurringBlock(block: PlannedBlock, fromDate: string, patch: Partial<PlannedBlock>) {
  if (!block.recurrence) return { past: block, future: { ...block, ...patch } }
  const dayBefore = new Date(`${fromDate}T12:00:00`); dayBefore.setDate(dayBefore.getDate() - 1)
  const futureStart = new Date(block.startedAt); const chosen = new Date(`${fromDate}T12:00:00`); futureStart.setFullYear(chosen.getFullYear(), chosen.getMonth(), chosen.getDate())
  return { past: { ...block, recurrence: { ...block.recurrence, endsOn: dateKey(dayBefore) } }, future: { ...block, ...patch, id: crypto.randomUUID(), recurrenceSeriesId: crypto.randomUUID(), startedAt: futureStart.toISOString() } }
}
