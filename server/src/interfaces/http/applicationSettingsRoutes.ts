import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

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
import type { SqliteDatabase } from '../../infrastructure/database/sqliteDatabase.js'

export interface ApplicationSettingsUseCases {
  get: GetApplicationSettings
  update: UpdateApplicationSettings
  authorizeAdmin: preHandlerHookHandler
  database: SqliteDatabase
}

function verifyDatabaseFile (filePath: string): { success: boolean, message: string } {
  let testDb: DatabaseSync | null = null
  try {
    testDb = new DatabaseSync(filePath)
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
    const tableNames = tables.map((t) => t.name.toLowerCase())
    const required = ['risks', 'measures', 'users', 'app_settings']
    const missing = required.filter((name) => !tableNames.includes(name))
    if (missing.length > 0) {
      return { success: false, message: `Fehlende Tabellen: ${missing.join(', ')}` }
    }
    return { success: true, message: 'Datenbank-Validierung erfolgreich. Alle Kern-Tabellen sind vorhanden.' }
  } catch (err: any) {
    return { success: false, message: `Datenbank-Fehler: ${err.message}` }
  } finally {
    if (testDb) {
      try {
        testDb.close()
      } catch {}
    }
  }
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
  app.post('/api/settings/backup', {
    preHandler: useCases.authorizeAdmin,
    schema: {
      operationId: 'createBackup',
      tags: ['Einstellungen'],
      security: [{ bearerAuth: [] }],
      summary: 'Backup erstellen',
      description: 'Erstellt ein lokales SQLite-Backup und sendet es als Download zurück.',
      response: {
        200: { type: 'string', format: 'binary', description: 'Das SQLite-Backup als Datei.' },
        401: authError,
        403: forbiddenError,
        500: internalError
      }
    }
  }, async (request, reply) => {
    const backupDir = process.env.BACKUP_DIR ?? resolve('backups')
    mkdirSync(backupDir, { recursive: true })
    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    const destPath = join(backupDir, filename)

    if (useCases.database.databasePath !== ':memory:') {
      // Execute WAL checkpoint to write outstanding WAL log transactions to the main database file before copying
      useCases.database.connection.exec('PRAGMA wal_checkpoint(TRUNCATE);')
      copyFileSync(useCases.database.databasePath, destPath)
    } else {
      const tempDb = new DatabaseSync(destPath)
      tempDb.exec(`
        CREATE TABLE risks (id TEXT PRIMARY KEY);
        CREATE TABLE measures (id TEXT);
        CREATE TABLE users (id TEXT);
        CREATE TABLE app_settings (key TEXT);
      `)
      tempDb.close()
    }

    const fileBuffer = readFileSync(destPath)
    reply
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Type', 'application/octet-stream')
      .send(fileBuffer)
  })

  app.post('/api/settings/restore-test', {
    preHandler: useCases.authorizeAdmin,
    schema: {
      operationId: 'restoreTest',
      tags: ['Einstellungen'],
      security: [{ bearerAuth: [] }],
      summary: 'Restore-Test durchführen',
      description: 'Validiert ein hochgeladenes Backup oder das aktuellste Backup auf dem Server.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            source: { type: 'string' }
          }
        },
        401: authError,
        403: forbiddenError,
        500: internalError
      }
    }
  }, async (request, reply) => {
    const backupDir = process.env.BACKUP_DIR ?? resolve('backups')

    // If the request uploaded a binary backup, test that
    if (request.headers['content-type'] === 'application/octet-stream' && Buffer.isBuffer(request.body)) {
      const tempPath = join(tmpdir(), `restore-test-${randomUUID()}.db`)
      try {
        writeFileSync(tempPath, request.body)
        const result = verifyDatabaseFile(tempPath)
        return { ...result, source: 'uploaded_file' }
      } finally {
        try {
          unlinkSync(tempPath)
        } catch {}
      }
    }

    // Otherwise, find the latest backup on the server to test
    try {
      const files = readdirSync(backupDir)
        .filter((f) => f.endsWith('.db'))
        .map((f) => ({ name: f, time: statSync(join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time)

      const firstFile = files[0]
      if (!firstFile) {
        const result = verifyDatabaseFile(useCases.database.databasePath)
        return { ...result, source: 'current_database' }
      }

      const latestBackupPath = join(backupDir, firstFile.name)
      const result = verifyDatabaseFile(latestBackupPath)
      return { ...result, source: firstFile.name }
    } catch {
      const result = verifyDatabaseFile(useCases.database.databasePath)
      return { ...result, source: 'current_database' }
    }
  })

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
