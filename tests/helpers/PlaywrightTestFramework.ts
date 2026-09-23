import type { EventEmitter } from 'node:events'
import { test as baseTest } from '@playwright/test'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import { createPageHelpers, type PageHelpers } from './PageHelpers'
import { createRendererErrorTracker } from './RendererErrors'
import { createTestRequestId } from './TestRequestId'
import { runSqlStatement } from './UserPersistenceHelpers'
import {
  setupWorkspaceScenario,
  type WorkspaceScenario,
  getWorkspacePath,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'

/** Per-suite overrides for the shared Electron launch configuration. */
export interface PlaywrightTestOptions {
  launchOptions?: NonNullable<Parameters<typeof electron.launch>[0]>
}

/** Startup and optional workspace preparation requested by one test. */
export interface TestSetupOptions {
  /** Preserves the SQLite Welcome default when testing the first-launch experience. */
  firstLaunch?: boolean
  workspace?: {
    scenario: WorkspaceScenario | 'none'
    path?: string
    autoSetup?: boolean
    fileModifiedTimes?: Record<string, string>
  }
}

/** Electron application and controlled-startup fixtures exposed to specs. */
export interface PlaywrightTestFixtures {
  electronApp: ElectronApplication
  testSetup: TestSetup
}

/** Main window and helpers returned after the existing startup sequence. */
export interface StartedTest {
  mainWindow: Page
  testHelpers: PageHelpers
  workspaceSetupResult: Awaited<ReturnType<PageHelpers['setupWorkspaceViaUI']>> | undefined
}

/** Typed controls available before and after Electron startup. */
export interface TestSetup {
  getRendererErrors: ReturnType<typeof createRendererErrorTracker>['getRendererErrors']
  removeRendererErrorsContaining: (messagePart: string) => void
  setupFilesystem: (filesystem: Record<string, string | null>, options?: FilesystemSetupOptions) => Promise<void>
  setupFileDialog: (results: string[]) => Promise<void>
  pauseIpcChannel: (channel: string) => Promise<void>
  resumeIpcChannel: (channel: string) => Promise<void>
  completeStartup: () => Promise<void>
  setupAndStart: (options?: TestSetupOptions) => Promise<StartedTest>
}

const defaultOptions: Required<PlaywrightTestOptions> = {
  launchOptions: {}
}

// Shared Electron arguments keep every Playwright suite on the same supported virtual display.
const DEFAULT_ELECTRON_LAUNCH_ARGS = [
  './out/main/index.js',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-gpu',
  '--headless',
  '--screen-info={1920x1080}'
]

/** Optional filesystem timestamps supplied to the existing test setup event. */
type FilesystemSetupOptions = {
  fileModifiedTimes?: Record<string, string>
}

/** Creates isolated Electron fixtures with the shared startup and teardown sequence. */
export function createPlaywrightTestSuite(options: PlaywrightTestOptions = {}) {
  const config = { ...defaultOptions, ...options }

  const playwrightTest = baseTest.extend<PlaywrightTestFixtures>({
    electronApp: async ({}, use) => {
      let app: ElectronApplication | null = null

      try {
        const electronLaunchConfig = {
          timeout: 60000,
          env: {
            ...process.env,
            ELECTRON_IS_DEV: '0',
            NODE_ENV: 'test',
            DEV_ENVIRONMENT: 'PLAYWRIGHT'
          },
          ...config.launchOptions,
          args: [...DEFAULT_ELECTRON_LAUNCH_ARGS, ...(config.launchOptions.args ?? [])]
        }

        app = await electron.launch(electronLaunchConfig)

        // At this point, the app is launched but hung - no UI appears yet
        // Tests can now call electronApp.evaluate to invoke TestStartup functions

        await use(app)
      } finally {
        if (app) {
          await app.close()
        }
      }
    },

    testSetup: async ({ electronApp }, use, testInfo) => {
      /** Captures renderer failures for this fixture's lifetime. */
      const errorTracker = createRendererErrorTracker(electronApp, testInfo)

      const emitIpcGateEvent = async (
        eventName: 'test-ipc-gate' | 'test-ipc-release',
        channel: string
      ) => {
        await electronApp.evaluate(
          async ({ app }, { eventName: ipcEvent, channel: ipcChannel }) => {
            app.emit(ipcEvent, ipcChannel)
          },
          { eventName, channel }
        )
      }

      const setupUtils: TestSetup = {
        getRendererErrors: errorTracker.getRendererErrors,
        removeRendererErrorsContaining: errorTracker.removeRendererErrorsContaining,
        setupFilesystem: async (
          filesystem: Record<string, string | null>,
          options: FilesystemSetupOptions = {}
        ) => {
          const requestId = createTestRequestId('fs')

          const result = await electronApp.evaluate(
            async ({ app }, { filesystem, fileModifiedTimes, requestId }) => {
              return await new Promise<{ success: boolean; error?: string }>((resolve) => {
                const channel = `test-setup-filesystem-ready:${requestId}`
                const timeout = setTimeout(() => {
                  resolve({ success: false, error: 'Filesystem setup timed out' })
                }, 5000)

                ;(app as EventEmitter).once(channel, (payload: { success: boolean; error?: string } | undefined) => {
                  clearTimeout(timeout)
                  resolve(payload ?? { success: true })
                })

                app.emit('test-setup-filesystem', { filesystem, fileModifiedTimes, requestId })
              })
            },
            { filesystem, fileModifiedTimes: options.fileModifiedTimes, requestId }
          )

          if (!result?.success) {
            throw new Error(`Filesystem setup failed: ${result?.error ?? 'unknown error'}`)
          }
        },

        setupFileDialog: async (results: string[]) => {
          await electronApp.evaluate(async ({ app }, results) => {
            app.emit('test-setup-file-dialog', results)
          }, results)
        },

        pauseIpcChannel: async (channel: string) => {
          await emitIpcGateEvent('test-ipc-gate', channel)
        },

        resumeIpcChannel: async (channel: string) => {
          await emitIpcGateEvent('test-ipc-release', channel)
        },

        completeStartup: async () => {
          const requestId = createTestRequestId('startup')

          const result = await electronApp.evaluate(
            async ({ app }, { requestId }) => {
              return await new Promise<{ success: boolean; error?: string }>((resolve) => {
                const channel = `test-complete-startup-ready:${requestId}`
                const timeout = setTimeout(() => {
                  resolve({ success: false, error: 'Startup completion timed out' })
                }, 10000)

                ;(app as EventEmitter).once(channel, (payload: { success: boolean; error?: string } | undefined) => {
                  clearTimeout(timeout)
                  resolve(payload ?? { success: true })
                })

                app.emit('test-complete-startup', { requestId })
              })
            },
            { requestId }
          )

          if (!result?.success) {
            throw new Error(`Startup completion failed: ${result?.error ?? 'unknown error'}`)
          }
        },

        setupAndStart: async (options: TestSetupOptions = {}): Promise<StartedTest> => {
          // Side effect: ordinary tests start as returning users; Welcome tests retain real defaults.
          if (!options.firstLaunch) {
            await runSqlStatement(
              electronApp,
              'UPDATE app_persistence SET has_shown_welcome = 1 WHERE id = 1'
            )
          }
          // Handle workspace setup if provided
          if (options.workspace && options.workspace.scenario !== 'none') {
            const workspacePath =
              options.workspace.path ||
              getWorkspacePath(options.workspace.scenario)

            // Create filesystem structure using existing scenario logic
            const workspaceFilesystem = setupWorkspaceScenario(
              workspacePath,
              options.workspace.scenario
            )
            await setupUtils.setupFilesystem(workspaceFilesystem, {
              fileModifiedTimes: options.workspace.fileModifiedTimes
            })

            const fileDialogPath =
              options.workspace.scenario === 'empty'
                ? workspacePath
                : getWorkspaceInfoPath(workspacePath)
            await setupUtils.setupFileDialog([fileDialogPath])
          }

          await setupUtils.completeStartup()

          // Get the main window
          const mainWindow = await electronApp.firstWindow()
          errorTracker.trackPageForRendererErrors(mainWindow)
          await mainWindow.waitForLoadState('domcontentloaded')
          await mainWindow.waitForSelector('[data-testid="app-sidebar"]', { state: 'visible' })
          await mainWindow.waitForSelector('[data-testid="startup-loading-overlay"]', {
            state: 'detached'
          })
          await mainWindow.waitForSelector('[data-testid="nav-button-home"]', { state: 'visible' })

          // Create bound test helpers
          const testHelpers = createPageHelpers(mainWindow, setupUtils)

          // Automatically set up workspace if requested
          let workspaceSetupResult: StartedTest['workspaceSetupResult'] = undefined
          if (
            options.workspace &&
            options.workspace.scenario !== 'none' &&
            options.workspace.autoSetup !== false
          ) {
            workspaceSetupResult =
              options.workspace.scenario === 'empty'
                ? await testHelpers.createWorkspaceViaUI()
                : await testHelpers.setupWorkspaceViaUI()
          }

          // Return window, helpers, and workspace setup result
          return { mainWindow, testHelpers, workspaceSetupResult }
        }
      }

      try {
        await use(setupUtils)
      } finally {
        errorTracker.dispose()
      }
    }
  })

  return {
    test: playwrightTest,
    describe: playwrightTest.describe,
    expect: baseTest.expect
  }
}
