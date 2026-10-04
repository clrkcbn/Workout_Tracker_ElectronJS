import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from './api'

// The renderer only gets these few desktop capabilities — nothing else from Node or Electron.
const api: DesktopApi = {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  saveBackup: (content, suggestedName) => ipcRenderer.invoke('backup:save', content, suggestedName),
  openBackup: () => ipcRenderer.invoke('backup:open')
}

contextBridge.exposeInMainWorld('desktop', api)
