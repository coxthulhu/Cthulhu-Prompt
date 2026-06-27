import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

const EXAMPLES_PROMPT_ROW = '[data-testid="prompt-tree-prompt-simple-1"]'
const DEVELOPMENT_PROMPT_ROW = '[data-testid="prompt-tree-prompt-dev-1"]'
const TOGGLE_ALL_PROMPT_FOLDERS_BUTTON = '[data-testid="toggle-all-prompt-folders-button"]'
const SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON =
  '[data-testid="selected-prompt-folder-actions-button"]'
const OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM =
  '[data-testid="open-selected-prompt-folder-settings-menu-item"]'
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM = '[data-testid^="sidebar-prompt-folder-dropdown-item-"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM =
  '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'
const SIDEBAR_PROMPT_FOLDER_ADD_BUTTON = '[data-testid="sidebar-prompt-folder-add-button"]'
const SHORT_PROMPT_50 = '[data-testid="prompt-tree-prompt-short-50"]'
const SHORT_EDITOR_50 = '[data-testid="prompt-editor-short-50"]'
const PROMPT_TREE_HOST = '[data-testid="prompt-tree-virtual-window"]'
const PROMPT_TREE_EMPTY_STATE = '[data-testid="prompt-tree-empty-state"]'
const PROMPT_FOLDER_HOST = '[data-testid="prompt-folder-virtual-window"]'
const SUBFOLDERS_WORKSPACE_PATH = '/ws/subfolders'

const createDeterministicId = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

