import type { FastifyInstance } from 'fastify'

import { measurePriorities, measureStatuses } from '../../domain/entities/measure.js'

const measureExample = {
  id: '01J00000000000000000002000',
  riskId: '01J00000000000000000000001',
  title: 'Alternativen Lieferanten qualifizieren',
  description: 'Beschaffung prüft und bewertet zwei alternative Lieferanten für kritische Komponenten.',
  owner: 'Lena Vogt',
  dueDate: '2026-08-15',
  priority: 'Hoch',
  status: 'Offen',
  createdAt: '2026-07-12T08:00:00.000Z',
  updatedAt: '2026-07-12T08:00:00.000Z'
} as const

const editableMeasureProperties = {
  riskId: {
    anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
    description: 'Optional verknüpftes Risiko.',
    examples: [measureExample.riskId]
  },
  title: {
    type: 'string',
    minLength: 1,
    maxLength: 200,
    description: 'Kurzer Titel der Maßnahme.',
    examples: [measureExample.title]
  },
  description: {
    type: 'string',
    minLength: 1,
    maxLength: 2000,
    description: 'Beschreibung der Maßnahme oder des nächsten Schritts.',
    examples: [measureExample.description]
  },
  owner: {
    type: 'string',
    minLength: 1,
    maxLength: 200,
    description: 'Verantwortliche Person.',
    examples: [measureExample.owner]
  },
  dueDate: {
    anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }],
    description: 'Fälligkeitsdatum im Format YYYY-MM-DD oder null.',
    examples: [measureExample.dueDate]
  },
  priority: {
    type: 'string',
    enum: measurePriorities,
    description: 'Priorität der Maßnahme.',
    examples: [measureExample.priority]
  },
  status: {
    type: 'string',
    enum: measureStatuses,
    description: 'Bearbeitungsstatus der Maßnahme.',
    examples: [measureExample.status]
  }
} as const

export function registerMeasureSchemas (app: FastifyInstance): void {
  app.addSchema({
    $id: 'Measure',
    title: 'Measure',
    type: 'object',
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
        description: 'Technische ID der Maßnahme.',
        examples: [measureExample.id]
      },
      ...editableMeasureProperties,
      createdAt: {
        type: 'string',
        format: 'date-time',
        readOnly: true,
        examples: [measureExample.createdAt]
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        readOnly: true,
        examples: [measureExample.updatedAt]
      }
    },
    required: ['id', 'riskId', 'title', 'description', 'owner', 'dueDate', 'priority', 'status', 'createdAt', 'updatedAt'],
    examples: [measureExample]
  })

  app.addSchema({
    $id: 'CreateMeasure',
    title: 'CreateMeasure',
    type: 'object',
    additionalProperties: false,
    properties: editableMeasureProperties,
    required: ['title', 'description', 'owner'],
    examples: [measureExample]
  })

  app.addSchema({
    $id: 'UpdateMeasure',
    title: 'UpdateMeasure',
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: editableMeasureProperties,
    examples: [{ status: 'In Arbeit' }]
  })

  app.addSchema({
    $id: 'MeasurePage',
    title: 'MeasurePage',
    description: 'Paginierte Ergebnisliste für Maßnahmen.',
    type: 'object',
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        items: { $ref: 'Measure#' }
      },
      page: { type: 'integer', minimum: 1, examples: [1] },
      pageSize: { type: 'integer', minimum: 1, maximum: 500, examples: [25] },
      total: { type: 'integer', minimum: 0, examples: [42] },
      totalPages: { type: 'integer', minimum: 1, examples: [2] }
    },
    required: ['items', 'page', 'pageSize', 'total', 'totalPages']
  })
}

export const measureReference = { $ref: 'Measure#' } as const
export const measurePageReference = { $ref: 'MeasurePage#' } as const
export const createMeasureReference = { $ref: 'CreateMeasure#' } as const
export const updateMeasureReference = { $ref: 'UpdateMeasure#' } as const
