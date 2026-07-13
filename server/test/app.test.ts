import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, test } from 'node:test'

import { buildApp } from '../src/app.js'

const app = buildApp({ logger: false })

interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

after(async () => {
  await app.close()
})

test('GET / liefert die Bootstrap-Risikoübersicht', async () => {
  const response = await app.inject({ method: 'GET', url: '/' })

  assert.equal(response.statusCode, 200)
  assert.match(response.headers['content-type'] ?? '', /^text\/html/)
  assert.match(response.body, /Risiken im Blick/)
  assert.match(response.body, /SERVERANMELDUNG/)
  assert.match(response.body, /Benutzerverwaltung/)
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
    paths: Record<string, Record<string, { operationId: string, parameters?: Array<{ name: string }>, responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }>()

  assert.equal(document.openapi, '3.0.3')
  assert.deepEqual(document.tags.map((tag) => tag.name), ['System', 'Risiken', 'Maßnahmen', 'Benutzer'])
  assert.ok(document.components.schemas.Risk)
  assert.ok(document.components.schemas.RiskPage)
  assert.ok(document.components.schemas.CreateRisk)
  assert.ok(document.components.schemas.UpdateRisk)
  assert.ok(document.components.schemas.Measure)
  assert.ok(document.components.schemas.MeasurePage)
  assert.ok(document.components.schemas.CreateMeasure)
  assert.ok(document.components.schemas.UpdateMeasure)
  assert.ok(document.components.schemas.User)
  assert.ok(document.components.schemas.CreateUser)
  assert.ok(document.components.schemas.UpdateUser)
  assert.ok(document.components.schemas.UpdateProfile)
  assert.ok(document.components.schemas.LoginRequest)
  assert.ok(document.components.schemas.LoginResponse)
  assert.ok(document.components.schemas.ApplicationSettings)
  assert.ok(document.components.schemas.UpdateApplicationSettings)
  assert.ok(document.components.schemas.ErrorResponse)
  assert.equal(document.paths['/api/risks']?.get?.operationId, 'listRisks')
  assert.equal(document.paths['/api/risks']?.post?.operationId, 'createRisk')
  assert.equal(document.paths['/api/risks/{id}']?.put?.operationId, 'updateRisk')
  assert.equal(document.paths['/api/measures']?.get?.operationId, 'listMeasures')
  assert.equal(document.paths['/api/measures']?.post?.operationId, 'createMeasure')
  assert.equal(document.paths['/api/measures/{id}']?.get?.operationId, 'getMeasure')
  assert.equal(document.paths['/api/measures/{id}']?.put?.operationId, 'updateMeasure')
  assert.equal(document.paths['/api/measures/{id}']?.delete?.operationId, 'deleteMeasure')
  assert.equal(document.paths['/api/auth/login']?.post?.operationId, 'loginUser')
  assert.equal(document.paths['/api/profile']?.get?.operationId, 'getProfile')
  assert.equal(document.paths['/api/profile']?.put?.operationId, 'updateProfile')
  assert.equal(document.paths['/api/users']?.get?.operationId, 'listUsers')
  assert.equal(document.paths['/api/users']?.post?.operationId, 'createUser')
  assert.equal(document.paths['/api/users/{id}']?.put?.operationId, 'updateUser')
  assert.equal(document.paths['/api/settings']?.get?.operationId, 'getApplicationSettings')
  assert.equal(document.paths['/api/settings']?.put?.operationId, 'updateApplicationSettings')
  assert.ok(document.paths['/api/risks']?.get?.responses['200'])
  assert.ok(document.paths['/api/measures']?.get?.responses['200'])
  assertQueryParameter(document.paths['/api/risks']?.get, 'page')
  assertQueryParameter(document.paths['/api/risks']?.get, 'pageSize')
  assertQueryParameter(document.paths['/api/risks']?.get, 'status')
  assertQueryParameter(document.paths['/api/risks']?.get, 'sortBy')
  assertQueryParameter(document.paths['/api/measures']?.get, 'priority')
  assertQueryParameter(document.paths['/api/measures']?.get, 'riskId')
  assertQueryParameter(document.paths['/api/measures']?.get, 'sortDirection')
  assert.ok(document.paths['/api/risks/{id}']?.get?.responses['404'])
  assert.ok(document.paths['/api/risks']?.get?.responses['401'])
  assert.ok(document.paths['/api/risks/{id}']?.delete?.responses['500'])
  assert.ok(document.paths['/api/measures/{id}']?.get?.responses['404'])
  assert.ok(document.paths['/api/measures']?.get?.responses['401'])
  assert.ok(document.paths['/api/measures/{id}']?.delete?.responses['500'])
  assert.ok(document.paths['/api/auth/login']?.post?.responses['401'])
  assert.ok(document.paths['/api/profile']?.get?.responses['401'])
  assert.ok(document.paths['/api/profile']?.put?.responses['400'])
  assert.ok(document.paths['/api/users']?.get?.responses['401'])
  assert.ok(document.paths['/api/settings']?.get?.responses['403'])
})

