import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

import cors from '@fastify/cors'
import staticFiles from '@fastify/static'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyServerOptions, type preHandlerHookHandler } from 'fastify'

import { InvalidCredentialsError } from './application/errors/invalidCredentialsError.js'
import { MeasureNotFoundError } from './application/errors/measureNotFoundError.js'
import { RiskNotFoundError } from './application/errors/riskNotFoundError.js'
import { UserNotFoundError } from './application/errors/userNotFoundError.js'
import {
  GetApplicationSettings,
  UpdateApplicationSettings
} from './application/use-cases/applicationSettingsUseCases.js'
import {
  CreateMeasure,
  DeleteMeasure,
  GetMeasure,
  ListMeasures,
  UpdateMeasure
} from './application/use-cases/measureUseCases.js'
import {
  CreateRisk,
  DeleteRisk,
  GetRisk,
  ListRisks,
  UpdateRisk
} from './application/use-cases/riskUseCases.js'
import {
  AuthenticateUser,
  CreateUser,
  GetUser,
  ListUsers,
  UpdateUser
} from './application/use-cases/userUseCases.js'
import { ApplicationSettingsValidationError } from './domain/entities/applicationSettings.js'
import { MeasureValidationError } from './domain/entities/measure.js'
import { RiskValidationError } from './domain/entities/risk.js'
import { UserValidationError } from './domain/entities/user.js'
import { SqliteDatabase } from './infrastructure/database/sqliteDatabase.js'
import { SqliteApplicationSettingsRepository } from './infrastructure/repositories/sqliteApplicationSettingsRepository.js'
import { SqliteMeasureRepository } from './infrastructure/repositories/sqliteMeasureRepository.js'
import { SqliteRiskRepository } from './infrastructure/repositories/sqliteRiskRepository.js'
import { SqliteUserRepository } from './infrastructure/repositories/sqliteUserRepository.js'
import { AuthTokenService } from './infrastructure/security/authTokenService.js'
import { registerApplicationSettingsRoutes } from './interfaces/http/applicationSettingsRoutes.js'
import { registerApplicationSettingsSchemas } from './interfaces/http/applicationSettingsSchemas.js'
import { registerMeasureRoutes } from './interfaces/http/measureRoutes.js'
import { registerMeasureSchemas } from './interfaces/http/measureSchemas.js'
import { registerRiskRoutes } from './interfaces/http/riskRoutes.js'
import { registerRiskSchemas } from './interfaces/http/riskSchemas.js'
import { registerUserRoutes } from './interfaces/http/userRoutes.js'
import { registerUserSchemas } from './interfaces/http/userSchemas.js'

export interface BuildAppOptions extends FastifyServerOptions {
  databasePath?: string
}

