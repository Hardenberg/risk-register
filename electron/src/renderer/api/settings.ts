import { createApiError, withAuthHeaders } from './auth'
import type { ReviewCycle } from './risks'

export interface ApplicationSettings {
  organizationName: string
  defaultReviewCycle: ReviewCycle
  reviewReminderDays: number
  highRiskThreshold: number
  criticalRiskThreshold: number
}

export type UpdateApplicationSettingsInput = Partial<ApplicationSettings>

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

export async function getApplicationSettings (): Promise<ApplicationSettings> {
  return await request<ApplicationSettings>('/settings')
}

export async function updateApplicationSettings (input: UpdateApplicationSettingsInput): Promise<ApplicationSettings> {
  return await request<ApplicationSettings>('/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
}

async function request<T> (path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: withAuthHeaders(init?.headers)
  })
  if (!response.ok) throw await createApiError(response)
  return await response.json() as T
}
