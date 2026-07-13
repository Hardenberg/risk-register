import type { FastifyInstance, preHandlerHookHandler } from 'fastify'

import type {
  AuthenticateUser,
  CreateUser,
  CreateUserInput,
  GetUser,
  ListUsers,
  LoginInput,
  UpdateUser,
  UpdateProfileInput,
  UpdateUserInput
} from '../../application/use-cases/userUseCases.js'
import { UserValidationError } from '../../domain/entities/user.js'
import {
  createUserReference,
  loginRequestReference,
  loginResponseReference,
  updateProfileReference,
  updateUserReference,
  userReference
} from './userSchemas.js'
import { errorReference } from './riskSchemas.js'

export interface UserUseCases {
  authenticate: AuthenticateUser
  get: GetUser
  list: ListUsers
  create: CreateUser
  update: UpdateUser
  updateProfile: UpdateUser
  createToken: (userId: string) => string
  getCurrentUserId: (authorization: string | undefined) => Promise<string>
  authorize: preHandlerHookHandler
  authorizeAdmin: preHandlerHookHandler
}

interface UserParams { id: string }

const idParameter = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Technische ID des Benutzers.'
    }
  },
  required: ['id']
} as const

const validationError = {
  ...errorReference,
  description: 'Die Anfrage enthält ungültige oder unvollständige Daten.'
} as const

const authError = {
  ...errorReference,
  description: 'Die Anmeldedaten sind ungültig oder der Benutzer ist deaktiviert.'
} as const

const forbiddenError = {
  ...errorReference,
  description: 'Nur Admins dürfen Benutzer verwalten.'
} as const

const notFoundError = {
  ...errorReference,
  description: 'Unter der angegebenen ID wurde kein Benutzer gefunden.'
} as const

const internalError = {
  ...errorReference,
  description: 'Unerwarteter interner Serverfehler.'
} as const

export function registerUserRoutes (app: FastifyInstance, useCases: UserUseCases): void {
  app.post<{ Body: LoginInput }>('/api/auth/login', {
    schema: {
      operationId: 'loginUser',
      tags: ['Benutzer'],
      summary: 'Benutzer anmelden',
      description: 'Prüft Benutzername/E-Mail und Passwort. Deaktivierte Benutzer können sich nicht anmelden.',
      body: loginRequestReference,
      response: {
        200: loginResponseReference,
        401: authError,
        500: internalError
      }
    }
  }, async (request) => {
    const user = await useCases.authenticate.execute(request.body)
    return { user, token: useCases.createToken(user.id) }
  })

  app.get('/api/profile', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'getProfile',
      tags: ['Benutzer'],
      security: [{ bearerAuth: [] }],
      summary: 'Eigenes Profil abrufen',
      description: 'Liefert das Profil des angemeldeten Benutzers ohne Passwortdaten.',
      response: {
        200: userReference,
        401: authError,
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request) => await useCases.get.execute(await useCases.getCurrentUserId(request.headers.authorization)))

  app.put<{ Body: UpdateProfileInput }>('/api/profile', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'updateProfile',
      tags: ['Benutzer'],
      security: [{ bearerAuth: [] }],
      summary: 'Eigenes Profil bearbeiten',
      description: 'Aktualisiert Profilfelder oder Passwort des angemeldeten Benutzers. Rolle und Aktivstatus bleiben Admins vorbehalten.',
      body: updateProfileReference,
      response: {
        200: userReference,
        400: validationError,
        401: authError,
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request) => await useCases.updateProfile.execute(
    await useCases.getCurrentUserId(request.headers.authorization),
    toProfileInput(request.body)
  ))

  app.get('/api/users', {
    preHandler: useCases.authorizeAdmin,
    schema: {
      operationId: 'listUsers',
      tags: ['Benutzer'],
      security: [{ bearerAuth: [] }],
      summary: 'Benutzer auflisten',
      description: 'Liefert alle Benutzer ohne Passwortdaten.',
      response: {
        200: {
          type: 'array',
          items: userReference
        },
        401: authError,
        403: forbiddenError,
        500: internalError
      }
    }
  }, async () => await useCases.list.execute())

  app.post<{ Body: CreateUserInput }>('/api/users', {
    preHandler: useCases.authorizeAdmin,
    schema: {
      operationId: 'createUser',
      tags: ['Benutzer'],
      security: [{ bearerAuth: [] }],
      summary: 'Benutzer anlegen',
      description: 'Legt einen Benutzer mit gehashtem Passwort an.',
      body: createUserReference,
      response: {
        201: userReference,
        400: validationError,
        401: authError,
        403: forbiddenError,
        500: internalError
      }
    }
  }, async (request, reply) => {
    const user = await useCases.create.execute(request.body)
    return await reply.code(201).send(user)
  })

  app.put<{ Params: UserParams, Body: UpdateUserInput }>('/api/users/:id', {
    preHandler: useCases.authorizeAdmin,
    schema: {
      operationId: 'updateUser',
      tags: ['Benutzer'],
      security: [{ bearerAuth: [] }],
      summary: 'Benutzer bearbeiten',
      description: 'Aktualisiert Benutzerstammdaten, Passwort oder Aktivstatus.',
      params: idParameter,
      body: updateUserReference,
      response: {
        200: userReference,
        400: validationError,
        401: authError,
        403: forbiddenError,
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request) => await useCases.update.execute(request.params.id, request.body))
}

function toProfileInput (body: UpdateProfileInput): UpdateProfileInput {
  const rawBody = body as UpdateProfileInput & Record<string, unknown>
  const allowedFields = ['username', 'name', 'email', 'department', 'password']
  const keys = Object.keys(rawBody)
  const forbiddenField = keys.find((key) => !allowedFields.includes(key))
  if (forbiddenField) {
    throw new UserValidationError('Dieses Profilfeld darf nicht bearbeitet werden.')
  }

  const input: UpdateProfileInput = {}
  if (rawBody.username !== undefined) input.username = rawBody.username
  if (rawBody.name !== undefined) input.name = rawBody.name
  if (rawBody.email !== undefined) input.email = rawBody.email
  if (rawBody.department !== undefined) input.department = rawBody.department
  if (rawBody.password !== undefined) input.password = rawBody.password

  if (Object.keys(input).length === 0) {
    throw new UserValidationError('Mindestens ein Profilfeld muss angegeben werden.')
  }

  return input
}