/** Komponiert Fastify, Sicherheitsadapter, OpenAPI, Use Cases und SQLite zu einer Anwendung. */
export function buildApp (options: BuildAppOptions = {}): FastifyInstance {
  const { databasePath = ':memory:', ...fastifyOptions } = options
  const app = Fastify({ logger: true, ...fastifyOptions })
  const database = new SqliteDatabase(databasePath)
  const repository = new SqliteRiskRepository(database)
  const measureRepository = new SqliteMeasureRepository(database)
  const userRepository = new SqliteUserRepository(database)
  const settingsRepository = new SqliteApplicationSettingsRepository(database)
  const authTokens = new AuthTokenService(process.env.AUTH_TOKEN_SECRET ?? database.readSetting('auth_token_secret') ?? undefined)
  const now = (): Date => new Date()

  const authorize: preHandlerHookHandler = async (request, reply) => {
    await requireAuthorizedUser(request.headers.authorization, reply)
  }

  const getCurrentUserId = async (authorization: string | undefined): Promise<string> => {
    const user = await resolveAuthorizedUser(authorization)
    if (!user) throw new InvalidCredentialsError()
    return user.toPrimitives().id
  }

  const authorizeAdmin: preHandlerHookHandler = async (request, reply) => {
    const user = await requireAuthorizedUser(request.headers.authorization, reply)
    if (!user) return
    if (user.toPrimitives().role !== 'Admin') {
      return await reply.code(403).send({ code: 'FORBIDDEN', message: 'Nur Admins dürfen diese Funktion verwenden.' })
    }
  }

  async function requireAuthorizedUser (authorization: string | undefined, reply: FastifyReply) {
    const user = await resolveAuthorizedUser(authorization)
    if (!user) {
      await reply.code(401).send({ code: 'AUTH_FAILED', message: 'Bitte erneut anmelden.' })
      return null
    }

    return user
  }

  async function resolveAuthorizedUser (authorization: string | undefined) {
    const userId = authTokens.verifyToken(readBearerToken(authorization))
    if (!userId) return null

    const user = await userRepository.findById(userId)
    if (!user || !user.toPrimitives().active) return null
    return user
  }

  app.register(cors, {
    origin: (origin, callback) => {
      const allowed = origin === undefined || origin === 'null'
      callback(null, allowed)
    }
  })

  app.register(staticFiles, {
    root: resolve('public'),
    prefix: '/'
  })

  app.register(swagger, {
    refResolver: {
      buildLocalReference (schema, _baseUri, _fragment, index) {
        return typeof schema.$id === 'string' ? schema.$id : `schema-${index}`
      }
    },
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Risk Register API',
        version: '1.0.0',
        description: [
          'REST-API zur Verwaltung eines Risikoregisters.',
          '',
          'Die API unterstützt das Erfassen, Suchen, Aktualisieren und Löschen von Risiken.',
          'Risikowerte liegen zwischen 1 und 25 und ergeben sich fachlich aus Eintrittswahrscheinlichkeit × Auswirkung.'
        ].join('\n'),
        contact: {
          name: 'Risk Register Team'
        },
        license: {
          name: 'Private use'
        }
      },
      servers: [
        { url: 'http://127.0.0.1:8000', description: 'Lokale Entwicklungsumgebung' }
      ],
      tags: [
        { name: 'System', description: 'Betriebs- und Verfügbarkeitsinformationen.' },
        { name: 'Risiken', description: 'Erfassen und Verwalten von Risiken im zentralen Register.' },
        { name: 'Maßnahmen', description: 'Operative Maßnahmen zu Risiken erfassen und verfolgen.' },
        { name: 'Benutzer', description: 'Anmeldung und Benutzerverwaltung für die Electron-App.' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'signed-token'
          }
        }
      },
      externalDocs: {
        description: 'Bootstrap-Risikoübersicht öffnen',
        url: 'http://127.0.0.1:8000/'
      }
    }
  })

  app.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: true,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 2
    }
  })

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/docs')) {
      reply.header('Cache-Control', 'no-store')
    }
    return payload
  })

  /** Registriert Schemas und Routen erst, nachdem das asynchrone Swagger-Plugin aktiv ist. */
  app.register(async function apiRoutes (api) {
    registerRiskSchemas(api)
    registerMeasureSchemas(api)
    registerUserSchemas(api)
    registerApplicationSettingsSchemas(api)

    api.get('/health', {
      schema: {
        operationId: 'getHealth',
        tags: ['System'],
        summary: 'Serverstatus abrufen',
        description: 'Ein einfacher Liveness-Check für den Fastify-Prozess und seine SQLite-Anbindung.',
        response: {
          200: { $ref: 'HealthResponse#', description: 'Der Server ist betriebsbereit.' }
        }
      }
    }, async () => ({ status: 'ok' }))

    registerRiskRoutes(api, {
      list: new ListRisks(repository),
      get: new GetRisk(repository),
      create: new CreateRisk({ repository, generateId: randomUUID, now }),
      update: new UpdateRisk(repository, now),
      delete: new DeleteRisk(repository, now),
      authorize
    })

    registerMeasureRoutes(api, {
      list: new ListMeasures(measureRepository),
      get: new GetMeasure(measureRepository),
      create: new CreateMeasure({ repository: measureRepository, generateId: randomUUID, now }),
      update: new UpdateMeasure(measureRepository, now),
      delete: new DeleteMeasure(measureRepository),
      authorize
    })

    registerUserRoutes(api, {
      authenticate: new AuthenticateUser(userRepository),
      get: new GetUser(userRepository),
      list: new ListUsers(userRepository),
      create: new CreateUser({ repository: userRepository, generateId: randomUUID, now }),
      update: new UpdateUser({ repository: userRepository, now }),
      updateProfile: new UpdateUser({ repository: userRepository, now }),
      createToken: (userId) => authTokens.createToken(userId),
      getCurrentUserId,
      authorize,
      authorizeAdmin
    })

    registerApplicationSettingsRoutes(api, {
      get: new GetApplicationSettings(settingsRepository),
      update: new UpdateApplicationSettings(settingsRepository),
      authorizeAdmin
    })
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof RiskNotFoundError) {
      return reply.code(404).send({ code: 'RISK_NOT_FOUND', message: error.message })
    }
    if (error instanceof MeasureNotFoundError) {
      return reply.code(404).send({ code: 'MEASURE_NOT_FOUND', message: error.message })
    }
    if (error instanceof UserNotFoundError) {
      return reply.code(404).send({ code: 'USER_NOT_FOUND', message: error.message })
    }
    if (error instanceof InvalidCredentialsError) {
      return reply.code(401).send({ code: 'AUTH_FAILED', message: error.message })
    }
    const isFastifyValidationError = typeof error === 'object' && error !== null && 'validation' in error
    if (error instanceof RiskValidationError || error instanceof MeasureValidationError || error instanceof UserValidationError || error instanceof ApplicationSettingsValidationError || isFastifyValidationError) {
      const message = error instanceof Error ? error.message : 'Die Anfrage ist ungültig.'
      return reply.code(400).send({ code: 'VALIDATION_ERROR', message })
    }

    app.log.error(error)
    return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Ein interner Fehler ist aufgetreten.' })
  })

  app.addHook('onClose', async () => {
    database.close()
  })

  return app
}

function readBearerToken (authorization: string | undefined): string {
  if (!authorization) return ''
  if (!authorization.toLowerCase().startsWith('bearer ')) return ''
  return authorization.slice(7).trim()
}
