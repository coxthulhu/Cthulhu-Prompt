import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

describe('Home Screen', () => {
  test('shows the get started state on launch without a workspace', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    // Confirm the app rendered the home screen before checking state.
    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="create-workspace-folder-button"]')).toBeVisible()

    expect(await testHelpers.isWorkspaceGetStarted()).toBe(true)
    expect(await testHelpers.isWorkspaceReady()).toBe(false)
  })

  test('renders the base home layout structure', async ({ testSetup }) => {
    const { testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    // Validate key structural elements without relying on text matching.
    const pageStructure = await testHelpers.validatePageStructure()
    expect(pageStructure.hasMainElement).toBe(true)
    expect(pageStructure.hasSidebar).toBe(true)
    expect(pageStructure.hasWelcomeText).toBe(true)
  })

  describe('Workspace Management', () => {
    test('detects existing workspace without setup dialog and can close it', async ({
      testSetup
    }) => {
      const { testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
        workspace: { scenario: 'minimal' }
      })

      expect(workspaceSetupResult.setupDialogAppeared).toBe(false)
      expect(workspaceSetupResult.workspaceReady).toBe(true)

      await testHelpers.assertWorkspaceReadyPath('/ws/minimal')

      await testHelpers.clearWorkspaceViaUI()
      expect(await testHelpers.isWorkspaceGetStarted()).toBe(true)
      expect(await testHelpers.isWorkspaceReady()).toBe(false)
    })

    test('keeps workspace ready across navigation', async ({ testSetup }) => {
      const { testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
        workspace: { scenario: 'minimal' }
      })

      expect(workspaceSetupResult.workspaceReady).toBe(true)

      await testHelpers.navigateToSettingsScreen()
      await testHelpers.navigateToHomeScreen()

      expect(await testHelpers.isWorkspaceReady()).toBe(true)
    })

    test('shows setup dialog for empty directory and completes setup', async ({ testSetup }) => {
      const { testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-directory', autoSetup: false }
      })

      const setupResult = await testHelpers.setupWorkspaceViaUI()
      expect(setupResult.setupDialogAppeared).toBe(true)
      expect(setupResult.workspaceReady).toBe(true)
    })

    test('adds example prompts when setting up a new workspace', async ({ testSetup }) => {
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-with-examples', autoSetup: false }
      })

      await mainWindow.click('[data-testid="select-workspace-folder-button"]')

      const setupDialog = mainWindow.locator('[role="dialog"]')
      await expect(setupDialog).toBeVisible()

      const includeExamplesCheckbox = mainWindow.locator(
        '[data-testid="include-example-prompts-checkbox"]'
      )
      await expect(includeExamplesCheckbox).toBeVisible()
      await expect(includeExamplesCheckbox).toHaveAttribute('data-state', 'checked')

      await mainWindow.click('[data-testid="setup-workspace-button"]')
      await mainWindow.waitForTimeout(1000)

      expect(await testHelpers.isWorkspaceReady()).toBe(true)

      await testHelpers.navigateToPromptFolders('My Prompts')
      await mainWindow.waitForSelector('[data-testid="prompt-folder-screen"]', { state: 'visible' })
      await mainWindow.waitForSelector('[data-testid^="prompt-editor-"]', {
        state: 'attached'
      })

      const firstPrompt = await testHelpers.verifyPromptVisible('Example: Add a Feature')
      const secondPrompt = await testHelpers.verifyPromptVisible('Example: Fix a Bug')
      expect(firstPrompt.found).toBe(true)
      expect(secondPrompt.found).toBe(true)

      const screenInfo = await testHelpers.getPromptFolderScreenInfo()
      expect(screenInfo.promptCount).toBe(2)
    })
  })
})
