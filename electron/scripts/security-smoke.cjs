const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const mainSource = fs.readFileSync(path.join(projectRoot, 'src', 'main.ts'), 'utf8')
const rendererHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8')

const checks = [
  ['sandbox is enabled', /sandbox:\s*true/.test(mainSource)],
  ['context isolation is enabled', /contextIsolation:\s*true/.test(mainSource)],
  ['node integration is disabled', /nodeIntegration:\s*false/.test(mainSource)],
  ['popups are denied', /setWindowOpenHandler/.test(mainSource) && /action:\s*'deny'/.test(mainSource)],
  ['external navigation is guarded', /will-navigate/.test(mainSource) && /isAllowedRendererNavigation/.test(mainSource)],
  ['webviews are blocked', /will-attach-webview/.test(mainSource)],
  ['permission requests are denied', /setPermissionRequestHandler/.test(mainSource) && /callback\(false\)/.test(mainSource)],
  ['permission checks are denied', /setPermissionCheckHandler/.test(mainSource) && /=>\s*false/.test(mainSource)],
  ['renderer loads through file URL', /pathToFileURL/.test(mainSource) && /loadURL\(rendererEntryUrl\)/.test(mainSource)],
  ['CSP defaults to self', /default-src 'self'/.test(rendererHtml)],
  ['CSP limits network access to local API', /connect-src http:\/\/127\.0\.0\.1:8000 http:\/\/localhost:8000/.test(rendererHtml)]
]

const failed = checks.filter(([, passed]) => !passed)

if (failed.length > 0) {
  for (const [name] of failed) {
    console.error(`Electron security smoke failed: ${name}`)
  }
  process.exit(1)
}

console.log(`Electron security smoke passed (${checks.length} checks).`)
