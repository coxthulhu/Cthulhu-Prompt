import { app, shell, BrowserWindow, ipcMain, screen, type IpcMainInvokeEvent } from 'electron'
import { basename, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { loadDevtools } from './devtools'
import icon from '../../resources/icon.png?asset'
import { setupWorkspaceDialogHandlers } from './workspaceDialog'
import { setupWorkspaceMutationHandlers } from './Mutations/WorkspaceMutations'
import { setupPromptFolderMutationHandlers } from './Mutations/PromptFolderMutations'
import { setupPromptMutationHandlers } from './Mutations/PromptMutations'
import { setupPromptUiStateMutationHandlers } from './Mutations/PromptUiStateMutations'
import { setupSystemSettingsMutationHandlers } from './Mutations/SystemSettingsMutations'
import { setupUserPersistenceMutationHandlers } from './Mutations/UserPersistenceMutations'
import { setupWorkspaceQueryHandlers } from './Queries/WorkspaceQuery'
import { setupPromptFolderQueryHandlers } from './Queries/PromptFolderQuery'
import { setupSystemSettingsQueryHandlers } from './Queries/SystemSettingsQuery'
import { setupUserPersistenceQueryHandlers } from './Queries/UserPersistenceQuery'
import { SqliteDataAccess } from './DataAccess/SqliteDataAccess'
import {
  UserPersistenceDataAccess,
  type WindowPersistence
} from './DataAccess/UserPersistenceDataAccess'
import {
  RUNTIME_ARG_PREFIX,
  type RuntimeConfig,
  type RuntimeEnvironment
} from '@shared/runtimeConfig'
import { SYSTEM_SETTINGS_ID } from '@shared/SystemSettings'
import { isDevEnvironment, isPlaywrightEnvironment } from './appEnvironment'
import { systemSettingsData } from './Data/SystemSettingsData'

const WINDOW_DEFAULT_WIDTH = 900
const WINDOW_DEFAULT_HEIGHT = 670
const WINDOW_MIN_WIDTH = 800
const WINDOW_MIN_HEIGHT = 600

function getWorkingDirectoryName(): string | null {
  try {
    return basename(process.cwd())
  } catch (error) {
    console.error('Error resolving execution folder name:', error)
    return null
  }
}

function encodeRuntimeConfigArg(config: RuntimeConfig): string {
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

function buildRuntimeConfig(): RuntimeConfig {
  const devEnvironment = isDevEnvironment()
  const playwrightEnvironment = isPlaywrightEnvironment()
  const environment: RuntimeEnvironment = devEnvironment
    ? 'DEV'
    : playwrightEnvironment
      ? 'PLAYWRIGHT'
      : ''
  const executionFolderName = getWorkingDirectoryName()

  return {
    executionFolderName,
    environment
  }
}

const hasPersistedWindowBounds = (
  windowPersistence: WindowPersistence
): windowPersistence is WindowPersistence & {
  x: number
  y: number
  width: number
  height: number
} => {
  return (
    windowPersistence.x !== null &&
    windowPersistence.y !== null &&
    windowPersistence.width !== null &&
    windowPersistence.height !== null
  )
}

const arePersistedWindowBoundsValid = (windowPersistence: {
  x: number
  y: number
  width: number
  height: number
}): boolean => {
  if (windowPersistence.width < WINDOW_MIN_WIDTH || windowPersistence.height < WINDOW_MIN_HEIGHT) {
    return false
  }

  const windowRight = windowPersistence.x + windowPersistence.width
  const windowBottom = windowPersistence.y + windowPersistence.height

  return screen.getAllDisplays().some((display) => {
    const displayRight = display.bounds.x + display.bounds.width
    const displayBottom = display.bounds.y + display.bounds.height

    return (
      windowPersistence.x >= display.bounds.x &&
      windowPersistence.y >= display.bounds.y &&
      windowRight <= displayRight &&
      windowBottom <= displayBottom
    )
  })
}

const resolveWindowStartupState = (): {
  x: number | undefined
  y: number | undefined
  width: number
  height: number
  isMaximized: boolean
  isFullScreen: boolean
} => {
  const persistedWindow = UserPersistenceDataAccess.readWindowPersistence()
  const usePersistedBounds =
    hasPersistedWindowBounds(persistedWindow) && arePersistedWindowBoundsValid(persistedWindow)

  const isFullScreen = persistedWindow.isFullScreen === true
  const isMaximized = !isFullScreen && persistedWindow.isMaximized === true

  if (!usePersistedBounds) {
    return {
      x: undefined,
      y: undefined,
      width: WINDOW_DEFAULT_WIDTH,
      height: WINDOW_DEFAULT_HEIGHT,
      isMaximized,
      isFullScreen
    }
  }

  return {
    x: persistedWindow.x,
    y: persistedWindow.y,
    width: persistedWindow.width,
    height: persistedWindow.height,
    isMaximized,
    isFullScreen
  }
}

const persistWindowState = (window: BrowserWindow): void => {
  const normalBounds = window.getNormalBounds()

  UserPersistenceDataAccess.updateWindowPersistence({
    x: Math.round(normalBounds.x),
    y: Math.round(normalBounds.y),
    width: Math.round(normalBounds.width),
    height: Math.round(normalBounds.height),
    isMaximized: window.isMaximized(),
    isFullScreen: window.isFullScreen()
  })
}

function createWindow(runtimeConfig: RuntimeConfig): void {
  const windowStartupState = resolveWindowStartupState()

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: windowStartupState.width,
    height: windowStartupState.height,
    ...(windowStartupState.x !== undefined && windowStartupState.y !== undefined
      ? { x: windowStartupState.x, y: windowStartupState.y }
      : {}),
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    title: 'Cthulhu Prompt',
    frame: process.platform !== 'win32',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      additionalArguments: [encodeRuntimeConfigArg(runtimeConfig)]
    }
  })

  if (windowStartupState.isFullScreen) {
    mainWindow.setFullScreen(true)
  } else if (windowStartupState.isMaximized) {
    mainWindow.maximize()
  }

  const closeGuard = { allowClose: false }
  windowCloseGuards.set(mainWindow, closeGuard)

  mainWindow.on('close', (event) => {
    if (closeGuard.allowClose) {
      closeGuard.allowClose = false
      // Side effect: capture final window geometry and state after autosaves complete.
      persistWindowState(mainWindow)
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

    // Setup workspace dialog IPC handlers used by the home screen.
    setupWorkspaceDialogHandlers()
    // Side effect: create/open SQLite DB before renderer or IPC work begins.
    SqliteDataAccess.initializeDatabase()
    // Side effect: hydrate in-memory system settings from disk before IPC handlers run.
    await systemSettingsData.loadDataFromPersistence(SYSTEM_SETTINGS_ID, {})
    setupSystemSettingsQueryHandlers()
    setupUserPersistenceQueryHandlers()
    setupSystemSettingsMutationHandlers()
    setupUserPersistenceMutationHandlers()
    setupWorkspaceQueryHandlers()
    setupWorkspaceMutationHandlers()
    setupPromptFolderQueryHandlers()
    setupPromptFolderMutationHandlers()
    setupPromptMutationHandlers()
    setupPromptUiStateMutationHandlers()
    setupWindowControlHandlers()

    const runtimeConfig = buildRuntimeConfig()

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
