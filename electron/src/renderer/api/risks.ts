export type RiskStatus = 'Offen' | 'In Bearbeitung' | 'Überwacht' | 'Geschlossen'

export interface Risk {
  id: string
  reference: string
  title: string
  category: string
  owner: string
  initialScore: number
  currentScore: number
  status: RiskStatus
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRiskInput {
  title: string
  category: string
  owner: string
  initialScore: number
  dueDate?: string | null
}

export type UpdateRiskInput = Partial<Pick<
Risk,
'title' | 'category' | 'owner' | 'initialScore' | 'currentScore' | 'status' | 'dueDate'
>>

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

/** Lädt alle Risiken und überbrückt kurze Startverzögerungen des lokalen Servers mit Backoff. */
export async function listRisks (): Promise<Risk[]> {
  let lastError: unknown

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await request<Risk[]>('/risks')
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

/** Löscht ein Risiko dauerhaft über die API. */
export async function deleteRisk (id: string): Promise<void> {
  await request<void>(`/risks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Führt eine typisierte API-Anfrage aus und übersetzt Fehlerantworten in JavaScript-Fehler. */
async function request<T> (path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string }
    throw new Error(error.message ?? `API-Anfrage fehlgeschlagen (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

/** Wartet asynchron, ohne den Renderer-Thread zu blockieren. */
async function wait (milliseconds: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}
