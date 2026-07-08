import type { FastifyInstance } from 'fastify'

import type {
  CreateRisk,
  CreateRiskInput,
  DeleteRisk,
  GetRisk,
  ListRisks,
  UpdateRisk
} from '../../application/use-cases/riskUseCases.js'
import type { UpdateRiskEntityInput } from '../../domain/entities/risk.js'
import {
  createRiskReference,
  errorReference,
  riskReference,
  updateRiskReference
} from './riskSchemas.js'

export interface RiskUseCases {
  list: ListRisks
  get: GetRisk
  create: CreateRisk
  update: UpdateRisk
  delete: DeleteRisk
}

interface RiskParams { id: string }
interface RiskQuery { search?: string }

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
    schema: {
      operationId: 'listRisks',
      tags: ['Risiken'],
      summary: 'Alle Risiken abrufen',
      description: 'Liefert alle Risiken absteigend nach aktuellem Risikowert. Optional kann über mehrere Textfelder gesucht werden.',
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          search: {
            type: 'string',
            maxLength: 200,
            description: 'Freitextsuche in Referenz, Bezeichnung, Kategorie und Verantwortlichem.',
            examples: ['Lieferkette']
          }
        }
      },
      response: {
        200: {
          type: 'array',
          description: 'Die gefundenen Risiken, sortiert nach aktuellem Risikowert.',
          items: riskReference
        },
        500: internalError
      }
    }
  }, async (request) => await useCases.list.execute(request.query.search))

  app.get<{ Params: RiskParams }>('/api/risks/:id', {
    schema: {
      operationId: 'getRisk',
      tags: ['Risiken'],
      summary: 'Ein Risiko abrufen',
      description: 'Liefert ein einzelnes Risiko anhand seiner technischen ID.',
      params: idParameter,
      response: {
        200: { ...riskReference, description: 'Das angeforderte Risiko.' },
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request) => await useCases.get.execute(request.params.id))

  app.post<{ Body: CreateRiskInput }>('/api/risks', {
    schema: {
      operationId: 'createRisk',
      tags: ['Risiken'],
      summary: 'Ein Risiko erfassen',
      description: 'Erfasst ein neues Risiko. ID, Referenz und Zeitstempel werden serverseitig erzeugt.',
      body: createRiskReference,
      response: {
        201: { ...riskReference, description: 'Das erfolgreich erfasste Risiko.' },
        400: validationError,
        500: internalError
      }
    }
  }, async (request, reply) => {
    const risk = await useCases.create.execute(request.body)
    return await reply.code(201).send(risk)
  })

  app.put<{ Params: RiskParams, Body: UpdateRiskEntityInput }>('/api/risks/:id', {
    schema: {
      operationId: 'updateRisk',
      tags: ['Risiken'],
      summary: 'Ein Risiko aktualisieren',
      description: 'Aktualisiert die übergebenen Felder eines vorhandenen Risikos. Nicht übergebene Felder bleiben unverändert.',
      params: idParameter,
      body: updateRiskReference,
      response: {
        200: { ...riskReference, description: 'Das aktualisierte Risiko.' },
        400: validationError,
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request) => await useCases.update.execute(request.params.id, request.body))

  app.delete<{ Params: RiskParams }>('/api/risks/:id', {
    schema: {
      operationId: 'deleteRisk',
      tags: ['Risiken'],
      summary: 'Ein Risiko löschen',
      description: 'Löscht ein Risiko dauerhaft aus dem Register.',
      params: idParameter,
      response: {
        204: { type: 'null', description: 'Das Risiko wurde erfolgreich gelöscht.' },
        404: notFoundError,
        500: internalError
      }
    }
  }, async (request, reply) => {
    await useCases.delete.execute(request.params.id)
    return await reply.code(204).send()
  })
}
