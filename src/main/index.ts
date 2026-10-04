import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, isAbsolute, join, normalize, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * The renderer is served from a custom `app://bundle/` origin in production.
 * A stable origin keeps IndexedDB (the workout database) attached to the same
 * storage bucket no matter where the app is installed or which version runs.
 */
const APP_SCHEME = 'app'
const APP_HOST = 'bundle'
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`
const MAX_BACKUP_BYTES = 50 * 1024 * 1024

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

// Keep development data away from the real journal. The e2e script can point
// an unpackaged build at a throwaway folder; packaged builds ignore this.
if (!app.isPackaged) {
  const override = process.env.PGJ_USER_DATA_DIR
  app.setPath('userData', override ? override : `${app.getPath('userData')} (Dev)`)
}

const devServerUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
let mainWindow: BrowserWindow | null = null

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  if (url.startsWith(`${APP_ORIGIN}/`)) return true
  return Boolean(devServerUrl && url.startsWith(devServerUrl))
}

function registerAppProtocol(): void {
  const rendererRoot = join(__dirname, '../renderer')
  protocol.handle(APP_SCHEME, (request) => {
    const { host, pathname } = new URL(request.url)
    if (host !== APP_HOST) return new Response('Not found', { status: 404 })
    const target = normalize(join(rendererRoot, decodeURIComponent(pathname)))
    const rel = relative(rendererRoot, target)
    if (rel.startsWith('..') || isAbsolute(rel)) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(target).toString())
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    show: false,
    title: 'Pixel Gym Journal',
    backgroundColor: '#FBF3E4',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // No popups; open real web links in the system browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith(`${APP_ORIGIN}/`) || (devServerUrl && url.startsWith(devServerUrl))
    if (!allowed) event.preventDefault()
  })

  if (!app.isPackaged) {
    // The menu bar is hidden, so give development builds an F12 shortcut for DevTools.
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') mainWindow?.webContents.toggleDevTools()
    })
  }

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadURL(`${APP_ORIGIN}/index.html`)
  }
}

function registerIpc(): void {
  ipcMain.handle('app:info', (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted sender')
    return {
      version: app.getVersion(),
      dataPath: app.getPath('userData'),
      isPackaged: app.isPackaged
    }
  })

  ipcMain.handle('backup:save', async (event, content: unknown, suggestedName: unknown) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted sender')
    if (typeof content !== 'string' || content.length > MAX_BACKUP_BYTES) {
      return { ok: false, error: 'The backup content is not valid.' }
    }
    const safeName =
      typeof suggestedName === 'string' && /^[\w .-]{1,80}\.json$/.test(suggestedName)
        ? suggestedName
        : 'pixel-gym-journal-backup.json'
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options = {
      title: 'Save backup',
      defaultPath: join(app.getPath('documents'), safeName),
      filters: [{ name: 'Gym journal backup', extensions: ['json'] }]
    }
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    try {
      await fs.writeFile(result.filePath, content, 'utf8')
      return { ok: true, path: result.filePath }
    } catch (error) {
      return { ok: false, error: `Could not write the file: ${(error as Error).message}` }
    }
  })

  ipcMain.handle('backup:open', async (event) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted sender')
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options = {
      title: 'Choose a backup to restore',
      properties: ['openFile' as const],
      filters: [{ name: 'Gym journal backup', extensions: ['json'] }]
    }
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options)
    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return { ok: false, canceled: true }
    try {
      const stat = await fs.stat(filePath)
      if (stat.size > MAX_BACKUP_BYTES) return { ok: false, error: 'That file is too large to be a backup.' }
      const content = await fs.readFile(filePath, 'utf8')
      return { ok: true, content, name: basename(filePath) }
    } catch (error) {
      return { ok: false, error: `Could not read the file: ${(error as Error).message}` }
    }
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.clarkcabillon.pixelgymjournal')
    Menu.setApplicationMenu(null)
    registerAppProtocol()
    registerIpc()
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
