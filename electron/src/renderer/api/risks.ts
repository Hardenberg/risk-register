import { createApiError, withAuthHeaders } from './auth'

export type RiskStatus = 'Offen' | 'In Bearbeitung' | 'Überwacht' | 'Geschlossen'
export type ReviewCycle = 'Fix' | 'Monatlich' | 'Quartalsweise' | 'Halbjährlich' | 'Jährlich' | '2-jährlich'
export type RiskSortField = 'reference' | 'title' | 'category' | 'owner' | 'currentScore' | 'status' | 'dueDate' | 'reviewDate' | 'createdAt' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'

export interface Risk {
  id: string
  reference: string
  title: string
  description: string
  category: string
  owner: string
  initialScore: number
  currentScore: number
  status: RiskStatus
  dueDate: string | null
  reviewDate: string | null
  reviewCycle: ReviewCycle
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateRiskInput {
  title: string
  description: string
  category: string
  owner: string
  initialScore: number
  dueDate?: string | null
  reviewDate?: string | null
  reviewCycle?: ReviewCycle
}

export type UpdateRiskInput = Partial<Pick<
Risk,
'title' | 'description' | 'category' | 'owner' | 'initialScore' | 'currentScore' | 'status' | 'dueDate' | 'reviewDate' | 'reviewCycle'
>>

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListRisksQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: RiskStatus
  category?: string
  owner?: string
  sortBy?: RiskSortField
  sortDirection?: SortDirection
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

/** Lädt Risiken und überbrückt kurze Startverzögerungen des lokalen Servers mit Backoff. */
export async function listRisks (query: ListRisksQuery = { pageSize: 500 }): Promise<Risk[]> {
  return (await listRisksPage(query)).items
}

export async function listRisksPage (query: ListRisksQuery = {}): Promise<PaginatedResponse<Risk>> {
  let lastError: unknown

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await request<PaginatedResponse<Risk>>(`/risks${toQueryString(query)}`)
    } catch (error) {
      lastError = error
      if (attempt < 4) await wait(400 * (attempt + 1))
    }
  }

  throw lastError
}

/** Persistiert ein neues Risiko über die Fastify-API und gibt das serverseitige Modell zurück. */
export async function createRisk (input: CreateRiskInput): Promise<Risk> {
  return await request<Risk>('/risks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
}

/** Aktualisiert die übergebenen Felder eines Risikos und liefert den neuen Serverstand. */
export async function updateRisk (id: string, input: UpdateRiskInput): Promise<Risk> {
  return await request<Risk>(`/risks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
}

/** Markiert ein Risiko über die API als gelöscht. */
export async function deleteRisk (id: string): Promise<void> {
  await request<void>(`/risks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Führt eine typisierte API-Anfrage aus und übersetzt Fehlerantworten in JavaScript-Fehler. */
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

function toQueryString (query: ListRisksQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const value = params.toString()
  return value ? `?${value}` : ''
}

/** Wartet asynchron, ohne den Renderer-Thread zu blockieren. */
async function wait (milliseconds: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}
