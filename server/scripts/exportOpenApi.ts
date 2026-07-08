import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { buildApp } from '../src/app.js'

const app = buildApp({ logger: false })

try {
  await app.ready()
  const yaml = app.swagger({ yaml: true })
  const outputPath = resolve('openapi.yaml')
  await writeFile(outputPath, yaml, 'utf8')
  console.log(`OpenAPI-Dokument geschrieben: ${outputPath}`)
} finally {
  await app.close()
}
