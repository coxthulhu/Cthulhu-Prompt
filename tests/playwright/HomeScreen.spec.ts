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

    test('shows an error dialog when opening an empty directory', async ({ testSetup }) => {
      const { mainWindow } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-directory-open', autoSetup: false }
      })

      await mainWindow.click('[data-testid="select-workspace-folder-button"]')

      const errorDialog = mainWindow.locator('[role="dialog"][aria-label="Workspace Not Found"]')
      await expect(errorDialog).toBeVisible()
      await expect(errorDialog).toContainText(
        'The selected folder does not contain a Cthulhu Prompt workspace.'
      )
      await expect(errorDialog).toContainText('Workspace Not Found.')
      await expect(mainWindow.locator('[data-testid="error-placeholder-button"]')).toHaveCount(0)
    })

    test('shows create dialog for empty directory creation and completes setup', async ({
      testSetup
    }) => {
      const { testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-directory', autoSetup: false }
      })

      const setupResult = await testHelpers.createWorkspaceViaUI()
      expect(setupResult.setupDialogAppeared).toBe(true)
      expect(setupResult.workspaceReady).toBe(true)
    })

    test('adds example prompts when setting up a new workspace', async ({ testSetup }) => {
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'empty', path: '/empty-with-examples', autoSetup: false }
      })

      await mainWindow.click('[data-testid="create-workspace-folder-button"]')

      const createDialog = mainWindow.locator('[role="dialog"][aria-label="Create Workspace"]')
      await expect(createDialog).toBeVisible()
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Example Workspace')
      await mainWindow.click('[data-testid="create-workspace-path-browse-button"]')

      const includeExamplesCheckbox = mainWindow.locator(
        '[data-testid="create-workspace-examples-checkbox"]'
      )
      await expect(includeExamplesCheckbox).toBeVisible()
      await expect(includeExamplesCheckbox).toBeChecked()

      await expect(
        mainWindow.locator('[data-testid="create-workspace-submit-button"]')
      ).toBeEnabled()
      await mainWindow.click('[data-testid="create-workspace-submit-button"]')
      await mainWindow.waitForSelector('[data-testid="workspace-ready-title"]', {
        state: 'visible',
        timeout: 5000
      })

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

    test('disables Create Workspace for invalid workspace names', async ({ testSetup }) => {
      await testSetup.setupFilesystem({ '/ws/invalid-name-containing': null })
      await testSetup.setupFileDialog(['/ws/invalid-name-containing'])

      const { mainWindow } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await mainWindow.click('[data-testid="create-workspace-folder-button"]')
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Bad/Name')
      await mainWindow.click('[data-testid="create-workspace-path-browse-button"]')

      await expect(mainWindow.locator('[data-testid="create-workspace-name-error"]')).toContainText(
        'Workspace name contains illegal characters'
      )
      await expect(
        mainWindow.locator('[data-testid="create-workspace-submit-button"]')
      ).toBeDisabled()
    })

    test('warns when the final workspace folder is not empty without blocking creation', async ({
      testSetup
    }) => {
      await testSetup.setupFilesystem({
        '/ws/non-empty-containing': null,
        '/ws/non-empty-containing\\ClientPrompts': null,
        '/ws/non-empty-containing\\ClientPrompts/notes.txt': 'Existing file'
      })
      await testSetup.setupFileDialog(['/ws/non-empty-containing'])

      const { mainWindow } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })

      await mainWindow.click('[data-testid="create-workspace-folder-button"]')
      await mainWindow.fill('[data-testid="create-workspace-name-input"]', 'Client Prompts')
      await mainWindow.click('[data-testid="create-workspace-path-browse-button"]')

      await expect(
        mainWindow.locator('[data-testid="create-workspace-final-path-input"]')
      ).toHaveValue('/ws/non-empty-containing\\ClientPrompts')
      await expect(
        mainWindow.locator('[data-testid="create-workspace-final-path-message"]')
      ).toContainText(
        'This folder is not empty. Typically, you want to create a workspace in an empty folder.'
      )
      await expect(
        mainWindow.locator('[data-testid="create-workspace-submit-button"]')
      ).toBeEnabled()
    })
  })
})
