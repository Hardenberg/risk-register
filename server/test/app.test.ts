import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { buildApp } from '../src/app.js'

const app = buildApp({ logger: false })

after(async () => {
  await app.close()
})

test('GET / liefert die Bootstrap-Risikoübersicht', async () => {
  const response = await app.inject({ method: 'GET', url: '/' })

  assert.equal(response.statusCode, 200)
  assert.match(response.headers['content-type'] ?? '', /^text\/html/)
  assert.match(response.body, /Risiken im Blick/)
})

test('GET /health meldet einen gesunden Server', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { status: 'ok' })
})

test('GET /docs stellt die API-Dokumentation bereit', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs' })

  assert.equal(response.statusCode, 200)
  assert.match(response.headers['content-type'] ?? '', /^text\/html/)
})

test('OpenAPI dokumentiert Schemas, Operationen und Fehlerantworten vollständig', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs/json' })

  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['cache-control'], 'no-store')
  const document = response.json<{
    openapi: string
    tags: Array<{ name: string }>
    paths: Record<string, Record<string, { operationId: string, responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }>()

  assert.equal(document.openapi, '3.0.3')
  assert.deepEqual(document.tags.map((tag) => tag.name), ['System', 'Risiken'])
  assert.ok(document.components.schemas.Risk)
  assert.ok(document.components.schemas.CreateRisk)
  assert.ok(document.components.schemas.UpdateRisk)
  assert.ok(document.components.schemas.ErrorResponse)
  assert.equal(document.paths['/api/risks']?.get?.operationId, 'listRisks')
  assert.equal(document.paths['/api/risks']?.post?.operationId, 'createRisk')
  assert.equal(document.paths['/api/risks/{id}']?.put?.operationId, 'updateRisk')
  assert.ok(document.paths['/api/risks/{id}']?.get?.responses['404'])
  assert.ok(document.paths['/api/risks/{id}']?.delete?.responses['500'])
})

test('Risiken können vollständig über die API verwaltet werden', async () => {
  const initial = await app.inject({ method: 'GET', url: '/api/risks' })
  assert.equal(initial.statusCode, 200)
  assert.equal(initial.json<unknown[]>().length, 5)

  const createdResponse = await app.inject({
    method: 'POST',
    url: '/api/risks',
    payload: {
      title: 'Abhängigkeit von einem einzelnen Dienstleister',
      category: 'Lieferkette',
      owner: 'Anna Test',
      initialScore: 15,
      dueDate: '2026-09-30'
    }
  })
  assert.equal(createdResponse.statusCode, 201)
  const created = createdResponse.json<{ id: string, reference: string, status: string }>()
  assert.equal(created.reference, 'R-025')
  assert.equal(created.status, 'Offen')

  const updatedResponse = await app.inject({
    method: 'PUT',
    url: `/api/risks/${created.id}`,
    payload: { currentScore: 8, status: 'In Bearbeitung' }
  })
  assert.equal(updatedResponse.statusCode, 200)
  assert.equal(updatedResponse.json<{ currentScore: number }>().currentScore, 8)

  const foundResponse = await app.inject({ method: 'GET', url: `/api/risks/${created.id}` })
  assert.equal(foundResponse.statusCode, 200)
  assert.equal(foundResponse.json<{ title: string }>().title, 'Abhängigkeit von einem einzelnen Dienstleister')

  const searchResponse = await app.inject({ method: 'GET', url: '/api/risks?search=Dienstleister' })
  assert.equal(searchResponse.statusCode, 200)
  assert.equal(searchResponse.json<unknown[]>().length, 1)

  const deletedResponse = await app.inject({ method: 'DELETE', url: `/api/risks/${created.id}` })
  assert.equal(deletedResponse.statusCode, 204)

  const missingResponse = await app.inject({ method: 'GET', url: `/api/risks/${created.id}` })
  assert.equal(missingResponse.statusCode, 404)
  assert.equal(missingResponse.json<{ code: string }>().code, 'RISK_NOT_FOUND')
})

test('Ungültige Risikowerte werden abgewiesen', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/risks',
    payload: {
      title: 'Ungültiges Risiko',
      category: 'Test',
      owner: 'Test',
      initialScore: 26
    }
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json<{ code: string }>().code, 'VALIDATION_ERROR')
})
