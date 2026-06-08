import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

const EXAMPLES_OPEN_BUTTON = '[data-testid="prompt-tree-folder-open-button-Examples"]'
const DEVELOPMENT_OPEN_BUTTON = '[data-testid="prompt-tree-folder-open-button-Development"]'
const EXAMPLES_TOGGLE = '[data-testid="prompt-tree-folder-toggle-button-Examples"]'
const DEVELOPMENT_TOGGLE = '[data-testid="prompt-tree-folder-toggle-button-Development"]'
const EXAMPLES_OPTIONS = '[data-testid="prompt-tree-folder-options-button-Examples"]'
const DEVELOPMENT_OPTIONS = '[data-testid="prompt-tree-folder-options-button-Development"]'
const EXAMPLES_PROMPT_ROW = '[data-testid="prompt-tree-prompt-simple-1"]'
const DEVELOPMENT_PROMPT_ROW = '[data-testid="prompt-tree-prompt-dev-1"]'
const TOGGLE_ALL_PROMPT_FOLDERS_BUTTON = '[data-testid="toggle-all-prompt-folders-button"]'
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM =
  '[data-testid^="sidebar-prompt-folder-dropdown-item-"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM =
  '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'
const SHORT_OPTIONS = '[data-testid="prompt-tree-folder-options-button-Short"]'
const SHORT_TOGGLE = '[data-testid="prompt-tree-folder-toggle-button-Short"]'
const SHORT_SHOW_ALL = '[data-testid="prompt-tree-folder-show-all-prompts-Short"]'
const SHORT_PROMPT_50 = '[data-testid="prompt-tree-prompt-short-50"]'
const SHORT_EDITOR_50 = '[data-testid="prompt-editor-short-50"]'
const PROMPT_TREE_HOST = '[data-testid="prompt-tree-virtual-window"]'
const PROMPT_FOLDER_HOST = '[data-testid="prompt-folder-virtual-window"]'

