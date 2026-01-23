import { app, shell, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { basename, join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { loadDevtools } from './devtools'
import icon from '../../resources/icon.png?asset'
import { WorkspaceManager } from './workspace'
import { PromptAPI } from './prompt-api'
import { SystemSettingsManager } from './system-settings'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/systemSettings'
import {
  RUNTIME_ARG_PREFIX,
  type RuntimeConfig,
  type RuntimeEnvironment
} from '@shared/runtimeConfig'
import { isDevEnvironment, isPlaywrightEnvironment } from './appEnvironment'

function resolveDevWorkspacePath(): string | null {
  try {
    const currentDir = process.cwd()
    const devWorkspacePath = resolve(currentDir, '..', 'CthulhuPromptTest')

    return WorkspaceManager.checkFolderExists(devWorkspacePath) ? devWorkspacePath : null
  } catch (error) {
    console.error('Error resolving dev workspace path:', error)
    return null
  }
}

function resolveExecutionFolderName(): string | null {
  try {
    return basename(process.cwd())
  } catch (error) {
    console.error('Error resolving execution folder name:', error)
    return null
  }
}

function encodeRuntimeConfig(config: RuntimeConfig): string {
  const payload = JSON.stringify(config)
  return `${RUNTIME_ARG_PREFIX}${Buffer.from(payload, 'utf8').toString('base64')}`
}

let windowControlsInitialized = false
const windowCloseGuards = new WeakMap<BrowserWindow, { allowClose: boolean }>()

function setupWindowControlHandlers(): void {
  if (windowControlsInitialized) {
    return
  }

  windowControlsInitialized = true

  const withWindow = (event: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)

  ipcMain.handle('window-minimize', (event) => {
    withWindow(event)?.minimize()
  })

  ipcMain.handle('window-toggle-maximize', (event) => {
    const window = withWindow(event)
    if (!window) return
    if (window.isMaximized()) {
      window.unmaximize()
      return
    }
    window.maximize()
  })

  ipcMain.handle('window-close', (event) => {
    withWindow(event)?.close()
  })

  ipcMain.handle('window-confirm-close', (event) => {
    const window = withWindow(event)
    if (!window) return
    const guard = windowCloseGuards.get(window)
    if (guard) {
      guard.allowClose = true
    }
    window.close()
  })

  ipcMain.handle('window-is-maximized', (event) => {
    return Boolean(withWindow(event)?.isMaximized())
  })
}

async function buildRuntimeConfig(): Promise<RuntimeConfig> {
  const devEnvironment = isDevEnvironment()
  const playwrightEnvironment = isPlaywrightEnvironment()
  const environment: RuntimeEnvironment = devEnvironment
    ? 'DEV'
    : playwrightEnvironment
      ? 'PLAYWRIGHT'
      : ''
  const devWorkspacePath = devEnvironment ? resolveDevWorkspacePath() : null
  const executionFolderName = resolveExecutionFolderName()
  const systemSettingsResult = await SystemSettingsManager.loadSystemSettings()
  const systemSettings = systemSettingsResult.settings ?? DEFAULT_SYSTEM_SETTINGS

  return {
    devWorkspacePath,
    executionFolderName,
    environment,
    systemSettings
  }
}

function createWindow(runtimeConfig: RuntimeConfig): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Cthulhu Prompt',
    frame: process.platform !== 'win32',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      additionalArguments: [encodeRuntimeConfig(runtimeConfig)]
    }
  })

  const closeGuard = { allowClose: false }
  windowCloseGuards.set(mainWindow, closeGuard)

  mainWindow.on('close', (event) => {
    if (closeGuard.allowClose) {
      closeGuard.allowClose = false
      return
    }

    event.preventDefault()
    mainWindow.webContents.send('window-close-requested')
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  const emitMaximizeState = () => {
    mainWindow.webContents.send('window-maximize-changed', mainWindow.isMaximized())
  }

  mainWindow.on('maximize', emitMaximizeState)
  mainWindow.on('unmaximize', emitMaximizeState)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function startupNormally(): void {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Install DevTools and ensure they are active without reload (dev only)
    if (is.dev) {
      await loadDevtools()
    }

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Setup workspace IPC handlers
    WorkspaceManager.setupIpcHandlers()

    // Setup prompt API handlers
    PromptAPI.setupIpcHandlers()

    // Setup system settings IPC handlers
    SystemSettingsManager.setupIpcHandlers()
    setupWindowControlHandlers()

    const runtimeConfig = await buildRuntimeConfig()

    createWindow(runtimeConfig)

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow(runtimeConfig)
    })
  })

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
