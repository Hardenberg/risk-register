import type { User } from './users'

const storageKey = 'risk-register.session'

interface StoredSession {
  token: string
  user: User
}

let authToken: string | null = null

export class AuthenticationRequiredError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'AuthenticationRequiredError'
  }
}

export function setAuthSession (token: string, user: User): void {
  authToken = token
  window.localStorage.setItem(storageKey, JSON.stringify({ token, user }))
}

export function readAuthSession (): StoredSession | null {
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (!parsed.token || !parsed.user) {
      clearAuthToken()
      return null
    }
    authToken = parsed.token
    return { token: parsed.token, user: parsed.user }
  } catch {
    clearAuthToken()
    return null
  }
}

export function clearAuthToken (): void {
  authToken = null
  window.localStorage.removeItem(storageKey)
}

export function updateAuthUser (user: User): void {
  const session = readAuthSession()
  if (!session) return
  setAuthSession(session.token, user)
}

export function withAuthHeaders (headers: HeadersInit = {}): HeadersInit {
  const nextHeaders = new Headers(headers)
  if (authToken && !nextHeaders.has('Authorization')) {
    nextHeaders.set('Authorization', `Bearer ${authToken}`)
  }
  return nextHeaders
}

export async function createApiError (response: Response): Promise<Error> {
  const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string }
  const message = error.message ?? `API-Anfrage fehlgeschlagen (${response.status})`
  if (response.status === 401) {
    clearAuthToken()
    return new AuthenticationRequiredError(message)
  }
  return new Error(message)
}

export function isAuthenticationRequiredError (error: unknown): error is AuthenticationRequiredError {
  return error instanceof AuthenticationRequiredError
}
