import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('appInfo', {
  getVersion: () => process.versions.electron
})