test('Benutzer können sich anmelden, angelegt, bearbeitet und deaktiviert werden', async () => {
  const adminLoginResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'admin123' }
  })
  assert.equal(adminLoginResponse.statusCode, 200)
  const adminLogin = adminLoginResponse.json<{ user: Record<string, unknown> & { username: string, role: string }, token: string }>()
  assert.equal(adminLogin.user.username, 'admin')
  assert.equal(adminLogin.user.role, 'Admin')
  assert.equal(typeof adminLogin.token, 'string')
  assert.equal(Object.hasOwn(adminLogin.user, 'passwordHash'), false)
  const adminHeaders = { authorization: `Bearer ${adminLogin.token}` }

  const unauthorizedListResponse = await app.inject({ method: 'GET', url: '/api/users' })
  assert.equal(unauthorizedListResponse.statusCode, 401)
  assert.equal(unauthorizedListResponse.json<{ code: string }>().code, 'AUTH_FAILED')

  const createdResponse = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: adminHeaders,
    payload: {
      username: 'team.tester',
      name: 'Team Tester',
      email: 'team.tester@example.local',
      department: 'Qualitätssicherung',
      role: 'User',
      password: 'passwort123',
      active: true
    }
  })
  assert.equal(createdResponse.statusCode, 201)
  const created = createdResponse.json<{ id: string, username: string, email: string, active: boolean }>()
  assert.equal(created.username, 'team.tester')
  assert.equal(created.email, 'team.tester@example.local')
  assert.equal(created.active, true)

  const listResponse = await app.inject({ method: 'GET', url: '/api/users', headers: adminHeaders })
  assert.equal(listResponse.statusCode, 200)
  assert.equal(
    listResponse.json<Array<{ id: string }>>().some((user) => user.id === created.id),
    true
  )

  const deactivatedResponse = await app.inject({
    method: 'PUT',
    url: `/api/users/${created.id}`,
    headers: adminHeaders,
    payload: { active: false }
  })
  assert.equal(deactivatedResponse.statusCode, 200)
  assert.equal(deactivatedResponse.json<{ active: boolean }>().active, false)

  const blockedLoginResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'team.tester', password: 'passwort123' }
  })
  assert.equal(blockedLoginResponse.statusCode, 401)
  assert.equal(blockedLoginResponse.json<{ code: string }>().code, 'AUTH_FAILED')

  const reactivatedResponse = await app.inject({
    method: 'PUT',
    url: `/api/users/${created.id}`,
    headers: adminHeaders,
    payload: { active: true, password: 'neuesPasswort123', department: 'Risk Office' }
  })
  assert.equal(reactivatedResponse.statusCode, 200)
  const reactivated = reactivatedResponse.json<{ active: boolean, department: string }>()
  assert.equal(reactivated.active, true)
  assert.equal(reactivated.department, 'Risk Office')

  const updatedLoginResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'team.tester@example.local', password: 'neuesPasswort123' }
  })
  assert.equal(updatedLoginResponse.statusCode, 200)
  const updatedLogin = updatedLoginResponse.json<{ user: { username: string }, token: string }>()
  assert.equal(updatedLogin.user.username, 'team.tester')
  const userHeaders = { authorization: `Bearer ${updatedLogin.token}` }

  const profileResponse = await app.inject({ method: 'GET', url: '/api/profile', headers: userHeaders })
  assert.equal(profileResponse.statusCode, 200)
  assert.equal(profileResponse.json<{ username: string }>().username, 'team.tester')

  const profileUpdateResponse = await app.inject({
    method: 'PUT',
    url: '/api/profile',
    headers: userHeaders,
    payload: {
      name: 'Team Tester Profil',
      department: 'Quality Office',
      password: 'profilPasswort123'
    }
  })
  assert.equal(profileUpdateResponse.statusCode, 200)
  const profile = profileUpdateResponse.json<{ name: string, department: string, role: string, active: boolean }>()
  assert.equal(profile.name, 'Team Tester Profil')
  assert.equal(profile.department, 'Quality Office')
  assert.equal(profile.role, 'User')
  assert.equal(profile.active, true)

  const blockedRoleChangeResponse = await app.inject({
    method: 'PUT',
    url: '/api/profile',
    headers: userHeaders,
    payload: { role: 'Admin' }
  })
  assert.equal(blockedRoleChangeResponse.statusCode, 400)
  assert.equal(blockedRoleChangeResponse.json<{ code: string }>().code, 'VALIDATION_ERROR')

  const profilePasswordLoginResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'team.tester@example.local', password: 'profilPasswort123' }
  })
  assert.equal(profilePasswordLoginResponse.statusCode, 200)

  const nonAdminSettingsResponse = await app.inject({
    method: 'GET',
    url: '/api/settings',
    headers: userHeaders
  })
  assert.equal(nonAdminSettingsResponse.statusCode, 403)
  assert.equal(nonAdminSettingsResponse.json<{ code: string }>().code, 'FORBIDDEN')
})

