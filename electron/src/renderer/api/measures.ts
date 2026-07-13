import { createApiError, withAuthHeaders } from './auth'
import type { PaginatedResponse, SortDirection } from './risks'

export type MeasureStatus = 'Offen' | 'In Arbeit' | 'Erledigt'
export type MeasurePriority = 'Kritisch' | 'Hoch' | 'Normal'
export type MeasureSortField = 'title' | 'owner' | 'dueDate' | 'priority' | 'status' | 'createdAt' | 'updatedAt'

export interface Measure {
  id: string
  riskId: string | null
  title: string
  description: string
  owner: string
  dueDate: string | null
  priority: MeasurePriority
  status: MeasureStatus
  createdAt: string
  updatedAt: string
}

export interface CreateMeasureInput {
  riskId?: string | null
  title: string
  description: string
  owner: string
  dueDate?: string | null
  priority?: MeasurePriority
  status?: MeasureStatus
}

export type UpdateMeasureInput = Partial<Pick<
Measure,
'riskId' | 'title' | 'description' | 'owner' | 'dueDate' | 'priority' | 'status'
>>

export interface ListMeasuresQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: MeasureStatus
  priority?: MeasurePriority
  owner?: string
  riskId?: string
  sortBy?: MeasureSortField
  sortDirection?: SortDirection
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

export async function listMeasures (query: ListMeasuresQuery = { pageSize: 500 }): Promise<Measure[]> {
  return (await listMeasuresPage(query)).items
}

export async function listMeasuresPage (query: ListMeasuresQuery = {}): Promise<PaginatedResponse<Measure>> {
  return await request<PaginatedResponse<Measure>>(`/measures${toQueryString(query)}`)
}

export async function createMeasure (input: CreateMeasureInput): Promise<Measure> {
  return await request<Measure>('/measures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
}

export async function updateMeasure (id: string, input: UpdateMeasureInput): Promise<Measure> {
  return await request<Measure>(`/measures/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
}

export async function deleteMeasure (id: string): Promise<void> {
  await request<void>(`/measures/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

async function request<T> (path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: withAuthHeaders(init?.headers)
  })
  if (!response.ok) {
    throw await createApiError(response)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

function toQueryString (query: ListMeasuresQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const value = params.toString()
  return value ? `?${value}` : ''
}
