import type { FastifyInstance, preHandlerHookHandler } from 'fastify'

import type {
  CreateMeasure,
  CreateMeasureInput,
  DeleteMeasure,
  GetMeasure,
  ListMeasures,
  UpdateMeasure
} from '../../application/use-cases/measureUseCases.js'
import { measurePriorities, measureStatuses, type MeasurePriority, type MeasureStatus, type UpdateMeasureEntityInput } from '../../domain/entities/measure.js'
import type { MeasureListQuery, MeasureSortField } from '../../domain/repositories/measureRepository.js'
import type { SortDirection } from '../../domain/repositories/pagination.js'
import {
  createMeasureReference,
  measurePageReference,
  measureReference,
  updateMeasureReference
} from './measureSchemas.js'
import { errorReference } from './riskSchemas.js'

export interface MeasureUseCases {
  list: ListMeasures
  get: GetMeasure
  create: CreateMeasure
  update: UpdateMeasure
  delete: DeleteMeasure
  authorize: preHandlerHookHandler
}

interface MeasureParams { id: string }
interface MeasureQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: MeasureStatus | 'Überfällig'
  priority?: MeasurePriority
  owner?: string
  riskId?: string
  sortBy?: MeasureSortField
  sortDirection?: SortDirection
}

const measureSortFields: MeasureSortField[] = ['title', 'owner', 'dueDate', 'priority', 'status', 'createdAt', 'updatedAt']
const sortDirections: SortDirection[] = ['asc', 'desc']

const idParameter = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Technische ID der Maßnahme.'
    }
  },
  required: ['id']
} as const

const validationError = {
  ...errorReference,
  description: 'Die Anfrage enthält ungültige oder unvollständige Maßnahmendaten.'
} as const

const authError = {
  ...errorReference,
  description: 'Die Anfrage benötigt eine gültige Anmeldung.'
} as const

const notFoundError = {
  ...errorReference,
  description: 'Unter der angegebenen ID wurde keine Maßnahme gefunden.'
} as const

const internalError = {
  ...errorReference,
  description: 'Unerwarteter interner Serverfehler.'
} as const

function escapeCSVValue (val: any): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes('"') || str.includes(',') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function convertToCSV (items: Array<Record<string, any>>, headers: string[]): string {
  const lines = [headers.join(';')]
  for (const item of items) {
    const row = headers.map((header) => escapeCSVValue(item[header]))
    lines.push(row.join(';'))
  }
  return lines.join('\r\n')
}