test('Admin kann das minimale Einstellungsset verwalten', async () => {
  const headers = await getAdminAuthHeaders()

  const initialResponse = await app.inject({ method: 'GET', url: '/api/settings', headers })
  assert.equal(initialResponse.statusCode, 200)
  const initial = initialResponse.json<{ organizationName: string, defaultReviewCycle: string, highRiskThreshold: number, criticalRiskThreshold: number }>()
  assert.equal(initial.organizationName, 'Risk Register')
  assert.equal(initial.defaultReviewCycle, 'Fix')
  assert.equal(initial.highRiskThreshold, 10)
  assert.equal(initial.criticalRiskThreshold, 16)

  const updatedResponse = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    headers,
    payload: {
      organizationName: 'Bike Risk Office',
      defaultReviewCycle: 'Quartalsweise',
      reviewReminderDays: 21,
      highRiskThreshold: 9,
      criticalRiskThreshold: 17
    }
  })
  assert.equal(updatedResponse.statusCode, 200)
  const updated = updatedResponse.json<{ organizationName: string, defaultReviewCycle: string, reviewReminderDays: number }>()
  assert.equal(updated.organizationName, 'Bike Risk Office')
  assert.equal(updated.defaultReviewCycle, 'Quartalsweise')
  assert.equal(updated.reviewReminderDays, 21)

  const invalidResponse = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    headers,
    payload: { highRiskThreshold: 20, criticalRiskThreshold: 10 }
  })
  assert.equal(invalidResponse.statusCode, 400)
  assert.equal(invalidResponse.json<{ code: string }>().code, 'VALIDATION_ERROR')
})

