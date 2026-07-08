import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

import cors from '@fastify/cors'
import staticFiles from '@fastify/static'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'

import { RiskNotFoundError } from './application/errors/riskNotFoundError.js'
import {
  CreateRisk,
  DeleteRisk,
  GetRisk,
  ListRisks,
  UpdateRisk
} from './application/use-cases/riskUseCases.js'
import { RiskValidationError } from './domain/entities/risk.js'
import { SqliteDatabase } from './infrastructure/database/sqliteDatabase.js'
import { SqliteRiskRepository } from './infrastructure/repositories/sqliteRiskRepository.js'
import { registerRiskRoutes } from './interfaces/http/riskRoutes.js'
import { registerRiskSchemas } from './interfaces/http/riskSchemas.js'

export interface BuildAppOptions extends FastifyServerOptions {
  databasePath?: string
}

/** Komponiert Fastify, Sicherheitsadapter, OpenAPI, Use Cases und SQLite zu einer Anwendung. */
export function buildApp (options: BuildAppOptions = {}): FastifyInstance {
  const { databasePath = ':memory:', ...fastifyOptions } = options
  const app = Fastify({ logger: true, ...fastifyOptions })
  const database = new SqliteDatabase(databasePath)
  const repository = new SqliteRiskRepository(database)
  const now = (): Date => new Date()

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
        { name: 'Risiken', description: 'Erfassen und Verwalten von Risiken im zentralen Register.' }
      ],
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
      delete: new DeleteRisk(repository)
    })
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof RiskNotFoundError) {
      return reply.code(404).send({ code: 'RISK_NOT_FOUND', message: error.message })
    }
    const isFastifyValidationError = typeof error === 'object' && error !== null && 'validation' in error
    if (error instanceof RiskValidationError || isFastifyValidationError) {
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
