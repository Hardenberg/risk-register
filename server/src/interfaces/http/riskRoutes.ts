import type { FastifyInstance, preHandlerHookHandler } from 'fastify'

import type {
  CreateRisk,
  CreateRiskInput,
  DeleteRisk,
  GetRisk,
  ListRisks,
  UpdateRisk
} from '../../application/use-cases/riskUseCases.js'
import { riskStatuses, type RiskStatus, type UpdateRiskEntityInput } from '../../domain/entities/risk.js'
import type { SortDirection } from '../../domain/repositories/pagination.js'
import type { RiskListQuery, RiskSortField } from '../../domain/repositories/riskRepository.js'
import {
  createRiskReference,
  errorReference,
  riskPageReference,
  riskReference,
  updateRiskReference
} from './riskSchemas.js'

export interface RiskUseCases {
  list: ListRisks
  get: GetRisk
  create: CreateRisk
  update: UpdateRisk
  delete: DeleteRisk
  authorize: preHandlerHookHandler
}

interface RiskParams { id: string }
interface RiskQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: RiskStatus
  category?: string
  owner?: string
  sortBy?: RiskSortField
  sortDirection?: SortDirection
}

const riskSortFields: RiskSortField[] = ['reference', 'title', 'category', 'owner', 'currentScore', 'status', 'dueDate', 'reviewDate', 'createdAt', 'updatedAt']
const sortDirections: SortDirection[] = ['asc', 'desc']

const idParameter = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Technische ID des Risikos.',
      examples: ['01J00000000000000000000001']
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
  description: 'Die Anfrage benötigt eine gültige Anmeldung.'
} as const

const notFoundError = {
  ...errorReference,
  description: 'Unter der angegebenen ID wurde kein Risiko gefunden.'
} as const

const internalError = {
  ...errorReference,
  description: 'Unerwarteter interner Serverfehler.'
} as const

/** Verbindet die HTTP-Endpunkte mit den injizierten, infrastrukturell unabhängigen Use Cases. */
export function registerRiskRoutes (app: FastifyInstance, useCases: RiskUseCases): void {
  app.get<{ Querystring: RiskQuery }>('/api/risks', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'listRisks',
      tags: ['Risiken'],
      security: [{ bearerAuth: [] }],
      summary: 'Risiken abrufen',
      description: 'Liefert Risiken serverseitig gefiltert, sortiert und paginiert.',
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: 'Eins-basierte Seitennummer.' },
          pageSize: { type: 'integer', minimum: 1, maximum: 500, default: 50, description: 'Anzahl der Datensätze pro Seite.' },
          search: {
            type: 'string',
            maxLength: 200,
            description: 'Freitextsuche in Referenz, Bezeichnung, Beschreibung, Kategorie und Verantwortlichem.',
            examples: ['Lieferkette']
          },
          status: { type: 'string', enum: riskStatuses, description: 'Filtert nach Bearbeitungsstatus.' },
          category: { type: 'string', maxLength: 200, description: 'Filtert nach exakt passender Kategorie.' },
          owner: { type: 'string', maxLength: 200, description: 'Filtert nach exakt passender verantwortlicher Person.' },
          sortBy: { type: 'string', enum: riskSortFields, default: 'currentScore', description: 'Sortierfeld.' },
          sortDirection: { type: 'string', enum: sortDirections, default: 'desc', description: 'Sortierrichtung.' }
        }
      },
      response: {
        200: { ...riskPageReference, description: 'Die gefundene Risikoseite.' },
        401: authError,
        500: internalError
      }
    }
  }, async (request) => await useCases.list.execute(normalizeRiskQuery(request.query)))

  app.get<{ Params: RiskParams }>('/api/risks/:id', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'getRisk',
      tags: ['Risiken'],
      security: [{ bearerAuth: [] }],
      summary: 'Ein Risiko abrufen',
      description: 'Liefert ein einzelnes Risiko anhand seiner technischen ID.',
      params: idParameter,
      response: {
        200: { ...riskReference, description: 'Das angeforderte Risiko.' },
        401: authError,
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request) => await useCases.get.execute(request.params.id))

  app.post<{ Body: CreateRiskInput }>('/api/risks', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'createRisk',
      tags: ['Risiken'],
      security: [{ bearerAuth: [] }],
      summary: 'Ein Risiko erfassen',
      description: 'Erfasst ein neues Risiko. ID, Referenz und Zeitstempel werden serverseitig erzeugt.',
      body: createRiskReference,
      response: {
        201: { ...riskReference, description: 'Das erfolgreich erfasste Risiko.' },
        400: validationError,
        401: authError,
        500: internalError
      }
    }
  }, async (request, reply) => {
    const risk = await useCases.create.execute(request.body)
    return await reply.code(201).send(risk)
  })

  app.put<{ Params: RiskParams, Body: UpdateRiskEntityInput }>('/api/risks/:id', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'updateRisk',
      tags: ['Risiken'],
      security: [{ bearerAuth: [] }],
      summary: 'Ein Risiko aktualisieren',
      description: 'Aktualisiert die übergebenen Felder eines vorhandenen Risikos. Nicht übergebene Felder bleiben unverändert.',
      params: idParameter,
      body: updateRiskReference,
      response: {
        200: { ...riskReference, description: 'Das aktualisierte Risiko.' },
        400: validationError,
        401: authError,
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request) => await useCases.update.execute(request.params.id, request.body))

  app.delete<{ Params: RiskParams }>('/api/risks/:id', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'deleteRisk',
      tags: ['Risiken'],
      security: [{ bearerAuth: [] }],
      summary: 'Ein Risiko zur Löschung markieren',
      description: 'Markiert ein Risiko als gelöscht. Es bleibt in SQLite erhalten, wird aber in aktiven Listen nicht mehr ausgeliefert.',
      params: idParameter,
      response: {
        204: { type: 'null', description: 'Das Risiko wurde erfolgreich zur Löschung markiert.' },
        401: authError,
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request, reply) => {
    await useCases.delete.execute(request.params.id)
    return await reply.code(204).send()
  })
}

function normalizeRiskQuery (query: RiskQuery): RiskListQuery {
  return {
    page: clampInteger(query.page, 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampInteger(query.pageSize, 50, 1, 500),
    search: normalizeOptionalText(query.search),
    status: query.status,
    category: normalizeOptionalText(query.category),
    owner: normalizeOptionalText(query.owner),
    sortBy: query.sortBy ?? 'currentScore',
    sortDirection: query.sortDirection ?? 'desc'
  }
}

function normalizeOptionalText (value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function clampInteger (value: number | undefined, fallback: number, min: number, max: number): number {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(number)))
}
