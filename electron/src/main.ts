import { app, BrowserWindow } from 'electron'
import * as path from 'node:path'

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
      nodeIntegration: false
    }
  })

  void win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

void app.whenReady().then(() => {
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
