import { app } from 'electron'
import { join } from 'path'
import { startupNormally } from './NormalStartup'
import { setupTestStartupListener } from './IntegrationTests/TestStartup'
import { isDevEnvironment, isPlaywrightEnvironment } from './appEnvironment'

const DEV_USER_DATA_DIRECTORY_NAME = 'cthulhupromptdev'
const PLAYWRIGHT_USER_DATA_DIRECTORY_NAME = 'cthulhupromptplaywright'

const configureUserDataPath = (): void => {
  if (isPlaywrightEnvironment()) {
    app.setPath('userData', join(app.getPath('appData'), PLAYWRIGHT_USER_DATA_DIRECTORY_NAME))
    return
  }

  if (isDevEnvironment()) {
    app.setPath('userData', join(app.getPath('appData'), DEV_USER_DATA_DIRECTORY_NAME))
  }
}

configureUserDataPath()

const shouldUsePlaywrightSetup = isPlaywrightEnvironment()

// Check if we should hang during startup for testing
if (shouldUsePlaywrightSetup) {
  // Set up the test startup listener and hang here for playwright test setup.
  setupTestStartupListener()
} else {
  // Normal startup path
  startupNormally()
}
