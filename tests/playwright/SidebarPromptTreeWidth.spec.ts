import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { seedUserPersistence, seedWindowPersistence } from '../helpers/UserPersistenceHelpers'

const { test, expect } = createPlaywrightTestSuite()

const APP_SIDEBAR_HANDLE_TEST_ID = 'app-sidebar-resize-handle'

const getSidebarWidthByHandle = async (mainWindow: any, handleTestId: string): Promise<number> => {
  const width = await mainWindow.evaluate((selector) => {
    const handle = document.querySelector<HTMLElement>(selector)
    if (!handle) return null
    const widthHost = handle.parentElement?.parentElement?.parentElement as HTMLElement | null
    if (!widthHost) return null
    return Math.round(widthHost.getBoundingClientRect().width)
  }, `[data-testid="${handleTestId}"]`)

  if (width == null) {
    throw new Error(`Failed to measure sidebar width for ${handleTestId}`)
  }

  return width
}

test.describe('Sidebar Prompt Tree Width', () => {
  test('keeps the app sidebar width stable while switching prompt collections in a small window', async ({
    electronApp,
    testSetup
  }) => {
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: null,
      appSidebarWidthPx: 260
    })
    await seedWindowPersistence(electronApp, {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      isMaximized: false,
      isFullScreen: false
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptCollections('Development')
    await expect(mainWindow.locator('[data-testid="prompt-tree-active-prompt-dev-2"]')).toBeVisible()
    const developmentWidth = await getSidebarWidthByHandle(mainWindow, APP_SIDEBAR_HANDLE_TEST_ID)

    await testHelpers.navigateToPromptCollections('Examples')
    await expect(mainWindow.locator('[data-testid="prompt-tree-active-prompt-simple-1"]')).toBeVisible()
    const examplesWidth = await getSidebarWidthByHandle(mainWindow, APP_SIDEBAR_HANDLE_TEST_ID)

    expect(examplesWidth).toBe(developmentWidth)
  })
})
