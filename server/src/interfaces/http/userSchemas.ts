import type { FastifyInstance } from 'fastify'

const userExample = {
  id: '01J00000000000000000001000',
  username: 'admin',
  name: 'Admin User',
  email: 'admin@example.local',
  department: 'Risk Management',
  role: 'Admin',
  active: true,
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-01T08:00:00.000Z'
} as const

const editableUserProperties = {
  username: {
    type: 'string',
    minLength: 3,
    maxLength: 80,
    pattern: '^[a-zA-Z0-9._-]+$',
    description: 'Eindeutiger Benutzername für die Anmeldung.',
    examples: [userExample.username]
  },
  name: {
    type: 'string',
    minLength: 1,
    maxLength: 200,
    description: 'Anzeigename des Benutzers.',
    examples: [userExample.name]
  },
  email: {
    type: 'string',
    format: 'email',
    maxLength: 254,
    description: 'E-Mail-Adresse des Benutzers.',
    examples: [userExample.email]
  },
  department: {
    type: 'string',
    minLength: 1,
    maxLength: 200,
    description: 'Abteilung des Benutzers.',
    examples: [userExample.department]
  },
  role: {
    type: 'string',
    enum: ['Admin', 'User'],
    description: 'Rolle des Benutzers. Nur Admins dürfen Einstellungen und Benutzer verwalten.',
    examples: [userExample.role]
  },
  active: {
    type: 'boolean',
    description: 'Steuert, ob sich der Benutzer anmelden darf.',
    examples: [userExample.active]
  }
} as const

const editableProfileProperties = {
  username: editableUserProperties.username,
  name: editableUserProperties.name,
  email: editableUserProperties.email,
  department: editableUserProperties.department
} as const

const passwordProperty = {
  type: 'string',
  minLength: 8,
  maxLength: 200,
  description: 'Passwort des Benutzers. Wird nie in API-Antworten zurückgegeben.',
  examples: ['admin123']
} as const

export function registerUserSchemas (app: FastifyInstance): void {
  app.addSchema({
    $id: 'User',
    title: 'User',
    type: 'object',
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
        description: 'Technische ID des Benutzers.',
        examples: [userExample.id]
      },
      ...editableUserProperties,
      createdAt: {
        type: 'string',
        format: 'date-time',
        readOnly: true,
        examples: [userExample.createdAt]
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        readOnly: true,
        examples: [userExample.updatedAt]
      }
    },
    required: ['id', 'username', 'name', 'email', 'department', 'role', 'active', 'createdAt', 'updatedAt'],
    examples: [userExample]
  })

  app.addSchema({
    $id: 'CreateUser',
    title: 'CreateUser',
    type: 'object',
    additionalProperties: false,
    properties: {
      ...editableUserProperties,
      password: passwordProperty
    },
    required: ['username', 'name', 'email', 'department', 'password'],
    examples: [{
      username: 'lena.vogt',
      name: 'Lena Vogt',
      email: 'lena.vogt@example.local',
      department: 'Risk Management',
      role: 'User',
      password: 'sicher123',
      active: true
    }]
  })

  app.addSchema({
    $id: 'UpdateUser',
    title: 'UpdateUser',
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      ...editableUserProperties,
      password: passwordProperty
    },
    examples: [{ active: false }]
  })

  app.addSchema({
    $id: 'UpdateProfile',
    title: 'UpdateProfile',
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      ...editableProfileProperties,
      password: passwordProperty
    },
    examples: [{ name: 'Lena Vogt', department: 'Risk Office' }]
  })

  app.addSchema({
    $id: 'LoginRequest',
    title: 'LoginRequest',
    type: 'object',
    additionalProperties: false,
    properties: {
      username: {
        type: 'string',
        minLength: 1,
        description: 'Benutzername oder E-Mail-Adresse.',
        examples: ['admin']
      },
      password: passwordProperty
    },
    required: ['username', 'password']
  })

  app.addSchema({
    $id: 'LoginResponse',
    title: 'LoginResponse',
    type: 'object',
    additionalProperties: false,
    properties: {
      user: { $ref: 'User#' },
      token: {
        type: 'string',
        minLength: 1,
        description: 'Bearer-Token für nachfolgende API-Anfragen.',
        examples: ['eyJzdWIiOiIxIn0.signature']
      }
    },
    required: ['user', 'token']
  })
}

export const userReference = { $ref: 'User#' } as const
export const createUserReference = { $ref: 'CreateUser#' } as const
export const updateUserReference = { $ref: 'UpdateUser#' } as const
export const updateProfileReference = { $ref: 'UpdateProfile#' } as const
export const loginRequestReference = { $ref: 'LoginRequest#' } as const
export const loginResponseReference = { $ref: 'LoginResponse#' } as const