describe('Prompt Folder Navigation (non-virtual)', () => {
  test('renders prompts when opening Examples', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_OPEN_BUTTON, { state: 'attached' })

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(mainWindow.locator(EXAMPLES_OPEN_BUTTON)).toHaveAttribute('data-active', 'true')
  })

  test('restores prompt content when revisiting folders', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_OPEN_BUTTON, { state: 'attached' })

    let screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    let examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(true)
    expect(examplesPrompt.hasPromptEditor).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(DEVELOPMENT_OPEN_BUTTON, { state: 'attached' })
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
    await mainWindow.waitForSelector(EXAMPLES_OPEN_BUTTON, { state: 'attached' })

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
      mainWindow.locator('[data-testid="prompt-tree-folder-open-button-Examples"]')
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
      mainWindow.locator('[data-testid="prompt-tree-folder-open-button-Development"]')
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

  test('opens the first folder from the activity bar when no folder was selected', async ({
    testSetup
  }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator('[data-testid="nav-button-prompt-folders"]').click()

    await mainWindow.waitForSelector('[data-testid="prompt-editor-simple-1"]', {
      state: 'attached'
    })
    await expect(mainWindow.locator('[data-testid="nav-button-prompt-folders"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.locator(EXAMPLES_OPEN_BUTTON)).toHaveAttribute('data-active', 'true')
  })

  test('restores the last prompt folder scroll when opened from the activity bar', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 900)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST))
      .toBeGreaterThan(0)
    const savedScrollTop = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)

    await testHelpers.navigateToHomeScreen()
    await mainWindow.locator('[data-testid="nav-button-prompt-folders"]').click()
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })

    await expect(mainWindow.locator('[data-testid="nav-button-prompt-folders"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(
      savedScrollTop
    )
  })

  test('selects prompt folders and opens create dialog from the sidebar dropdown', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await mainWindow
      .locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM)
      .filter({ hasText: 'Development Tools' })
      .click()

    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', {
      state: 'attached'
    })
    await expect(mainWindow.locator(DEVELOPMENT_OPEN_BUTTON)).toHaveAttribute('data-active', 'true')
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM).click()
    await expect(mainWindow.locator('[data-testid="create-prompt-folder-name-input"]')).toBeVisible()
  })

  test('keeps selection stable while folders expand and collapse', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await expect(mainWindow.locator(EXAMPLES_TOGGLE)).toBeVisible()
    await expect(mainWindow.locator(EXAMPLES_OPTIONS)).toHaveCount(1)
    await expect(mainWindow.locator(DEVELOPMENT_OPTIONS)).toHaveCount(1)

    await testHelpers.navigateToPromptFolders('Examples')
    await expect(mainWindow.locator(EXAMPLES_OPEN_BUTTON)).toHaveAttribute('data-active', 'true')

    await mainWindow.locator(EXAMPLES_TOGGLE).click()

    await expect(mainWindow.locator(EXAMPLES_OPEN_BUTTON)).toHaveAttribute('data-active', 'true')
    await expect(mainWindow.locator(EXAMPLES_OPTIONS)).toHaveCount(1)
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toHaveCount(0)
    await expect(mainWindow.locator(DEVELOPMENT_OPTIONS)).toHaveCount(1)

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    await mainWindow.locator(EXAMPLES_TOGGLE).click()
    await expect(mainWindow.locator(EXAMPLES_OPTIONS)).toHaveCount(1)
  })

  test('collapses all prompt folders from the sidebar action', async ({ testSetup }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toBeEnabled()
    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Prompt Folders'
    )
    await expect(mainWindow.locator(EXAMPLES_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(DEVELOPMENT_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(EXAMPLES_OPTIONS)).toHaveCount(1)
    await expect(mainWindow.locator(DEVELOPMENT_OPTIONS)).toHaveCount(1)

    await mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON).click()

    await expect(mainWindow.locator(EXAMPLES_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator(DEVELOPMENT_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Expand All Prompt Folders'
    )
    await expect(mainWindow.locator(EXAMPLES_OPTIONS)).toHaveCount(1)
    await expect(mainWindow.locator(DEVELOPMENT_OPTIONS)).toHaveCount(1)
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toHaveCount(0)
  })

  test('expands all prompt folders from the sidebar action', async ({ testSetup }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator(EXAMPLES_TOGGLE).click()
    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Prompt Folders'
    )

    await mainWindow.locator(DEVELOPMENT_TOGGLE).click()
    await expect(mainWindow.locator(EXAMPLES_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator(DEVELOPMENT_TOGGLE)).toHaveAttribute('aria-expanded', 'false')

    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toBeEnabled()
    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Expand All Prompt Folders'
    )
    await mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON).click()

    await expect(mainWindow.locator(EXAMPLES_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(DEVELOPMENT_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Prompt Folders'
    )
    await expect(mainWindow.locator(EXAMPLES_OPTIONS)).toHaveCount(1)
    await expect(mainWindow.locator(DEVELOPMENT_OPTIONS)).toHaveCount(1)
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toBeVisible()
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
  })

  test('creates and navigates to a new folder', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM).click()

    const folderNameInput = mainWindow.locator('[data-testid="create-prompt-folder-name-input"]')
    const errorMessage = mainWindow.locator('[data-testid="create-prompt-folder-name-error"]')
    const createButton = mainWindow.locator('[data-testid="create-prompt-folder-button"]')

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

    await mainWindow.evaluate(() => {
      const testWindow = window as typeof window & {
        __promptFolderCreateDuplicateErrorObserver?: MutationObserver
        __promptFolderCreateDuplicateErrorSeen?: boolean
      }

      testWindow.__promptFolderCreateDuplicateErrorSeen = false

      const observer = new MutationObserver(() => {
        const errorMessage = document.querySelector('[data-testid="create-prompt-folder-name-error"]')

        if (errorMessage?.textContent?.includes('A folder with this name already exists')) {
          testWindow.__promptFolderCreateDuplicateErrorSeen = true
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })
      testWindow.__promptFolderCreateDuplicateErrorObserver = observer
    })

    await createButton.click()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-folder-open-button-TestFolder"]')
    ).toHaveCount(1)
    expect(
      await mainWindow.evaluate(() => {
        const testWindow = window as typeof window & {
          __promptFolderCreateDuplicateErrorObserver?: MutationObserver
          __promptFolderCreateDuplicateErrorSeen?: boolean
        }

        testWindow.__promptFolderCreateDuplicateErrorObserver?.disconnect()
        return testWindow.__promptFolderCreateDuplicateErrorSeen
      })
    ).toBe(false)

    await testHelpers.navigateToRegularFolder('Test Folder')

    await expect(
      mainWindow.locator('[data-testid="prompt-tree-folder-open-button-TestFolder"]')
    ).toHaveAttribute('data-active', 'true')
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')
  })

  test('jumps to a prompt when clicking a prompt tree prompt row', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator(SHORT_SHOW_ALL).click()
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST, 1700)
    await mainWindow.waitForSelector(SHORT_PROMPT_50, { state: 'attached' })
    await mainWindow.evaluate((selector) => {
      const button = document.querySelector<HTMLButtonElement>(selector)
      if (!button) {
        throw new Error(`Missing prompt tree row: ${selector}`)
      }
      button.click()
    }, SHORT_PROMPT_50)

    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await mainWindow.waitForSelector(SHORT_EDITOR_50, { state: 'attached' })
    await expect(mainWindow.locator(SHORT_PROMPT_50)).toHaveAttribute('data-active', 'true')
  })

  test('tracks centered prompt scroll in tree, including folder settings and auto-expand', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })

    await expect(mainWindow.locator(SHORT_OPTIONS)).toHaveAttribute('data-active', 'true')

    await mainWindow.locator(SHORT_TOGGLE).click()
    await expect(mainWindow.locator(SHORT_OPTIONS)).toHaveAttribute('data-active', 'true')

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 1200)
    await expect(mainWindow.locator(SHORT_TOGGLE)).toHaveAttribute('aria-expanded', 'true')

    await expect(
      mainWindow.locator('[data-testid^="prompt-tree-prompt-short-"][aria-current="true"]')
    ).toBeVisible()

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 0)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await expect(mainWindow.locator(SHORT_OPTIONS)).toHaveAttribute('data-active', 'true')
  })

  test('maps prompt header navigation to the first prompt tree row', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 1200)
    await expect(mainWindow.locator('[data-testid="prompt-folder-header-section"]')).toHaveText(
      'Prompts'
    )

    await mainWindow.locator('[data-testid="prompt-folder-header-section"]').click()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-short-1"]')
    ).toHaveAttribute('data-active', 'true')
  })
})
