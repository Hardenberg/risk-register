import type { ReviewCycle } from './api/risks'

export const reviewCycleOptions: Array<{ value: ReviewCycle, label: string }> = [
  { value: 'Fix', label: 'Fix' },
  { value: 'Monatlich', label: 'Monatlich' },
  { value: 'Quartalsweise', label: 'Quartalsweise' },
  { value: 'Halbjährlich', label: 'Halbjährlich' },
  { value: 'Jährlich', label: 'Jährlich' },
  { value: '2-jährlich', label: '2-jährlich' }
]

export function calculateReviewDate (reviewCycle: ReviewCycle, date = new Date()): string | null {
  if (reviewCycle === 'Fix') return null

  const months: Record<Exclude<ReviewCycle, 'Fix'>, number> = {
    Monatlich: 1,
    Quartalsweise: 3,
    Halbjährlich: 6,
    Jährlich: 12,
    '2-jährlich': 24
  }

  const monthCount = months[reviewCycle]
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const targetMonthIndex = month + monthCount
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastTargetDay)
  return formatDateInputValue(new Date(Date.UTC(targetYear, targetMonth, targetDay)))
}

function formatDateInputValue (date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
