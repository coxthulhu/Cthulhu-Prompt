import { startupNormally } from './NormalStartup'
import { setupTestStartupListener } from './TestStartup'
import { isPlaywrightEnvironment } from './appEnvironment'

const shouldUsePlaywrightSetup = isPlaywrightEnvironment()

// Check if we should hang during startup for testing
if (shouldUsePlaywrightSetup) {
  // Set up the test startup listener and hang here for playwright test setup
  // Tests will use electronApp.evaluate to emit 'test-startup-requested' event
  setupTestStartupListener()
} else {
  // Normal startup path
  startupNormally()
}
