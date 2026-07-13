import type { FastifyInstance, preHandlerHookHandler } from 'fastify'

import type {
  GetApplicationSettings,
  UpdateApplicationSettings
} from '../../application/use-cases/applicationSettingsUseCases.js'
import type { UpdateApplicationSettingsInput } from '../../domain/entities/applicationSettings.js'
import { errorReference } from './riskSchemas.js'
import {
  applicationSettingsReference,
  updateApplicationSettingsReference
} from './applicationSettingsSchemas.js'

export interface ApplicationSettingsUseCases {
  get: GetApplicationSettings
  update: UpdateApplicationSettings
  authorizeAdmin: preHandlerHookHandler
}

const validationError = {
  ...errorReference,
  description: 'Die Einstellungen enthalten ungültige Werte.'
} as const

const authError = {
  ...errorReference,
  description: 'Die Anfrage benötigt eine gültige Anmeldung.'
} as const

const forbiddenError = {
  ...errorReference,
  description: 'Nur Admins dürfen Einstellungen verwalten.'
} as const

const internalError = {
  ...errorReference,
  description: 'Unerwarteter interner Serverfehler.'
} as const

export function registerApplicationSettingsRoutes (app: FastifyInstance, useCases: ApplicationSettingsUseCases): void {
  app.get('/api/settings', {
    preHandler: useCases.authorizeAdmin,
    schema: {
      operationId: 'getApplicationSettings',
      tags: ['Einstellungen'],
      security: [{ bearerAuth: [] }],
      summary: 'Einstellungen abrufen',
      description: 'Liefert das minimale Einstellungsset. Nur Admins dürfen darauf zugreifen.',
      response: {
        200: applicationSettingsReference,
        401: authError,
        403: forbiddenError,
        500: internalError
      }
    }
  }, async () => await useCases.get.execute())

  app.put<{ Body: UpdateApplicationSettingsInput }>('/api/settings', {
    preHandler: useCases.authorizeAdmin,
    schema: {
      operationId: 'updateApplicationSettings',
      tags: ['Einstellungen'],
      security: [{ bearerAuth: [] }],
      summary: 'Einstellungen speichern',
      description: 'Aktualisiert Organisation, Standard-Review und Risikoschwellen. Nur Admins dürfen speichern.',
      body: updateApplicationSettingsReference,
      response: {
        200: applicationSettingsReference,
        400: validationError,
        401: authError,
        403: forbiddenError,
        500: internalError
      }
    }
  }, async (request) => await useCases.update.execute(request.body))
}
