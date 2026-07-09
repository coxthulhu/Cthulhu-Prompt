import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithFolders,
  getWorkspaceInfoPath,
  setupWorkspaceScenario
} from '../fixtures/WorkspaceFixtures'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import {
  readWorkspacePersistence,
  seedUserPersistence,
  seedWorkspacePersistence
} from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'
const LONG_SINGLE_LINE_FOLDER_NAME = 'Long Wrapped Singles'
const TARGET_INDEX = 30
const TARGET_PROMPT_ID = `measurement-${TARGET_INDEX}`
const TARGET_PROMPT_TITLE = `Measurement Prompt ${TARGET_INDEX}`
const TARGET_PROMPT_TREE_ROW_SELECTOR = `[data-testid="prompt-tree-prompt-${TARGET_PROMPT_ID}"]`
const SHORT_FOLDER_NAME = 'Short'
const SHORT_FOLDER_TOGGLE = '[data-testid="prompt-tree-folder-toggle-button-Short"]'
const SHORT_SCROLL_TARGET_PX = 2000
const SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON =
  '[data-testid="selected-prompt-folder-actions-button"]'
const OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM =
  '[data-testid="open-selected-prompt-folder-settings-menu-item"]'
const SAMPLE_FOLDER_NAME = 'Development'
const SAMPLE_PROMPT_ID = 'dev-1'
const samplePromptTreeRowSelector = `[data-testid="prompt-tree-prompt-${SAMPLE_PROMPT_ID}"]`
const samplePromptTitleSelector = `${promptEditorSelector(SAMPLE_PROMPT_ID)} ${PROMPT_TITLE_SELECTOR}`
const UNOPENED_UNTITLED_WORKSPACE_PATH = '/ws/tree-untitled-summaries'
const LOADED_FOLDER_NAME = 'Loaded'
const UNOPENED_FOLDER_PROMPT_1_SELECTOR = '[data-testid="prompt-tree-prompt-unopened-1"]'
const UNOPENED_FOLDER_PROMPT_2_SELECTOR = '[data-testid="prompt-tree-prompt-unopened-2"]'
const SUBFOLDERS_WORKSPACE_PATH = '/ws/subfolders'
const SUBFOLDERS_MAIN_FOLDER_ID = createDeterministicId(`${SUBFOLDERS_WORKSPACE_PATH}:Main`)
const SUBFOLDERS_NESTED_FOLDER_ID = createDeterministicId(
  `${SUBFOLDERS_WORKSPACE_PATH}:Main/Nested`
)
const MAIN_FOLDER_TOGGLE = '[data-testid="prompt-tree-folder-toggle-button-Main"]'
const NESTED_FOLDER_TOGGLE = '[data-testid="prompt-tree-folder-toggle-button-Nested"]'
const NESTED_FOLDER_OPEN_BUTTON = '[data-testid="prompt-tree-folder-open-button-Nested"]'
const NESTED_FOLDER_OPTIONS_BUTTON = '[data-testid="prompt-tree-folder-options-button-Nested"]'
const NESTED_FOLDER_SETTINGS_MENU_ITEM =
  '[data-testid="prompt-tree-folder-settings-menu-item-Nested"]'
const TOGGLE_ALL_PROMPT_FOLDERS_BUTTON = '[data-testid="toggle-all-prompt-folders-button"]'
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'

function createDeterministicId(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

const scrollPromptTreeRowIntoView = async (
  mainWindow: any,
  testHelpers: any,
  rowSelector: string
) => {
  const hostHeight = await testHelpers.getPromptRowHeight(PROMPT_TREE_HOST_SELECTOR)
  const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(PROMPT_TREE_HOST_SELECTOR)
  const maxScrollTop = Math.max(0, scrollHeight - hostHeight)
  const stepPx = Math.max(1, Math.round(hostHeight * 0.8))

  for (let scrollTopPx = 0; scrollTopPx <= maxScrollTop; scrollTopPx += stepPx) {
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, scrollTopPx)
    if ((await mainWindow.locator(rowSelector).count()) > 0) {
      await testHelpers.scrollVirtualElementIntoView(PROMPT_TREE_HOST_SELECTOR, rowSelector, 20)
      return
    }
  }

  throw new Error(`Missing prompt tree row: ${rowSelector}`)
}