test('Risiken können vollständig über die API verwaltet werden', async () => {
  const headers = await getAdminAuthHeaders()
  const initial = await app.inject({ method: 'GET', url: '/api/risks', headers })
  assert.equal(initial.statusCode, 200)
  const initialPage = initial.json<Page<unknown>>()
  assert.equal(initialPage.items.length, 5)
  assert.equal(initialPage.total, 5)
  const expectedQuarterlyReviewDate = expectedReviewDate(3)

  const createdResponse = await app.inject({
    method: 'POST',
    url: '/api/risks',
    headers,
    payload: {
      title: 'Abhängigkeit von einem einzelnen Dienstleister',
      description: 'Der Ausfall oder Rückzug des Dienstleisters kann die Lieferfähigkeit kurzfristig beeinträchtigen.',
      category: 'Lieferkette',
      owner: 'Anna Test',
      initialScore: 15,
      dueDate: '2026-09-30',
      reviewDate: '2026-08-31',
      reviewCycle: 'Quartalsweise'
    }
  })
  assert.equal(createdResponse.statusCode, 201)
  const created = createdResponse.json<{ id: string, reference: string, description: string, reviewDate: string, reviewCycle: string, status: string }>()
  assert.equal(created.reference, 'R-025')
  assert.equal(created.description, 'Der Ausfall oder Rückzug des Dienstleisters kann die Lieferfähigkeit kurzfristig beeinträchtigen.')
  assert.equal(created.reviewDate, expectedQuarterlyReviewDate)
  assert.equal(created.reviewCycle, 'Quartalsweise')
  assert.equal(created.status, 'Offen')

  const expectedHalfYearReviewDate = expectedReviewDate(6)
  const updatedResponse = await app.inject({
    method: 'PUT',
    url: `/api/risks/${created.id}`,
    headers,
    payload: { currentScore: 8, status: 'In Bearbeitung', reviewDate: '2026-09-15', reviewCycle: 'Halbjährlich' }
  })
  assert.equal(updatedResponse.statusCode, 200)
  const updated = updatedResponse.json<{ currentScore: number, reviewDate: string, reviewCycle: string }>()
  assert.equal(updated.currentScore, 8)
  assert.equal(updated.reviewDate, expectedHalfYearReviewDate)
  assert.equal(updated.reviewCycle, 'Halbjährlich')

  const foundResponse = await app.inject({ method: 'GET', url: `/api/risks/${created.id}`, headers })
  assert.equal(foundResponse.statusCode, 200)
  assert.equal(foundResponse.json<{ title: string }>().title, 'Abhängigkeit von einem einzelnen Dienstleister')

  const pagedResponse = await app.inject({ method: 'GET', url: '/api/risks?page=1&pageSize=2&sortBy=reference&sortDirection=asc', headers })
  assert.equal(pagedResponse.statusCode, 200)
  const paged = pagedResponse.json<Page<{ reference: string }>>()
  assert.equal(paged.page, 1)
  assert.equal(paged.pageSize, 2)
  assert.equal(paged.items.length, 2)
  assert.ok(paged.total >= 6)
  const [firstPagedRisk, secondPagedRisk] = paged.items
  assert.ok(firstPagedRisk)
  assert.ok(secondPagedRisk)
  assert.ok(firstPagedRisk.reference.localeCompare(secondPagedRisk.reference) <= 0)

  const filteredResponse = await app.inject({
    method: 'GET',
    url: '/api/risks?status=In%20Bearbeitung&owner=Anna%20Test&sortBy=reference&sortDirection=desc',
    headers
  })
  assert.equal(filteredResponse.statusCode, 200)
  const filtered = filteredResponse.json<Page<{ id: string, owner: string, status: string }>>()
  assert.equal(filtered.total, 1)
  const [filteredRisk] = filtered.items
  assert.ok(filteredRisk)
  assert.equal(filteredRisk.id, created.id)
  assert.equal(filteredRisk.owner, 'Anna Test')
  assert.equal(filteredRisk.status, 'In Bearbeitung')

  const searchResponse = await app.inject({ method: 'GET', url: '/api/risks?search=Dienstleister', headers })
  assert.equal(searchResponse.statusCode, 200)
  const searchPage = searchResponse.json<Page<unknown>>()
  assert.equal(searchPage.items.length, 1)
  assert.equal(searchPage.total, 1)

  const deletedResponse = await app.inject({ method: 'DELETE', url: `/api/risks/${created.id}`, headers })
  assert.equal(deletedResponse.statusCode, 204)

  const missingResponse = await app.inject({ method: 'GET', url: `/api/risks/${created.id}`, headers })
  assert.equal(missingResponse.statusCode, 404)
  assert.equal(missingResponse.json<{ code: string }>().code, 'RISK_NOT_FOUND')
})