export function registerMeasureRoutes (app: FastifyInstance, useCases: MeasureUseCases): void {
  app.get<{ Querystring: MeasureQuery & { format?: 'json' | 'csv' } }>('/api/measures/export', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'exportMeasures',
      tags: ['Maßnahmen'],
      security: [{ bearerAuth: [] }],
      summary: 'Maßnahmen exportieren',
      description: 'Exportiert alle gefilterten Maßnahmen im CSV- oder JSON-Format.',
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          search: { type: 'string', maxLength: 200 },
          status: { type: 'string', enum: [...measureStatuses, 'Überfällig'] },
          priority: { type: 'string', enum: measurePriorities },
          owner: { type: 'string', maxLength: 200 },
          riskId: { type: 'string', minLength: 1 },
          sortBy: { type: 'string', enum: measureSortFields, default: 'dueDate' },
          sortDirection: { type: 'string', enum: sortDirections, default: 'asc' },
          format: { type: 'string', enum: ['json', 'csv'], default: 'json' }
        }
      },
      response: {
        401: authError,
        500: internalError
      }
    }
  }, async (request, reply) => {
    const listQuery = normalizeMeasureQuery({
      ...request.query,
      page: 1,
      pageSize: 100000
    }, true)
    const paginated = await useCases.list.execute(listQuery)
    const format = request.query.format ?? 'json'

    if (format === 'csv') {
      const headers = [
        'id', 'riskId', 'title', 'description', 'owner', 'dueDate',
        'priority', 'status', 'createdAt', 'updatedAt'
      ]
      const csv = convertToCSV(paginated.items, headers)
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="measures-export.csv"')
        .send(csv)
    }

    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="measures-export.json"')
      .send(JSON.stringify(paginated.items, null, 2))
  })

  app.get<{ Querystring: MeasureQuery }>('/api/measures', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'listMeasures',
      tags: ['Maßnahmen'],
      security: [{ bearerAuth: [] }],
      summary: 'Maßnahmen abrufen',
      description: 'Liefert Maßnahmen serverseitig gefiltert, sortiert und paginiert.',
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: 'Eins-basierte Seitennummer.' },
          pageSize: { type: 'integer', minimum: 1, maximum: 500, default: 50, description: 'Anzahl der Datensätze pro Seite.' },
          search: {
            type: 'string',
            maxLength: 200,
            description: 'Freitextsuche in Titel, Beschreibung und Verantwortlichem.'
          },
          status: { type: 'string', enum: [...measureStatuses, 'Überfällig'], description: 'Filtert nach Bearbeitungsstatus.' },
          priority: { type: 'string', enum: measurePriorities, description: 'Filtert nach Priorität.' },
          owner: { type: 'string', maxLength: 200, description: 'Filtert nach exakt passender verantwortlicher Person.' },
          riskId: { type: 'string', minLength: 1, description: 'Filtert nach verknüpftem Risiko.' },
          sortBy: { type: 'string', enum: measureSortFields, default: 'dueDate', description: 'Sortierfeld.' },
          sortDirection: { type: 'string', enum: sortDirections, default: 'asc', description: 'Sortierrichtung.' }
        }
      },
      response: {
        200: { ...measurePageReference, description: 'Die gefundene Maßnahmenseite.' },
        401: authError,
        500: internalError
      }
    }
  }, async (request) => await useCases.list.execute(normalizeMeasureQuery(request.query)))

  app.get<{ Params: MeasureParams }>('/api/measures/:id', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'getMeasure',
      tags: ['Maßnahmen'],
      security: [{ bearerAuth: [] }],
      summary: 'Eine Maßnahme abrufen',
      description: 'Liefert eine einzelne Maßnahme anhand ihrer technischen ID.',
      params: idParameter,
      response: {
        200: { ...measureReference, description: 'Die angeforderte Maßnahme.' },
        401: authError,
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request) => await useCases.get.execute(request.params.id))

  app.post<{ Body: CreateMeasureInput }>('/api/measures', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'createMeasure',
      tags: ['Maßnahmen'],
      security: [{ bearerAuth: [] }],
      summary: 'Eine Maßnahme anlegen',
      description: 'Legt eine neue Maßnahme optional mit Bezug zu einem Risiko an.',
      body: createMeasureReference,
      response: {
        201: { ...measureReference, description: 'Die erfolgreich angelegte Maßnahme.' },
        400: validationError,
        401: authError,
        500: internalError
      }
    }
  }, async (request, reply) => {
    const measure = await useCases.create.execute(request.body)
    return await reply.code(201).send(measure)
  })

  app.put<{ Params: MeasureParams, Body: UpdateMeasureEntityInput }>('/api/measures/:id', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'updateMeasure',
      tags: ['Maßnahmen'],
      security: [{ bearerAuth: [] }],
      summary: 'Eine Maßnahme bearbeiten',
      description: 'Aktualisiert die übergebenen Felder einer vorhandenen Maßnahme.',
      params: idParameter,
      body: updateMeasureReference,
      response: {
        200: { ...measureReference, description: 'Die aktualisierte Maßnahme.' },
        400: validationError,
        401: authError,
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request) => await useCases.update.execute(request.params.id, request.body))

  app.delete<{ Params: MeasureParams }>('/api/measures/:id', {
    preHandler: useCases.authorize,
    schema: {
      operationId: 'deleteMeasure',
      tags: ['Maßnahmen'],
      security: [{ bearerAuth: [] }],
      summary: 'Eine Maßnahme löschen',
      description: 'Entfernt eine Maßnahme nach Benutzerbestätigung in der Oberfläche.',
      params: idParameter,
      response: {
        204: { type: 'null', description: 'Die Maßnahme wurde gelöscht.' },
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

function normalizeMeasureQuery (query: MeasureQuery, isExport = false): MeasureListQuery {
  return {
    page: clampInteger(query.page, 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampInteger(query.pageSize, 50, 1, isExport ? 1000000 : 500),
    search: normalizeOptionalText(query.search),
    status: query.status === 'Überfällig' ? undefined : (query.status as any),
    priority: query.priority,
    owner: normalizeOptionalText(query.owner),
    riskId: normalizeOptionalText(query.riskId),
    sortBy: query.sortBy ?? 'dueDate',
    sortDirection: query.sortDirection ?? 'asc',
    overdue: query.status === 'Überfällig'
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