describe('Prompt Folder Navigation (non-virtual)', () => {
  test('renders prompts when opening Examples', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_PROMPT_ROW, { state: 'attached' })

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Example Prompts'
    )
  })

  test('loads subfolder disk entries without showing them in the current prompt UI', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector('[data-testid="prompt-editor-base-before"]', {
      state: 'attached'
    })
    await mainWindow.waitForSelector('[data-testid="prompt-editor-base-after"]', {
      state: 'attached'
    })

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.promptCount).toBe(2)
    await expect(mainWindow.locator('[data-testid="prompt-editor-nested-prompt"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toHaveCount(
      0
    )

    const nestedFolderLoad = await mainWindow.evaluate(
      async ({ workspaceId, nestedFolderId }) => {
        return await window.electron.ipcRenderer.invoke('load-prompt-folder-initial', {
          requestId: `test-nested-load-${Date.now()}`,
          clientId: window.ipcClientId,
          payload: {
            workspaceId,
            promptFolderId: nestedFolderId
          }
        })
      },
      {
        workspaceId: createDeterministicId(SUBFOLDERS_WORKSPACE_PATH),
        nestedFolderId: createDeterministicId(`${SUBFOLDERS_WORKSPACE_PATH}:Main/Nested`)
      }
    )

    expect(nestedFolderLoad.success).toBe(true)
    const nestedFolderId = createDeterministicId(`${SUBFOLDERS_WORKSPACE_PATH}:Main/Nested`)
    const loadedNestedFolder = nestedFolderLoad.promptFolders.find(
      (promptFolder) => promptFolder.id === nestedFolderId
    )
    expect(loadedNestedFolder?.data.displayName).toBe('Nested')
    expect(loadedNestedFolder?.data.depth).toBe(1)
    expect(nestedFolderLoad.prompts.map((prompt) => prompt.id)).toEqual(['nested-prompt'])
  })

  test('restores prompt content when revisiting folders', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_PROMPT_ROW, { state: 'attached' })

    let screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    let examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(true)
    expect(examplesPrompt.hasPromptEditor).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(DEVELOPMENT_PROMPT_ROW, { state: 'attached' })
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
    await mainWindow.waitForSelector(EXAMPLES_PROMPT_ROW, { state: 'attached' })

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
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Example Prompts'
    )

    const promptResult = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(promptResult.found).toBe(true)
    expect(promptResult.hasPromptEditor).toBe(true)
    expect(promptResult.titleText).toContain('Simple Greeting')

    await testHelpers.navigateToRegularFolder('Development')
    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', { state: 'attached' })

    screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(2)
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Development Tools'
    )

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
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Example Prompts'
    )
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
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST))
      .toBe(savedScrollTop)
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
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Development Tools'
    )
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM).click()
    await expect(
      mainWindow.locator('[data-testid="create-prompt-folder-name-input"]')
    ).toBeVisible()
  })

  test('shows add prompt folder button when the workspace has no prompt folders', async ({
    testSetup
  }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_ADD_BUTTON)).toBeVisible()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_ADD_BUTTON)).toContainText(
      'Add Prompt Folder'
    )
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toHaveCount(0)
    await expect(mainWindow.locator('text=Create a Prompt Folder to Get Started')).toBeVisible()

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_ADD_BUTTON).click()
    await expect(
      mainWindow.locator('[data-testid="create-prompt-folder-name-input"]')
    ).toBeVisible()
  })

  test('shows only the selected folder prompt rows in the prompt tree', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toBeVisible()
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toHaveCount(0)

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    await testHelpers.navigateToPromptFolders('Development')
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toHaveCount(0)
  })

  test('keeps collapse all as a no-op sidebar action', async ({ testSetup }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toBeEnabled()
    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Prompt Folders'
    )
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toBeVisible()

    await mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON).click()

    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Prompt Folders'
    )
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toBeVisible()
  })

  test('opens selected folder settings from the sidebar actions menu', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 500)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST))
      .toBeGreaterThan(0)

    await expect(mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON)).toBeEnabled()
    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM).click()
    await expect(mainWindow.locator('[data-testid^="prompt-folder-editor-"]')).not.toHaveCount(0)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST))
      .toBeLessThan(100)
  })

  test('folder editor pencil button does not toggle prompts', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    const titleToggle = mainWindow.locator('[data-testid="prompt-folder-editor-title-toggle"]')
    const pencilButton = mainWindow.locator('[data-testid="prompt-folder-editor-title-edit"]')

    await expect(titleToggle).toHaveAttribute('aria-expanded', 'true')
    await pencilButton.click()
    await expect(titleToggle).toHaveAttribute('aria-expanded', 'true')
  })

  test('disables selected folder settings when no prompt folder exists', async ({ testSetup }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await expect(mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON)).toBeDisabled()
    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toBeDisabled()
  })

  test('creates and navigates to a new folder', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_ADD_BUTTON).click()

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
        const errorMessage = document.querySelector(
          '[data-testid="create-prompt-folder-name-error"]'
        )

        if (errorMessage?.textContent?.includes('A folder with this name already exists')) {
          testWindow.__promptFolderCreateDuplicateErrorSeen = true
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })
      testWindow.__promptFolderCreateDuplicateErrorObserver = observer
    })

    await createButton.click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Test Folder'
    )
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

    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Test Folder'
    )
    await expect(mainWindow.locator(PROMPT_FOLDER_HOST)).toBeVisible()
    await expect(mainWindow.locator(PROMPT_TREE_EMPTY_STATE)).toBeVisible()
    await expect(mainWindow.locator(PROMPT_TREE_EMPTY_STATE)).toContainText(
      'No prompts found in this folder.'
    )
    await expect(mainWindow.locator(PROMPT_TREE_HOST)).toHaveCount(0)
    await expect(
      mainWindow.locator(PROMPT_FOLDER_HOST).getByText('No prompts found in this folder.')
    ).toBeVisible()

    const emptyPromptFolderPlaceholderHasGutter = await mainWindow.evaluate((hostSelector) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      if (!host) return null

      const emptyMessage = Array.from(host.querySelectorAll('p')).find(
        (paragraph) => paragraph.textContent?.trim() === 'No prompts found in this folder.'
      )
      const placeholderRow = emptyMessage?.closest('.prompt-folder-section-row')
      return Boolean(placeholderRow?.querySelector('.promptFolderSectionGutter'))
    }, PROMPT_FOLDER_HOST)

    expect(emptyPromptFolderPlaceholderHasGutter).toBe(false)
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')
  })

  test('jumps to a prompt when clicking a prompt tree prompt row', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

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
    await expect(mainWindow.locator(SHORT_PROMPT_50)).toHaveAttribute('data-row-state', 'active')
  })

  test('tracks centered prompt scroll in tree and settings menu action', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 1200)
    await expect(
      mainWindow.locator('[data-testid^="prompt-tree-prompt-short-"][aria-current="true"]')
    ).toBeVisible()

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 0)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM).click()
    await expect(mainWindow.locator('[data-testid^="prompt-folder-editor-"]')).not.toHaveCount(0)
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
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-1"]')).toHaveAttribute(
      'data-row-state',
      'active'
    )
  })

  test('folder breadcrumb scrolls to top', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 1200)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(1200)

    await mainWindow.locator('[data-testid="prompt-folder-header-folder"]').click()

    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await expect(mainWindow.locator('[data-testid^="prompt-folder-editor-"]')).not.toHaveCount(0)
  })
})