describe('Prompt folder prompt tree', () => {
  test('renders subfolders and persists prompt tree expansion state', async ({
    electronApp,
    testSetup
  }) => {
    const workspaceId = createDeterministicId(SUBFOLDERS_WORKSPACE_PATH)
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })
    await expect(mainWindow.locator(MAIN_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-after"]')).toBeVisible()

    const treeOrder = await mainWindow.locator(
      [
        '[data-testid="prompt-tree-folder-toggle-button-Main"]',
        '[data-testid="prompt-tree-prompt-base-before"]',
        '[data-testid="prompt-tree-folder-toggle-button-Nested"]',
        '[data-testid="prompt-tree-prompt-nested-prompt"]',
        '[data-testid="prompt-tree-prompt-base-after"]'
      ].join(', ')
    ).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')))
    expect(treeOrder).toEqual([
      'prompt-tree-folder-toggle-button-Main',
      'prompt-tree-prompt-base-before',
      'prompt-tree-folder-toggle-button-Nested',
      'prompt-tree-prompt-nested-prompt',
      'prompt-tree-prompt-base-after'
    ])

    const indentation = await mainWindow.evaluate(
      ({ rootSelector, nestedSelector, nestedPromptSelector }) => {
        const rootLabel = document
          .querySelector<HTMLElement>(rootSelector)
          ?.querySelector<HTMLElement>('.sidebarPromptTreeFolderLabel')
        const basePromptLabel = document
          .querySelector<HTMLElement>('[data-testid="prompt-tree-prompt-base-before"]')
          ?.querySelector<HTMLElement>('.sidebarPromptTreeSettingsLabel')
        const nestedLabel = document
          .querySelector<HTMLElement>(nestedSelector)
          ?.querySelector<HTMLElement>('.sidebarPromptTreeFolderLabel')
        const nestedPromptLabel = document
          .querySelector<HTMLElement>(nestedPromptSelector)
          ?.querySelector<HTMLElement>('.sidebarPromptTreeSettingsLabel')

        if (!rootLabel || !basePromptLabel || !nestedLabel || !nestedPromptLabel) {
          return null
        }

        return {
          rootLabelLeft: Math.round(rootLabel.getBoundingClientRect().left),
          basePromptLabelLeft: Math.round(basePromptLabel.getBoundingClientRect().left),
          nestedLabelLeft: Math.round(nestedLabel.getBoundingClientRect().left),
          nestedPromptLabelLeft: Math.round(nestedPromptLabel.getBoundingClientRect().left)
        }
      },
      {
        rootSelector: MAIN_FOLDER_TOGGLE,
        nestedSelector: NESTED_FOLDER_TOGGLE,
        nestedPromptSelector: '[data-testid="prompt-tree-prompt-nested-prompt"]'
      }
    )
    expect(indentation).not.toBeNull()
    expect(indentation!.nestedLabelLeft).toBeGreaterThan(indentation!.rootLabelLeft + 2)
    expect(indentation!.nestedPromptLabelLeft).toBeGreaterThan(
      indentation!.basePromptLabelLeft + 2
    )

    await mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]').click()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toHaveAttribute(
      'data-row-state',
      'idle'
    )
    await expect(mainWindow.locator('[data-testid="prompt-editor-nested-prompt"]')).toHaveCount(0)

    await mainWindow.locator(NESTED_FOLDER_TOGGLE).hover()
    await expect(mainWindow.locator(NESTED_FOLDER_OPEN_BUTTON)).toBeVisible()
    await mainWindow.locator(NESTED_FOLDER_OPEN_BUTTON).click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Main')
    await expect(mainWindow.locator('[data-testid="prompt-editor-nested-prompt"]')).toHaveCount(0)

    await mainWindow.locator(NESTED_FOLDER_TOGGLE).hover()
    await expect(mainWindow.locator(NESTED_FOLDER_OPTIONS_BUTTON)).toBeVisible()
    await mainWindow.locator(NESTED_FOLDER_OPTIONS_BUTTON).click()
    await expect(mainWindow.locator(NESTED_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(NESTED_FOLDER_SETTINGS_MENU_ITEM).click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Main')
    await expect(mainWindow.locator('[data-testid="prompt-editor-nested-prompt"]')).toHaveCount(0)

    await mainWindow.locator(NESTED_FOLDER_TOGGLE).click()
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toHaveCount(0)
    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          return persisted.promptFolderPromptTreeEntries.find(
            (entry) => entry.promptFolderId === SUBFOLDERS_NESTED_FOLDER_ID
          )?.promptTreeIsExpanded
        },
        { timeout: 15000 }
      )
      .toBe(false)

    await mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON).click()
    await expect(mainWindow.locator(MAIN_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveCount(0)
    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const rootEntry = persisted.promptFolderPromptTreeEntries.find(
            (entry) => entry.promptFolderId === SUBFOLDERS_MAIN_FOLDER_ID
          )
          const nestedEntry = persisted.promptFolderPromptTreeEntries.find(
            (entry) => entry.promptFolderId === SUBFOLDERS_NESTED_FOLDER_ID
          )
          return `${rootEntry?.promptTreeIsExpanded}:${nestedEntry?.promptTreeIsExpanded}`
        },
        { timeout: 15000 }
      )
      .toBe('false:false')

    await mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON).click()
    await expect(mainWindow.locator(MAIN_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toBeVisible()
  })

  test('restores persisted subfolder collapsed state on startup', async ({
    electronApp,
    testSetup
  }) => {
    const workspaceId = createDeterministicId(SUBFOLDERS_WORKSPACE_PATH)
    await testSetup.setupFilesystem(setupWorkspaceScenario(SUBFOLDERS_WORKSPACE_PATH, 'subfolders'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(SUBFOLDERS_WORKSPACE_PATH)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: SUBFOLDERS_MAIN_FOLDER_ID },
      promptFolderPromptTreeEntries: [
        {
          promptFolderId: SUBFOLDERS_MAIN_FOLDER_ID,
          promptTreeEntryId: 'folder-settings',
          promptTreeIsExpanded: true
        },
        {
          promptFolderId: SUBFOLDERS_NESTED_FOLDER_ID,
          promptTreeEntryId: 'folder-settings',
          promptTreeIsExpanded: false
        }
      ]
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect(mainWindow.locator(MAIN_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-editor-nested-prompt"]')).toHaveCount(0)
  })

  test('keeps selected prompt centered after hydration for long wrapped singles prompt-tree jump', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'long-wrapped-lines' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(LONG_SINGLE_LINE_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await scrollPromptTreeRowIntoView(mainWindow, testHelpers, TARGET_PROMPT_TREE_ROW_SELECTOR)
    const promptTreeButton = mainWindow.locator(TARGET_PROMPT_TREE_ROW_SELECTOR)
    await expect(promptTreeButton).toHaveText(TARGET_PROMPT_TITLE)
    await promptTreeButton.click()

    await mainWindow.waitForSelector(
      `${PROMPT_FOLDER_HOST_SELECTOR} ${PROMPT_EDITOR_PREFIX_SELECTOR}`,
      { state: 'attached' }
    )

    // Wait until all visible Monaco placeholders are gone to ensure hydration completed.
    await mainWindow.waitForFunction(
      ({ hostSelector, placeholderSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        if (!host) return false
        return host.querySelectorAll(placeholderSelector).length === 0
      },
      {
        hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
        placeholderSelector: MONACO_PLACEHOLDER_SELECTOR
      }
    )

    const centeredRowId = await mainWindow.evaluate(
      ({ hostSelector, rowSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        if (!host) return null
        const hostRect = host.getBoundingClientRect()
        const centerLine = Math.round(hostRect.top + hostRect.height / 2)
        const rows = Array.from(host.querySelectorAll<HTMLElement>(rowSelector))
        const centeredRow = rows.find((row) => {
          const rect = row.getBoundingClientRect()
          return rect.top <= centerLine && rect.bottom >= centerLine
        })
        return centeredRow?.getAttribute('data-testid') ?? null
      },
      { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, rowSelector: PROMPT_EDITOR_PREFIX_SELECTOR }
    )

    const expectedCenteredRowId = `prompt-editor-${TARGET_PROMPT_ID}`
    expect(centeredRowId).toBe(expectedCenteredRowId)

    await expect(promptTreeButton).toHaveAttribute('data-row-state', 'active')
  })

  test('scrolls back to folder settings when selecting settings in the prompt tree', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await expect(mainWindow.locator('[data-testid^="prompt-folder-editor-"]')).not.toHaveCount(0)

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, SHORT_SCROLL_TARGET_PX)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
      .toBeGreaterThan(0)

    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM).click()

    await expect(mainWindow.locator('[data-testid^="prompt-folder-editor-"]')).not.toHaveCount(0)
    await expect(mainWindow.locator(SHORT_FOLDER_TOGGLE)).toBeVisible()
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
      .toBeLessThan(100)
  })

  test('expands collapsed prompts section when selecting a prompt in the prompt tree', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SAMPLE_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    const promptsToggle = mainWindow.locator('[data-testid="prompt-folder-editor-title-toggle"]')
    await promptsToggle.click()
    await expect(promptsToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator(promptEditorSelector('dev-2'))).toHaveCount(0)

    await mainWindow.locator('[data-testid="prompt-tree-prompt-dev-2"]').click()

    await expect(promptsToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(promptEditorSelector('dev-2'))).toBeVisible()
  })

  test('updates prompt tree title while typing in title input', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SAMPLE_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    const titleInput = mainWindow.locator(samplePromptTitleSelector)
    const promptTreeRow = mainWindow.locator(samplePromptTreeRowSelector)

    await titleInput.waitFor({ state: 'visible' })
    await expect(promptTreeRow).toBeVisible()

    await titleInput.click()
    await mainWindow.keyboard.press('Control+A')
    await mainWindow.keyboard.press('Backspace')

    await mainWindow.keyboard.type('Live', { delay: 20 })
    await expect(promptTreeRow).toContainText('Live')

    const nextTitle = 'Live prompt title sync'
    await mainWindow.keyboard.type(' prompt title sync', { delay: 20 })
    await expect(promptTreeRow).toContainText(nextTitle)
  })

  test('shows every prompt in the selected folder without show more rows', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-5"]')).toBeVisible()
    await scrollPromptTreeRowIntoView(
      mainWindow,
      testHelpers,
      '[data-testid="prompt-tree-prompt-short-60"]'
    )
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-60"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid^="prompt-tree-folder-show-"]')).toHaveCount(0)
  })

  test('renders the selected root folder row above indented prompt rows', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await expect(mainWindow.locator(SHORT_FOLDER_TOGGLE)).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-1"]')).toBeVisible()

    const rootAndPromptGeometry = await mainWindow.evaluate(
      ({ hostSelector, rootToggleSelector, promptSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const rootToggle = document.querySelector<HTMLElement>(rootToggleSelector)
        const promptButton = document.querySelector<HTMLElement>(promptSelector)
        const rootRow = rootToggle?.closest<HTMLElement>('.sidebarPromptTreeFolderRow') ?? null
        const visibleRootRow = rootToggle?.closest<HTMLElement>('.sidebarPromptTreeRow') ?? null
        const promptLabel = promptButton?.querySelector<HTMLElement>(
          '.sidebarPromptTreeSettingsLabel'
        )
        const promptGuideLine = promptButton?.querySelector<HTMLElement>(
          '.sidebarPromptTreeGutter [data-indent-guide-line]'
        )
        const folderChevron = rootToggle?.querySelector<HTMLElement>(
          '.sidebarPromptTreeChevronWrap'
        )
        if (
          !host ||
          !rootToggle ||
          !promptButton ||
          !rootRow ||
          !visibleRootRow ||
          !promptLabel ||
          !folderChevron
        ) {
          return null
        }

        const hostRect = host.getBoundingClientRect()
        const rootRowRect = rootRow.getBoundingClientRect()
        const rootToggleRect = rootToggle.getBoundingClientRect()
        const visibleRootRowRect = visibleRootRow.getBoundingClientRect()
        const promptRect = promptButton.getBoundingClientRect()
        const promptLabelRect = promptLabel.getBoundingClientRect()
        const promptGuideLineRect = promptGuideLine?.getBoundingClientRect() ?? null
        const folderChevronRect = folderChevron.getBoundingClientRect()
        return {
          hasRootGutter: Boolean(rootRow.querySelector('.sidebarPromptTreeGutter')),
          folderChevronInsetPx: Math.round(folderChevronRect.left - hostRect.left),
          promptGuideLineInsetPx: promptGuideLineRect
            ? Math.round(promptGuideLineRect.left - hostRect.left)
            : null,
          promptLabelInsetPx: Math.round(promptLabelRect.left - hostRect.left),
          promptRowLeftPx: Math.round(promptRect.left - hostRect.left),
          promptRowRightPx: Math.round(hostRect.right - promptRect.right),
          rootRowLeftPx: Math.round(rootRowRect.left - hostRect.left),
          rootRowRightPx: Math.round(hostRect.right - rootRowRect.right),
          rootToggleLeftPx: Math.round(rootToggleRect.left - hostRect.left),
          rootToggleRightPx: Math.round(hostRect.right - rootToggleRect.right),
          visibleRootRowLeftPx: Math.round(visibleRootRowRect.left - hostRect.left),
          visibleRootRowRightPx: Math.round(hostRect.right - visibleRootRowRect.right),
          promptTopPx: Math.round(promptRect.top),
          rootTopPx: Math.round(rootRowRect.top)
        }
      },
      {
        hostSelector: PROMPT_TREE_HOST_SELECTOR,
        rootToggleSelector: SHORT_FOLDER_TOGGLE,
        promptSelector: '[data-testid="prompt-tree-prompt-short-1"]'
      }
    )
    expect(rootAndPromptGeometry).not.toBeNull()
    expect(rootAndPromptGeometry!.hasRootGutter).toBe(false)
    expect(Math.abs(rootAndPromptGeometry!.rootRowLeftPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.rootRowRightPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.rootToggleLeftPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.rootToggleRightPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.visibleRootRowLeftPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.visibleRootRowRightPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.promptRowLeftPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.promptRowRightPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.folderChevronInsetPx - 9)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.promptGuideLineInsetPx! - 13)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootAndPromptGeometry!.promptLabelInsetPx - 25)).toBeLessThanOrEqual(1)
    expect(rootAndPromptGeometry!.promptTopPx).toBeGreaterThan(rootAndPromptGeometry!.rootTopPx)
  })

  test('selects prompt rows and toggles folder rows from the left gutter', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    const promptRow = mainWindow.locator('[data-testid="prompt-tree-prompt-short-2"]')
    const folderToggle = mainWindow.locator(SHORT_FOLDER_TOGGLE)
    await expect(promptRow).toBeVisible()
    await expect(folderToggle).toHaveAttribute('aria-expanded', 'true')

    const promptBox = await promptRow.boundingBox()
    if (!promptBox) {
      throw new Error('Missing prompt tree gutter click geometry')
    }
    await mainWindow.mouse.click(promptBox.x + 8, promptBox.y + promptBox.height / 2)
    await expect(promptRow).toHaveAttribute('data-row-state', 'active')

    const folderBox = await folderToggle.boundingBox()
    if (!folderBox) {
      throw new Error('Missing prompt tree folder edge click geometry')
    }
    await mainWindow.mouse.click(folderBox.x + 2, folderBox.y + folderBox.height / 2)
    await expect(folderToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator('[data-testid^="prompt-tree-prompt-short-"]')).toHaveCount(0)
  })

  test('collapses the root folder row without changing the prompt folder screen section', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await expect(mainWindow.locator(SHORT_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-1"]')).toBeVisible()

    await mainWindow.locator(SHORT_FOLDER_TOGGLE).click()

    await expect(mainWindow.locator(SHORT_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator('[data-testid^="prompt-tree-prompt-short-"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-editor-title-toggle"]')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  test('keeps placeholder fallback numbering for unopened folders with blank titles', async ({
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(UNOPENED_UNTITLED_WORKSPACE_PATH, [
        {
          folderName: 'Loaded',
          displayName: LOADED_FOLDER_NAME,
          prompts: [
            {
              id: 'loaded-1',
              title: 'Loaded prompt',
              promptText: 'Loaded folder prompt'
            }
          ]
        },
        {
          folderName: 'UnopenedUntitled',
          displayName: 'Unopened Untitled',
          prompts: [
            {
              id: 'unopened-1',
              title: '',
              promptText: 'First unopened untitled prompt'
            },
            {
              id: 'unopened-2',
              title: '',
              promptText: 'Second unopened untitled prompt'
            }
          ]
        }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(UNOPENED_UNTITLED_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Unopened Untitled')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await expect(mainWindow.locator(UNOPENED_FOLDER_PROMPT_1_SELECTOR)).toHaveText('New Prompt')
    await expect(mainWindow.locator(UNOPENED_FOLDER_PROMPT_2_SELECTOR)).toHaveText('New Prompt 1')
  })
})
