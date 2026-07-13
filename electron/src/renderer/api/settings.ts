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

export async function triggerBackupDownload (): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/settings/backup`, {
    method: 'POST',
    headers: withAuthHeaders()
  })
  if (!response.ok) throw await createApiError(response)
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `backup-${new Date().toISOString().slice(0, 10)}.db`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export interface RestoreTestResponse {
  success: boolean
  message: string
  source: string
}

export async function runRestoreTest (file?: File): Promise<RestoreTestResponse> {
  const headers = new Headers()
  let body: any = null
  if (file) {
    headers.set('Content-Type', 'application/octet-stream')
    body = file
  }
  const response = await fetch(`${apiBaseUrl}/settings/restore-test`, {
    method: 'POST',
    headers: withAuthHeaders(headers),
    body
  })
  if (!response.ok) throw await createApiError(response)
  return await response.json() as RestoreTestResponse
}

async function request<T> (path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: withAuthHeaders(init?.headers)
  })
  if (!response.ok) throw await createApiError(response)
  return await response.json() as T
}
