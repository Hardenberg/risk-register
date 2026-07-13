import { createApiError, setAuthSession, updateAuthUser, withAuthHeaders } from './auth'

export interface User {
  id: string
  username: string
  name: string
  email: string
  department: string
  role: 'Admin' | 'User'
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface LoginInput {
  username: string
  password: string
}

interface LoginResponse {
  user: User
  token: string
}

export interface CreateUserInput {
  username: string
  name: string
  email: string
  department: string
  role?: 'Admin' | 'User'
  password: string
  active?: boolean
}

export interface UpdateUserInput {
  username?: string
  name?: string
  email?: string
  department?: string
  role?: 'Admin' | 'User'
  password?: string
  active?: boolean
}

export interface UpdateProfileInput {
  username?: string
  name?: string
  email?: string
  department?: string
  password?: string
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

export async function loginUser (input: LoginInput): Promise<User> {
  const response = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  setAuthSession(response.token, response.user)
  return response.user
}

export async function listUsers (): Promise<User[]> {
  return await request<User[]>('/users')
}

export async function createUser (input: CreateUserInput): Promise<User> {
  return await request<User>('/users', {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input)
  })
}

export async function updateUser (id: string, input: UpdateUserInput): Promise<User> {
  return await request<User>(`/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input)
  })
}

export async function updateProfile (input: UpdateProfileInput): Promise<User> {
  const user = await request<User>('/profile', {
    method: 'PUT',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input)
  })
  updateAuthUser(user)
  return user
}

async function request<T> (path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: withAuthHeaders(init?.headers)
  })
  if (!response.ok) {
    throw await createApiError(response)
  }
  return await response.json() as T
}