test('Maßnahmen können über die API angelegt, angesehen, bearbeitet und gelöscht werden', async () => {
  const headers = await getAdminAuthHeaders()
  const riskResponse = await app.inject({ method: 'GET', url: '/api/risks', headers })
  assert.equal(riskResponse.statusCode, 200)
  const [risk] = riskResponse.json<Page<{ id: string, reference: string }>>().items
  assert.ok(risk)

  const createdResponse = await app.inject({
    method: 'POST',
    url: '/api/measures',
    headers,
    payload: {
      riskId: risk.id,
      title: 'Lieferanten-Workshop terminieren',
      description: 'Einkauf und Produktion stimmen Alternativen für kritische Komponenten ab.',
      owner: 'Anna Test',
      dueDate: '2026-08-15',
      priority: 'Hoch',
      status: 'Offen'
    }
  })
  assert.equal(createdResponse.statusCode, 201)
  const created = createdResponse.json<{ id: string, riskId: string, title: string, status: string, priority: string }>()
  assert.equal(created.riskId, risk.id)
  assert.equal(created.title, 'Lieferanten-Workshop terminieren')
  assert.equal(created.status, 'Offen')
  assert.equal(created.priority, 'Hoch')

  const listResponse = await app.inject({ method: 'GET', url: '/api/measures', headers })
  assert.equal(listResponse.statusCode, 200)
  assert.equal(
    listResponse.json<Page<{ id: string }>>().items.some((measure) => measure.id === created.id),
    true
  )

  const foundResponse = await app.inject({ method: 'GET', url: `/api/measures/${created.id}`, headers })
  assert.equal(foundResponse.statusCode, 200)
  assert.equal(foundResponse.json<{ description: string }>().description, 'Einkauf und Produktion stimmen Alternativen für kritische Komponenten ab.')

  const updatedResponse = await app.inject({
    method: 'PUT',
    url: `/api/measures/${created.id}`,
    headers,
    payload: {
      status: 'In Arbeit',
      priority: 'Kritisch',
      description: 'Workshop ist angesetzt, Entscheidungsvorlage wird vorbereitet.'
    }
  })
  assert.equal(updatedResponse.statusCode, 200)
  const updated = updatedResponse.json<{ status: string, priority: string, description: string }>()
  assert.equal(updated.status, 'In Arbeit')
  assert.equal(updated.priority, 'Kritisch')
  assert.equal(updated.description, 'Workshop ist angesetzt, Entscheidungsvorlage wird vorbereitet.')

  const filteredMeasureResponse = await app.inject({
    method: 'GET',
    url: '/api/measures?page=1&pageSize=1&status=In%20Arbeit&priority=Kritisch&owner=Anna%20Test&sortBy=title&sortDirection=asc',
    headers
  })
  assert.equal(filteredMeasureResponse.statusCode, 200)
  const filteredMeasures = filteredMeasureResponse.json<Page<{ id: string, owner: string, priority: string, status: string }>>()
  assert.equal(filteredMeasures.page, 1)
  assert.equal(filteredMeasures.pageSize, 1)
  assert.equal(filteredMeasures.total, 1)
  const [filteredMeasure] = filteredMeasures.items
  assert.ok(filteredMeasure)
  assert.equal(filteredMeasure.id, created.id)
  assert.equal(filteredMeasure.owner, 'Anna Test')
  assert.equal(filteredMeasure.priority, 'Kritisch')
  assert.equal(filteredMeasure.status, 'In Arbeit')

  const deletedResponse = await app.inject({ method: 'DELETE', url: `/api/measures/${created.id}`, headers })
  assert.equal(deletedResponse.statusCode, 204)

  const missingMeasureResponse = await app.inject({ method: 'GET', url: `/api/measures/${created.id}`, headers })
  assert.equal(missingMeasureResponse.statusCode, 404)
  assert.equal(missingMeasureResponse.json<{ code: string }>().code, 'MEASURE_NOT_FOUND')
})

