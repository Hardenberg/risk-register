import type { FastifyInstance } from 'fastify'

import { reviewCycles } from '../../domain/entities/risk.js'

const settingsExample = {
  organizationName: 'Risk Register',
  defaultReviewCycle: 'Fix',
  reviewReminderDays: 14,
  highRiskThreshold: 10,
  criticalRiskThreshold: 16
} as const

const settingsProperties = {
  organizationName: {
    type: 'string',
    minLength: 1,
    maxLength: 120,
    description: 'Name der Organisation oder des Bereichs.',
    examples: [settingsExample.organizationName]
  },
  defaultReviewCycle: {
    type: 'string',
    enum: reviewCycles,
    description: 'Standard-Review-Rhythmus für neue Risiken.',
    examples: [settingsExample.defaultReviewCycle]
  },
  reviewReminderDays: {
    type: 'integer',
    minimum: 0,
    maximum: 365,
    description: 'Anzahl Tage vor dem Review-Datum für Erinnerungen.',
    examples: [settingsExample.reviewReminderDays]
  },
  highRiskThreshold: {
    type: 'integer',
    minimum: 1,
    maximum: 25,
    description: 'Risikowert ab dem Risiken als hoch gelten.',
    examples: [settingsExample.highRiskThreshold]
  },
  criticalRiskThreshold: {
    type: 'integer',
    minimum: 1,
    maximum: 25,
    description: 'Risikowert ab dem Risiken als kritisch gelten.',
    examples: [settingsExample.criticalRiskThreshold]
  }
} as const

export function registerApplicationSettingsSchemas (app: FastifyInstance): void {
  app.addSchema({
    $id: 'ApplicationSettings',
    title: 'ApplicationSettings',
    type: 'object',
    additionalProperties: false,
    properties: settingsProperties,
    required: ['organizationName', 'defaultReviewCycle', 'reviewReminderDays', 'highRiskThreshold', 'criticalRiskThreshold'],
    examples: [settingsExample]
  })

  app.addSchema({
    $id: 'UpdateApplicationSettings',
    title: 'UpdateApplicationSettings',
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: settingsProperties,
    examples: [settingsExample]
  })
}

export const applicationSettingsReference = { $ref: 'ApplicationSettings#' } as const
export const updateApplicationSettingsReference = { $ref: 'UpdateApplicationSettings#' } as const
