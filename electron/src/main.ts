import { app, BrowserWindow, session, type WebContents } from 'electron'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rendererEntryPath = path.join(__dirname, 'renderer', 'index.html')
const rendererEntryUrl = pathToFileURL(rendererEntryPath).toString()

/** Akzeptiert nur Navigationen auf die gebündelte Renderer-Datei. */
function isAllowedRendererNavigation (targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl)
    if (parsed.protocol !== 'file:') return false
    return path.resolve(fileURLToPath(parsed)) === path.resolve(rendererEntryPath)
  } catch {
    return false
  }
}

/** Blockiert Popup-Fenster und fremde Top-Level-Navigationen für jeden WebContents. */
function lockDownWebContents (webContents: WebContents): void {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
  webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedRendererNavigation(targetUrl)) event.preventDefault()
  })
}

/** Verweigert unnötige Renderer-Berechtigungen wie Kamera, Mikrofon, Standort oder Notifications. */
function configureSessionPermissions (): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler(() => false)
}

/** Erstellt das abgesicherte Hauptfenster und lädt den gebündelten React-Renderer. */
function createWindow (): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#f4f5fa',
    title: 'Risk Register',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  void win.loadURL(rendererEntryUrl)
}

void app.whenReady().then(() => {
  configureSessionPermissions()
  app.on('web-contents-created', (_event, webContents) => {
    lockDownWebContents(webContents)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
