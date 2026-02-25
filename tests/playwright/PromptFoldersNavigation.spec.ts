import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

const EXAMPLES_BUTTON = '[data-testid="regular-prompt-folder-Examples"]'
const DEVELOPMENT_BUTTON = '[data-testid="regular-prompt-folder-Development"]'

describe('Prompt Folder Navigation (non-virtual)', () => {
  test('renders prompts when opening Examples', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_BUTTON, { state: 'visible' })

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(mainWindow.locator(EXAMPLES_BUTTON)).toHaveAttribute('data-active', 'true')
  })

  test('restores prompt content when revisiting folders', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_BUTTON, { state: 'visible' })

    let screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    let examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(true)
    expect(examplesPrompt.hasPromptEditor).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(DEVELOPMENT_BUTTON, { state: 'visible' })
    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', { state: 'attached' })

    screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(2)

    const developmentPrompt = await testHelpers.verifyPromptVisible('Code Review')
    expect(developmentPrompt.found).toBe(true)
    expect(developmentPrompt.hasPromptEditor).toBe(true)

    examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(false)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_BUTTON, { state: 'visible' })

    screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(true)
    expect(examplesPrompt.hasPromptEditor).toBe(true)

    const lingeringDevelopmentPrompt = await testHelpers.verifyPromptVisible('Code Review')
    expect(lingeringDevelopmentPrompt.found).toBe(false)
  })

  // Coverage merged from ScreenNavigationTests.spec.ts.
  test('navigates between prompt folders and renders expected prompts', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToRegularFolder('Examples')

    let screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(
      mainWindow.locator('[data-testid="regular-prompt-folder-Examples"]')
    ).toHaveAttribute('data-active', 'true')

    const promptResult = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(promptResult.found).toBe(true)
    expect(promptResult.hasPromptEditor).toBe(true)
    expect(promptResult.titleText).toContain('Simple Greeting')

    await testHelpers.navigateToRegularFolder('Development')
    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', { state: 'attached' })

    screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(2)
    await expect(
      mainWindow.locator('[data-testid="regular-prompt-folder-Development"]')
    ).toHaveAttribute('data-active', 'true')

    const codeReviewResult = await testHelpers.verifyPromptVisible('Code Review')
    expect(codeReviewResult.found).toBe(true)

    const bugAnalysisResult = await testHelpers.verifyPromptVisible('Bug Analysis')
    expect(bugAnalysisResult.found).toBe(true)
  })

  test('opens Prompt Folders view and renders prompt list', async ({ testSetup }) => {
    const { testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
  })

  test('creates and navigates to a new folder', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    const createFolderButton = mainWindow.locator('[data-testid="new-prompt-folder-button"]')
    await createFolderButton.click()

    const folderNameInput = mainWindow.locator('[data-testid="folder-name-input"]')
    const errorMessage = mainWindow.locator('[data-testid="folder-name-error"]')
    const createButton = mainWindow.locator('[data-testid="create-folder-button"]')

    await expect(errorMessage).toHaveCount(0)
    await expect(createButton).toBeDisabled()

    await folderNameInput.fill('Test Folder')
    await expect(errorMessage).toHaveCount(0)
    await expect(createButton).toBeEnabled()

    await folderNameInput.fill('')
    await expect(errorMessage).toBeVisible()
    await expect(createButton).toBeDisabled()

    await folderNameInput.fill('Test Folder')
    await expect(errorMessage).toHaveCount(0)
    await expect(createButton).toBeEnabled()

    await createButton.click()
    await expect(
      mainWindow.locator('[data-testid="regular-prompt-folder-TestFolder"]')
    ).toBeVisible()

    await testHelpers.navigateToRegularFolder('Test Folder')

    await expect(
      mainWindow.locator('[data-testid="regular-prompt-folder-TestFolder"]')
    ).toHaveAttribute('data-active', 'true')
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')
  })
})
