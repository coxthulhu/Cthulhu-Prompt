import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, expect } = createPlaywrightTestSuite()

// Sidebar navigation and state coverage.
test.describe('Sidebar Tests', () => {
  test('home selected on startup and settings enabled', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const activeScreen = await testHelpers.getActiveScreen()
    expect(activeScreen).toBe('home')

    const isHomeActive = await testHelpers.isNavButtonActive('Home')
    expect(isHomeActive).toBe(true)

    const settingsButton = mainWindow.locator('[data-testid="nav-button-settings"]')
    await expect(settingsButton).toBeEnabled()
  })

  test('keeps Home active on startup and when re-clicked', async ({ testSetup }) => {
    const { testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })

    await testHelpers.assertHomeActive()

    await testHelpers.navigateToHomeScreen()
    await testHelpers.assertHomeActive()
  })

  test('allows Settings without a workspace', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await testHelpers.assertHomeActive()
    expect(await testHelpers.isWorkspaceReady()).toBe(false)

    const settingsButton = mainWindow.locator('[data-testid="nav-button-settings"]')
    await expect(settingsButton).toBeVisible()
    await expect(settingsButton).toBeEnabled()
    await testHelpers.navigateToSettingsScreen()
    expect(await testHelpers.getActiveScreen()).toBe('settings')

    expect(await testHelpers.isNavButtonActive('Settings')).toBe(true)
  })

  test('allows navigating to Settings after workspace setup', async ({ testSetup }) => {
    const { testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'empty' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.assertHomeActive()

    await testHelpers.navigateToSettingsScreen()
    expect(await testHelpers.getActiveScreen()).toBe('settings')
    expect(await testHelpers.isNavButtonActive('Settings')).toBe(true)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.assertHomeActive()
  })
})
