import { test as baseTest, expect as baseExpect } from '@playwright/test'
import { _electron as electron, type ConsoleMessage, type Page } from 'playwright'
import * as screenHelpers from './ScreenHelpers'
import * as buttonHelpers from './ButtonHelpers'
import * as workspaceHelpers from './WorkspaceHelpers'
import * as promptFolderHelpers from './PromptFolderHelpers'
import * as uiValidationHelpers from './UiValidationHelpers'
import {
  setupWorkspaceScenario,
  type WorkspaceScenario,
  getWorkspacePath
} from '../fixtures/WorkspaceFixtures'

export interface PlaywrightTestOptions {
  launchOptions?: any
}

export interface TestSetupOptions {
  workspace?: {
    scenario: WorkspaceScenario | 'none'
    path?: string
    autoSetup?: boolean
  }
}

export interface PlaywrightTestFixtures {
  electronApp: any
  testSetup: any
}

interface RendererErrorEntry {
  kind: 'console' | 'pageerror'
  level?: string
  message: string
  pageUrl?: string
  location?: {
    url?: string
    lineNumber?: number
    columnNumber?: number
  }
  timestamp: number
}

const defaultOptions: Required<PlaywrightTestOptions> = {
  launchOptions: {}
}

const RENDERER_ERROR_ANNOTATION = 'renderer-errors-json'

