import dayjs, { type Dayjs } from 'dayjs'

const isoDateFormat = 'YYYY-MM-DD'

export const datePickerDisplayFormat = 'DD.MM.YYYY'

export function getDatePickerValue (value?: string | null): Dayjs | null {
  if (!value) return null
  const parsed = dayjs(`${value}T00:00:00`)
  return parsed.isValid() ? parsed : null
}

export function normalizeDatePickerValue (value: Dayjs | null): string | undefined {
  return value ? value.format(isoDateFormat) : undefined
}
