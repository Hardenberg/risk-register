import { buildApp } from './app.js'
import { resolve } from 'node:path'

const databasePath = process.env.DATABASE_PATH ?? resolve('data', 'risk-register.db')
const app = buildApp({ databasePath })
const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 8000)

/** Beendet Listener und SQLite-Verbindung bei einem Betriebssystemsignal geordnet. */
async function shutdown (signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, 'Server wird beendet')
  await app.close()
  process.exit(0)
}

process.on('SIGINT', () => { void shutdown('SIGINT') })
process.on('SIGTERM', () => { void shutdown('SIGTERM') })

try {
  await app.listen({ host, port })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