export function createPlaywrightTestSuite(options: PlaywrightTestOptions = {}) {
  const config = { ...defaultOptions, ...options }

  const playwrightTest = baseTest.extend<PlaywrightTestFixtures>({
    electronApp: async ({}, use) => {
      let app: any = null

      try {
        const electronLaunchConfig = {
          args: [
            './out/main/index.js',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-gpu',
            '--headless'
          ],
          timeout: 60000,
          env: {
            ...process.env,
            ELECTRON_IS_DEV: '0',
            NODE_ENV: 'test',
            DEV_ENVIRONMENT: 'PLAYWRIGHT'
          },
          ...config.launchOptions
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
      const rendererErrors: RendererErrorEntry[] = []
      let truncatedCount = 0
      const maxErrorsPerTest = 10

      const recordRendererError = (entry: RendererErrorEntry) => {
        if (rendererErrors.length < maxErrorsPerTest) {
          rendererErrors.push(entry)
        } else {
          truncatedCount += 1
        }
      }

      const trackedListeners: Array<() => void> = []
      const trackedPages = new WeakSet<Page>()

      const trackPageForRendererErrors = (page: Page) => {
        if (trackedPages.has(page)) {
          return
        }
        trackedPages.add(page)

        const handleConsole = (message: ConsoleMessage) => {
          if (message.type() !== 'error') {
            return
          }

          const location = message.location()
          recordRendererError({
            kind: 'console',
            level: message.type(),
            message: message.text(),
            pageUrl: page.url(),
            location: {
              url: location?.url,
              lineNumber: location?.lineNumber,
              columnNumber: location?.columnNumber
            },
            timestamp: Date.now()
          })
        }

        const handlePageError = (error: Error) => {
          recordRendererError({
            kind: 'pageerror',
            message: error?.stack || error?.message || String(error),
            pageUrl: page.url(),
            timestamp: Date.now()
          })
        }

        page.on('console', handleConsole)
        page.on('pageerror', handlePageError)

        trackedListeners.push(() => {
          page.off('console', handleConsole)
          page.off('pageerror', handlePageError)
        })
      }

      const handleElectronWindow = (page: Page) => {
        trackPageForRendererErrors(page)
      }

      electronApp.on('window', handleElectronWindow)
      trackedListeners.push(() => {
        electronApp.off('window', handleElectronWindow)
      })

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

      const setupUtils = {
        setupFilesystem: async (filesystem: Record<string, string | null>) => {
          const requestId = `fs-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`

          const result = await electronApp.evaluate(
            async ({ app }, { filesystem, requestId }) => {
              return await new Promise<{ success: boolean; error?: string }>((resolve) => {
                const channel = `test-setup-filesystem-ready:${requestId}`
                const timeout = setTimeout(() => {
                  resolve({ success: false, error: 'Filesystem setup timed out' })
                }, 5000)

                app.once(channel, (payload: { success: boolean; error?: string } | undefined) => {
                  clearTimeout(timeout)
                  resolve(payload ?? { success: true })
                })

                app.emit('test-setup-filesystem', { filesystem, requestId })
              })
            },
            { filesystem, requestId }
          )

          if (!result?.success) {
            throw new Error(`Filesystem setup failed: ${result?.error ?? 'unknown error'}`)
          }
        },

        setupFileDialog: async (results: any[]) => {
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
          await electronApp.evaluate(async ({ app }) => {
            app.emit('test-complete-startup')
          })

          // Wait for startup completion flag
          let completed = false
          let attempts = 0
          while (!completed && attempts < 50) {
            completed = await electronApp.evaluate(async ({ app }) => {
              return (app as any)._testStartupCompleted || false
            })
            if (!completed) {
              await new Promise((resolve) => setTimeout(resolve, 100))
              attempts++
            }
          }

          if (!completed) {
            throw new Error('Startup completion timed out')
          }
        },

        setupAndStart: async (options: TestSetupOptions = {}) => {
          // Handle workspace setup if provided
          if (options.workspace && options.workspace.scenario !== 'none') {
            const workspacePath =
              options.workspace.path ||
              getWorkspacePath(options.workspace.scenario as WorkspaceScenario)

            // Create filesystem structure using existing scenario logic
            const workspaceFilesystem = setupWorkspaceScenario(
              workspacePath,
              options.workspace.scenario as WorkspaceScenario
            )
            await setupUtils.setupFilesystem(workspaceFilesystem)

            // Set up file dialog for workspace path
            await setupUtils.setupFileDialog([workspacePath])
          }

          await setupUtils.completeStartup()

          // Get the main window
          const mainWindow = await electronApp.firstWindow()
          trackPageForRendererErrors(mainWindow)
          await mainWindow.waitForLoadState('domcontentloaded')
          await mainWindow.waitForTimeout(3000) // Give extra time for React to render

          // Create bound test helpers
          const testHelpers = {
            getActiveScreen: () => screenHelpers.getActiveScreen(mainWindow),
            isButtonVisible: (buttonText: string) =>
              buttonHelpers.isButtonVisible(mainWindow, buttonText),
            isNavButtonActive: (buttonText: string) =>
              buttonHelpers.isNavButtonActive(mainWindow, buttonText),
            assertHomeActive: async () => {
              baseExpect(await screenHelpers.getActiveScreen(mainWindow)).toBe('home')
              baseExpect(await buttonHelpers.isNavButtonActive(mainWindow, 'Home')).toBe(true)
            },
            clickNavButton: (buttonText: string, timeout?: number) =>
              buttonHelpers.clickNavButton(mainWindow, buttonText, timeout),
            validatePageStructure: () => uiValidationHelpers.validatePageStructure(mainWindow),
            setupWorkspaceViaUI: (timeout?: number) =>
              workspaceHelpers.setupWorkspaceViaUI(mainWindow, timeout),
            clearWorkspaceViaUI: () => workspaceHelpers.clearWorkspaceViaUI(mainWindow),
            isWorkspaceReady: () => workspaceHelpers.isWorkspaceReady(mainWindow),
            isWorkspaceGetStarted: () => workspaceHelpers.isWorkspaceGetStarted(mainWindow),
            getDisplayedWorkspacePath: () => workspaceHelpers.getDisplayedWorkspacePath(mainWindow),
            assertWorkspaceReadyPath: async (path: string) => {
              baseExpect(await workspaceHelpers.getDisplayedWorkspacePath(mainWindow)).toBe(path)
              baseExpect(await workspaceHelpers.isWorkspaceReady(mainWindow)).toBe(true)
            },
            clickCollapsibleTrigger: (triggerText: string, timeout?: number) =>
              promptFolderHelpers.clickCollapsibleTrigger(mainWindow, triggerText, timeout),
            clickPromptFolderItem: (folderName: string, timeout?: number) =>
              promptFolderHelpers.clickPromptFolderItem(mainWindow, folderName, timeout),
            clickPromptFoldersUpdatedItem: (folderName: string, timeout?: number) =>
              promptFolderHelpers.clickPromptFoldersUpdatedItem(mainWindow, folderName, timeout),
            getPromptRowHeight: (selector: string) =>
              promptFolderHelpers.getPromptRowHeight(mainWindow, selector),
            getPromptRowWidth: (selector: string) =>
              promptFolderHelpers.getPromptRowWidth(mainWindow, selector),
            getElementScrollTop: (selector: string) =>
              promptFolderHelpers.getElementScrollTop(mainWindow, selector),
            openPromptFolderAndWaitForHydrationReady: (options: {
              folderName: string
              hostSelector: string
              promptSelector: string
              placeholderSelector: string
            }) => promptFolderHelpers.openPromptFolderAndWaitForHydrationReady(mainWindow, options),
            dragSidebarHandleBy: (distance: number) =>
              promptFolderHelpers.dragSidebarHandleBy(mainWindow, distance),
            verifyPromptVisible: (promptTitle: string) =>
              promptFolderHelpers.verifyPromptVisible(mainWindow, promptTitle),
            getPromptFolderScreenInfo: () =>
              promptFolderHelpers.getPromptFolderScreenInfo(mainWindow),
            // Screen navigation utilities
            navigateToHomeScreen: () => screenHelpers.navigateToHomeScreen(mainWindow),
            navigateToSettingsScreen: () => screenHelpers.navigateToSettingsScreen(mainWindow),
            navigateToRegularFolder: (folderName: string) =>
              promptFolderHelpers.navigateToRegularFolder(mainWindow, folderName),
            navigateToPromptFolders: (folderName: string) =>
              promptFolderHelpers.navigateToRegularFolder(mainWindow, folderName),
            navigateToPromptFoldersUpdated: (folderName: string) =>
              promptFolderHelpers.navigateToPromptFoldersUpdated(mainWindow, folderName),
            pauseIpcChannel: async (channel: string) => {
              await emitIpcGateEvent('test-ipc-gate', channel)
            },
            resumeIpcChannel: async (channel: string) => {
              await emitIpcGateEvent('test-ipc-release', channel)
            }
          }

          // Automatically set up workspace if requested
          let workspaceSetupResult = undefined
          if (
            options.workspace &&
            options.workspace.scenario !== 'none' &&
            options.workspace.autoSetup !== false
          ) {
            workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
          }

          // Return window, helpers, and workspace setup result
          return { mainWindow, testHelpers, workspaceSetupResult }
        }
      }

      try {
        await use(setupUtils)
      } finally {
        trackedListeners.forEach((dispose) => {
          try {
            dispose()
          } catch {
            // Ignore errors from cleanup
          }
        })

        if (rendererErrors.length > 0 || truncatedCount > 0) {
          const payload = {
            entries: rendererErrors,
            truncatedCount
          }

          testInfo.annotations.push({
            type: RENDERER_ERROR_ANNOTATION,
            description: JSON.stringify(payload)
          })
        }
      }
    }
  })

  return {
    test: playwrightTest,
    describe: playwrightTest.describe,
    expect: baseTest.expect
  }
}
