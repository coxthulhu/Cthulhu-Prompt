import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import type { ConsoleMessage, Page } from 'playwright'
import {
  checkFileExists,
  checkPersistedPromptFilesExistByTitle,
  readTextFile
} from '../helpers/PromptPersistenceTestHelpers'

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
const PROMPT_TREE_ROOT_FOLDER = '[data-testid="prompt-tree-root-folder"]'
const PROMPT_TREE_EMPTY_STATE = '[data-testid="prompt-tree-empty-state"]'
const PROMPT_FOLDER_HOST = '[data-testid="prompt-folder-virtual-window"]'
const SAMPLE_WORKSPACE_PATH = '/ws/sample'
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

  test('loads and renders subfolder disk entries in the root prompt folder screen', async ({
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
    expect(screenInfo.promptCount).toBe(3)
    await expect(mainWindow.locator('[data-testid="prompt-editor-nested-prompt"]')).toBeAttached()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toBeVisible()

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
    expect(loadedNestedFolder?.data.entries).toEqual([
      { kind: 'prompt', id: 'nested-prompt' }
    ])
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
      'Create Prompt Folder'
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

  test('collapses and expands all prompt folders from the sidebar action', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Main')

    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toBeEnabled()
    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Prompt Folders'
    )
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-folder-toggle-button-Nested"]')
    ).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()

    await mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON).click()

    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Expand All Prompt Folders'
    )
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()

    await mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON).click()

    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Prompt Folders'
    )
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toBeVisible()
  })

  test('leaves selected root folder settings as a no-op', async ({
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
    const scrollTopBefore = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)

    await expect(mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON)).toBeEnabled()
    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM).click()
    await expect
      .poll(async () =>
        Math.abs(
          (await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)) - scrollTopBefore
        )
      )
      .toBeLessThanOrEqual(1)
    await expect(mainWindow.locator('[data-testid^="prompt-folder-settings-section-"]')).toHaveCount(0)
  })

  test('root title rename button does not hide prompts', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    const pencilButton = mainWindow.locator('[data-testid="prompt-folder-root-title-edit"]')
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
    await pencilButton.click()
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
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
    await expect(mainWindow.locator(PROMPT_TREE_HOST)).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-folder-toggle-button-TestFolder"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toContainText(
      'Test Folder'
    )
    await expect(mainWindow.locator(PROMPT_TREE_EMPTY_STATE)).toBeVisible()
    await expect(mainWindow.locator(PROMPT_TREE_EMPTY_STATE)).toContainText(
      'No prompts found in this folder.'
    )
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

  test('renames a prompt folder from the root page title without changing its id', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    const developmentFolderId = createDeterministicId(`${SAMPLE_WORKSPACE_PATH}:Development`)

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    const rootHeader = mainWindow.locator('[data-testid="prompt-folder-root-header"]')
    const rootTitle = rootHeader.locator('[data-testid="prompt-folder-root-title"]')
    await expect(rootHeader).toBeVisible()
    await expect(rootTitle).toHaveText('Development Tools')
    await expect(rootHeader.locator('h1')).toHaveCount(0)
    expect(
      await rootTitle.evaluate((element) => element.scrollHeight - element.clientHeight)
    ).toBeLessThanOrEqual(0)
    const rootHeaderGeometry = await rootHeader.evaluate((element) => {
      const filterBar = element.querySelector<HTMLElement>('.prompt-folder-root-filter-bar')
      const titleRow = element.querySelector<HTMLElement>('.prompt-folder-root-screen-header')
      const eyebrow = element.querySelector<HTMLElement>('.prompt-folder-root-eyebrow')
      const titleLine = element.querySelector<HTMLElement>('.prompt-folder-root-title-line')
      if (!filterBar || !titleRow || !eyebrow || !titleLine) return null

      const rowRect = element.getBoundingClientRect()
      const filterRect = filterBar.getBoundingClientRect()
      return {
        height: rowRect.height,
        titleRowHeight: titleRow.getBoundingClientRect().height,
        eyebrowHeight: eyebrow.getBoundingClientRect().height,
        titleLineHeight: titleLine.getBoundingClientRect().height,
        filterRowHeight: filterRect.height,
        bottomInset: rowRect.bottom - filterRect.bottom
      }
    })
    expect(rootHeaderGeometry).not.toBeNull()
    expect(rootHeaderGeometry!.height).toBe(140)
    expect(rootHeaderGeometry!.titleRowHeight).toBe(60)
    expect(rootHeaderGeometry!.eyebrowHeight).toBe(17)
    expect(rootHeaderGeometry!.titleLineHeight).toBe(36)
    expect(rootHeaderGeometry!.filterRowHeight).toBe(44)
    expect(Math.abs(rootHeaderGeometry!.bottomInset - 6)).toBeLessThanOrEqual(1)
    await rootHeader.locator('[data-testid="prompt-folder-root-title-edit"]').click()

    const nameInput = mainWindow.locator('[data-testid="rename-prompt-folder-name-input"]')
    const renameButton = mainWindow.locator('[data-testid="rename-prompt-folder-button"]')
    const errorMessage = mainWindow.locator('[data-testid="rename-prompt-folder-name-error"]')

    await expect(nameInput).toBeVisible()
    await expect(nameInput).toBeFocused()
    await expect(nameInput).toHaveValue('Development Tools')
    await expect(renameButton).toBeDisabled()
    await expect
      .poll(async () =>
        await nameInput.evaluate((input) => {
          if (!(input instanceof HTMLInputElement)) return null
          return input.selectionStart === 0 && input.selectionEnd === input.value.length
        })
      )
      .toBe(true)

    await nameInput.fill('Development')
    await expect(renameButton).toBeDisabled()

    await nameInput.fill('Examples')
    await expect(errorMessage).toContainText('A folder with this name already exists')
    await expect(renameButton).toBeDisabled()

    await nameInput.fill('Renamed Development')
    await expect(errorMessage).toHaveCount(0)
    await expect(renameButton).toBeEnabled()
    await renameButton.click()

    await expect(nameInput).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-header-folder"]')).toContainText(
      'Renamed Development'
    )
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Renamed Development'
    )
    await expect(rootHeader).toContainText('Renamed Development')

    const renamedFolderInfoPath = `${SAMPLE_WORKSPACE_PATH}/Prompts/RenamedDevelopment/_FolderInfo/FolderInfo.json`
    const renamedFolderInfo = JSON.parse(
      await readTextFile(electronApp, renamedFolderInfoPath)
    ) as {
      displayName: string
      promptFolderId: string
    }
    expect(renamedFolderInfo).toEqual({
      displayName: 'Renamed Development',
      promptFolderId: developmentFolderId
    })
    await expect
      .poll(
        async () =>
          await checkFileExists(
            electronApp,
            `${SAMPLE_WORKSPACE_PATH}/Prompts/Development/_FolderInfo/FolderInfo.json`
          )
      )
      .toBe(false)

    await expect
      .poll(async () =>
        await checkPersistedPromptFilesExistByTitle(electronApp, {
          workspacePath: SAMPLE_WORKSPACE_PATH,
          folderName: 'RenamedDevelopment',
          promptId: 'dev-1',
          promptTitle: 'Code Review'
        })
      )
      .toEqual({ markdownExists: true })
    await expect
      .poll(async () =>
        await checkPersistedPromptFilesExistByTitle(electronApp, {
          workspacePath: SAMPLE_WORKSPACE_PATH,
          folderName: 'Development',
          promptId: 'dev-1',
          promptTitle: 'Code Review'
        })
      )
      .toEqual({ markdownExists: false })
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

  test('selects the root folder row at the top and keeps root settings action inert', async ({
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
    await expect(mainWindow.locator(PROMPT_TREE_ROOT_FOLDER)).toHaveAttribute(
      'data-row-state',
      'active'
    )
    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM).click()
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid^="prompt-folder-settings-section-"]')).toHaveCount(0)
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

  test('recycles virtualized Monaco editors without stale tokenization errors', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })

    const scrollPositions = [0, 1200, 2400, 0, 1800, 600, 2400, 0]
    for (const scrollTopPx of scrollPositions) {
      await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, scrollTopPx)
      await expect
        .poll(async () => {
          return await mainWindow.evaluate((hostSelector) => {
            const host = document.querySelector<HTMLElement>(hostSelector)
            if (!host) return false
            const hostRect = host.getBoundingClientRect()
            return Array.from(host.querySelectorAll<HTMLElement>('.monaco-editor')).some(
              (editor) => {
                const editorRect = editor.getBoundingClientRect()
                return editorRect.bottom > hostRect.top && editorRect.top < hostRect.bottom
              }
            )
          }, PROMPT_FOLDER_HOST)
        })
        .toBe(true)
    }

    // Let already-posted TextMate worker results reach the renderer before asserting the capture.
    await mainWindow.waitForTimeout(100)
    expect(testSetup.getRendererErrors()).toEqual([])
  })

  test('runs VS Code extensions in a worker under the restrictive renderer CSP', async ({
    electronApp,
    testSetup
  }) => {
    const securityWarnings: string[] = []
    const captureSecurityWarning = (message: ConsoleMessage) => {
      if (message.text().includes('Electron Security Warning')) {
        securityWarnings.push(message.text())
      }
    }
    const captureWindowWarnings = (page: Page) => {
      page.on('console', captureSecurityWarning)
    }
    electronApp.on('window', captureWindowWarnings)

    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })

    await expect
      .poll(async () => {
        return await mainWindow.evaluate(() => {
          return document.querySelector('iframe.web-worker-ext-host-iframe') !== null
        })
      })
      .toBe(true)

    const allowsUnsafeEval = await mainWindow.evaluate(() => {
      const policy = document
        .querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')
        ?.content.split(';')
        .find((directive) => directive.trim().startsWith('script-src'))

      return policy?.trim().split(/\s+/).includes("'unsafe-eval'") ?? false
    })

    expect(allowsUnsafeEval).toBe(false)
    expect(securityWarnings).toEqual([])
    expect(testSetup.getRendererErrors()).toEqual([])
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
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toBeVisible()
  })

  test('root prompt tree row scrolls to top', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 1200)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(1200)
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST, 0)

    await mainWindow.locator(PROMPT_TREE_ROOT_FOLDER).click()

    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await expect(mainWindow.locator(PROMPT_TREE_ROOT_FOLDER)).toHaveAttribute(
      'data-row-state',
      'active'
    )
  })
})