test('DELETE markiert Risiken in SQLite statt sie physisch zu entfernen', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'risk-register-'))
  const databasePath = join(tempDir, 'risk-register.db')
  const fileApp = buildApp({ databasePath, logger: false })
  let appClosed = false

  try {
    const headers = await getAdminAuthHeaders(fileApp)
    const listResponse = await fileApp.inject({ method: 'GET', url: '/api/risks', headers })
    const [target] = listResponse.json<Page<{ id: string, reference: string }>>().items
    assert.ok(target)

    const deletedResponse = await fileApp.inject({ method: 'DELETE', url: `/api/risks/${target.id}`, headers })
    assert.equal(deletedResponse.statusCode, 204)

    const activeListResponse = await fileApp.inject({ method: 'GET', url: '/api/risks', headers })
    assert.equal(
      activeListResponse.json<Page<{ id: string }>>().items.some((risk) => risk.id === target.id),
      false
    )

    await fileApp.close()
    appClosed = true

    const database = new DatabaseSync(databasePath)
    try {
      const row = database.prepare('SELECT deleted_at FROM risks WHERE id = ?').get(target.id) as { deleted_at: string | null } | undefined
      assert.ok(row)
      assert.match(row.deleted_at ?? '', /^\d{4}-\d{2}-\d{2}T/)
    } finally {
      database.close()
    }
  } finally {
    if (!appClosed) await fileApp.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('Anmeldetokens bleiben nach einem Serverneustart gültig', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'risk-register-'))
  const databasePath = join(tempDir, 'risk-register.db')
  const firstApp = buildApp({ databasePath, logger: false })
  let firstAppClosed = false
  let secondApp: ReturnType<typeof buildApp> | null = null

  try {
    const headers = await getAdminAuthHeaders(firstApp)
    await firstApp.close()
    firstAppClosed = true

    secondApp = buildApp({ databasePath, logger: false })
    const response = await secondApp.inject({ method: 'GET', url: '/api/risks', headers })
    assert.equal(response.statusCode, 200)
    assert.ok(response.json<Page<unknown>>().items.length > 0)
  } finally {
    if (!firstAppClosed) await firstApp.close()
    if (secondApp) await secondApp.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('Review-Datum ist nur bei fixem Review-Rhythmus verpflichtend', async () => {
  const headers = await getAdminAuthHeaders()
  const fixedResponse = await app.inject({
    method: 'POST',
    url: '/api/risks',
    headers,
    payload: {
      title: 'Fixer Review ohne Datum',
      description: 'Dieses Risiko darf ohne Review-Datum nicht gespeichert werden.',
      category: 'Compliance',
      owner: 'Anna Test',
      initialScore: 10,
      reviewCycle: 'Fix'
    }
  })
  assert.equal(fixedResponse.statusCode, 400)
  assert.equal(fixedResponse.json<{ code: string }>().code, 'VALIDATION_ERROR')

  const expectedMonthlyReviewDate = expectedReviewDate(1)
  const recurringResponse = await app.inject({
    method: 'POST',
    url: '/api/risks',
    headers,
    payload: {
      title: 'Monatlicher Review ohne Datum',
      description: 'Dieses Risiko nutzt einen wiederkehrenden Review-Rhythmus ohne festes Datum.',
      category: 'Organisation',
      owner: 'Ben Test',
      initialScore: 11,
      reviewCycle: 'Monatlich'
    }
  })
  assert.equal(recurringResponse.statusCode, 201)
  const recurring = recurringResponse.json<{ id: string, reviewDate: string | null, reviewCycle: string }>()
  assert.equal(recurring.reviewDate, expectedMonthlyReviewDate)
  assert.equal(recurring.reviewCycle, 'Monatlich')

  const fixedUpdateResponse = await app.inject({
    method: 'PUT',
    url: `/api/risks/${recurring.id}`,
    headers,
    payload: { reviewCycle: 'Fix' }
  })
  assert.equal(fixedUpdateResponse.statusCode, 400)
  assert.equal(fixedUpdateResponse.json<{ code: string }>().code, 'VALIDATION_ERROR')
})

test('Ungültige Risikowerte werden abgewiesen', async () => {
  const headers = await getAdminAuthHeaders()
  const response = await app.inject({
    method: 'POST',
    url: '/api/risks',
    headers,
    payload: {
      title: 'Ungültiges Risiko',
      description: 'Dieses Risiko dient nur der Validierung ungültiger Risikowerte.',
      category: 'Test',
      owner: 'Test',
      initialScore: 26,
      reviewDate: '2026-08-31'
    }
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.json<{ code: string }>().code, 'VALIDATION_ERROR')
})

async function getAdminAuthHeaders (targetApp: ReturnType<typeof buildApp> = app): Promise<Record<string, string>> {
  const response = await targetApp.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'admin123' }
  })
  assert.equal(response.statusCode, 200)
  const body = response.json<{ token: string }>()
  assert.equal(typeof body.token, 'string')
  return { authorization: `Bearer ${body.token}` }
}

function expectedReviewDate (months: number): string {
  const date = new Date()
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const targetMonthIndex = month + months
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastTargetDay)
  return new Date(Date.UTC(targetYear, targetMonth, targetDay)).toISOString().slice(0, 10)
}

function assertQueryParameter (operation: { parameters?: Array<{ name: string }> } | undefined, name: string): void {
  assert.equal(operation?.parameters?.some((parameter) => parameter.name === name), true)
}
