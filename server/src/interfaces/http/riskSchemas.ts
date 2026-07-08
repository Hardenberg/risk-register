import type { FastifyInstance } from 'fastify'

import { riskStatuses } from '../../domain/entities/risk.js'

const riskExample = {
  id: '01J00000000000000000000001',
  reference: 'R-024',
  title: 'Lieferengpass bei Kernkomponenten',
  category: 'Lieferkette',
  owner: 'Lena Vogt',
  initialScore: 22,
  currentScore: 18,
  status: 'In Bearbeitung',
  dueDate: '2026-07-18',
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-07T10:30:00.000Z'
} as const

const editableProperties = {
  title: {
    type: 'string',
    minLength: 1,
    maxLength: 200,
    description: 'Kurze, eindeutige Bezeichnung des Risikos.',
    examples: ['Lieferengpass bei Kernkomponenten']
  },
  category: {
    type: 'string',
    minLength: 1,
    maxLength: 200,
    description: 'Fachliche Risikokategorie.',
    examples: ['Lieferkette']
  },
  owner: {
    type: 'string',
    minLength: 1,
    maxLength: 200,
    description: 'Für die Behandlung des Risikos verantwortliche Person.',
    examples: ['Lena Vogt']
  },
  initialScore: {
    type: 'integer',
    minimum: 1,
    maximum: 25,
    description: 'Risikowert bei der erstmaligen Erfassung (Eintrittswahrscheinlichkeit × Auswirkung).',
    examples: [22]
  },
  currentScore: {
    type: 'integer',
    minimum: 1,
    maximum: 25,
    description: 'Aktuell bewerteter Risikowert.',
    examples: [18]
  },
  status: {
    type: 'string',
    enum: riskStatuses,
    description: 'Aktueller Bearbeitungsstatus des Risikos.',
    examples: ['In Bearbeitung']
  },
  dueDate: {
    anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }],
    description: 'Geplantes Fälligkeitsdatum im Format YYYY-MM-DD oder null.',
    examples: ['2026-07-18']
  }
} as const

/** Registriert die wiederverwendbaren JSON-/OpenAPI-Schemas für Risiko- und Fehlerdaten. */
export function registerRiskSchemas (app: FastifyInstance): void {
  app.addSchema({
    $id: 'Risk',
    title: 'Risk',
    description: 'Ein vollständig gespeichertes Risiko.',
    type: 'object',
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
        description: 'Technische, unveränderliche ID des Risikos.',
        examples: [riskExample.id]
      },
      reference: {
        type: 'string',
        pattern: '^R-\\d{3,}$',
        description: 'Menschenlesbare, automatisch vergebene Risikoreferenz.',
        examples: [riskExample.reference]
      },
      ...editableProperties,
      createdAt: {
        type: 'string',
        format: 'date-time',
        readOnly: true,
        description: 'Zeitpunkt der Erfassung im ISO-8601-Format.',
        examples: [riskExample.createdAt]
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        readOnly: true,
        description: 'Zeitpunkt der letzten Änderung im ISO-8601-Format.',
        examples: [riskExample.updatedAt]
      }
    },
    required: [
      'id', 'reference', 'title', 'category', 'owner', 'initialScore',
      'currentScore', 'status', 'dueDate', 'createdAt', 'updatedAt'
    ],
    examples: [riskExample]
  })

  app.addSchema({
    $id: 'CreateRisk',
    title: 'CreateRisk',
    description: 'Daten zur Erfassung eines neuen Risikos. Nicht gesetzte optionale Werte werden aus dem Initialwert abgeleitet.',
    type: 'object',
    additionalProperties: false,
    properties: editableProperties,
    required: ['title', 'category', 'owner', 'initialScore'],
    examples: [{
      title: riskExample.title,
      category: riskExample.category,
      owner: riskExample.owner,
      initialScore: riskExample.initialScore,
      currentScore: riskExample.currentScore,
      status: riskExample.status,
      dueDate: riskExample.dueDate
    }]
  })

  app.addSchema({
    $id: 'UpdateRisk',
    title: 'UpdateRisk',
    description: 'Mindestens ein zu änderndes Feld eines vorhandenen Risikos.',
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: editableProperties,
    examples: [{ currentScore: 8, status: 'Überwacht' }]
  })

  app.addSchema({
    $id: 'ErrorResponse',
    title: 'ErrorResponse',
    description: 'Einheitliche Fehlerantwort der Risk-Register-API.',
    type: 'object',
    additionalProperties: false,
    properties: {
      code: {
        type: 'string',
        enum: ['VALIDATION_ERROR', 'RISK_NOT_FOUND', 'INTERNAL_ERROR'],
        examples: ['RISK_NOT_FOUND']
      },
      message: {
        type: 'string',
        examples: ['Das Risiko mit der angegebenen ID wurde nicht gefunden.']
      }
    },
    required: ['code', 'message']
  })

  app.addSchema({
    $id: 'HealthResponse',
    title: 'HealthResponse',
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['ok'], examples: ['ok'] }
    },
    required: ['status']
  })
}

export const riskReference = { $ref: 'Risk#' } as const
export const createRiskReference = { $ref: 'CreateRisk#' } as const
export const updateRiskReference = { $ref: 'UpdateRisk#' } as const
export const errorReference = { $ref: 'ErrorResponse#' } as const
