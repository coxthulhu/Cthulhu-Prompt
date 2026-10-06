import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { startupNormally } from './NormalStartup'
import { setupTestStartupListener } from './IntegrationTests/TestStartup'
import { isDevEnvironment, isPlaywrightEnvironment } from './appEnvironment'
import { initializePersistentLogging } from './logging'

const PRODUCTION_USER_DATA_DIRECTORY_NAME = 'CthulhuPrompt'
const DEV_USER_DATA_DIRECTORY_NAME = 'CthulhuPromptDev'

const configureUserDataPath = (): void => {
  const appDataPath = app.getPath('appData')

  if (isPlaywrightEnvironment()) {
    /** The test runner owns the run directory; each Electron process owns one profile. */
    const runId = app.commandLine.getSwitchValue('playwright-run-id')
    if (!runId) throw new Error('Playwright requires --playwright-run-id from RunPlaywrightCompact.py')
    /** Chromium writes to the real filesystem even while application persistence uses memfs. */
    const profilePath = join(tmpdir(), 'CthulhuPromptPlaywright', runId, String(process.pid))
    mkdirSync(profilePath, { recursive: true })
    app.setPath('userData', profilePath)
    app.setPath('sessionData', profilePath)
    return
  }

  if (isDevEnvironment()) {
    app.setPath('userData', join(appDataPath, DEV_USER_DATA_DIRECTORY_NAME))
    return
  }

  app.setPath('userData', join(appDataPath, PRODUCTION_USER_DATA_DIRECTORY_NAME))
}

configureUserDataPath()

const shouldUsePlaywrightSetup = isPlaywrightEnvironment()

// Check if we should hang during startup for testing
if (shouldUsePlaywrightSetup) {
  // Set up the test startup listener and hang here for playwright test setup.
  setupTestStartupListener()
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Side effect: begin persistent diagnostics only in the primary application instance.
  initializePersistentLogging()

  app.on('second-instance', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (!mainWindow) return

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.show()
    mainWindow.focus()
  })

  // Normal startup path
  startupNormally()
}
