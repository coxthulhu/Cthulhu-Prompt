import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import { readWorkspaceUiState } from '../helpers/UserPersistenceHelpers'
import {
  focusMonacoEditor,
  isMonacoEditorFocused,
  moveMonacoCursorToEnd,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'
import { PromptStatus } from '../../src/shared/Prompt'
import { readPromptNavigationHighlightAnimation } from '../helpers/PromptNavigationHighlightHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'
/** Completed tree viewport rendered alongside the default Active tree viewport. */
const COMPLETED_PROMPT_TREE_HOST_SELECTOR =
  '[data-testid="prompt-tree-completed-virtual-window"]'
const SIDEBAR_FOLDER_ROOT_BUTTON_SELECTOR = '[data-testid="sidebar-folder-root-button"]'
const LONG_SINGLE_LINE_FOLDER_NAME = 'Long Wrapped Singles'
const TARGET_INDEX = 30
const TARGET_PROMPT_ID = `measurement-${TARGET_INDEX}`
const TARGET_PROMPT_TITLE = `Measurement Prompt ${TARGET_INDEX}`
const TARGET_PROMPT_TREE_ROW_SELECTOR = `[data-testid="prompt-tree-prompt-${TARGET_PROMPT_ID}"]`
const SHORT_FOLDER_NAME = 'Short'
/** Category selector used to prove the Short root is not duplicated in the tree. */
const SHORT_ROOT_DUPLICATE_CATEGORY_TOGGLE =
  '[data-testid="prompt-tree-category-toggle-button-Short"]'
const SHORT_SCROLL_TARGET_PX = 2000
const SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON =
  '[data-testid="selected-prompt-folder-actions-button"]'
const DELETE_SELECTED_PROMPT_FOLDER_MENU_ITEM =
  '[data-testid="delete-selected-prompt-folder-menu-item"]'
const SAMPLE_FOLDER_NAME = 'Development'
const SAMPLE_PROMPT_ID = 'dev-1'
const samplePromptTreeRowSelector = `[data-testid="prompt-tree-prompt-${SAMPLE_PROMPT_ID}"]`
const samplePromptTitleSelector = `${promptEditorSelector(SAMPLE_PROMPT_ID)} ${PROMPT_TITLE_SELECTOR}`
const UNOPENED_UNTITLED_WORKSPACE_PATH = '/ws/tree-untitled-summaries'
const LOADED_FOLDER_NAME = 'Loaded'
const UNOPENED_FOLDER_PROMPT_1_SELECTOR = '[data-testid="prompt-tree-prompt-unopened-1"]'
const UNOPENED_FOLDER_PROMPT_2_SELECTOR = '[data-testid="prompt-tree-prompt-unopened-2"]'
const COMPLETED_TREE_WORKSPACE_PATH = '/ws/completed-tree-navigation'
const COMPLETED_TREE_FOLDER_NAME = 'Completed Tree Navigation'
const COMPLETED_TREE_PROMPT_COUNT = 20
const COMPLETED_TREE_TARGET_PROMPT_ID = 'completed-tree-prompt-0'
const CATEGORIES_WORKSPACE_PATH = '/ws/categories'
const CATEGORIES_MAIN_FOLDER_ID = createDeterministicId(`${CATEGORIES_WORKSPACE_PATH}:Main`)
const CATEGORY_ID = createDeterministicId(
  `${CATEGORIES_WORKSPACE_PATH}:Main/Category`
)
/** Category selector used to prove the Main root is not duplicated in the tree. */
const MAIN_ROOT_DUPLICATE_CATEGORY_TOGGLE =
  '[data-testid="prompt-tree-category-toggle-button-Main"]'
const CATEGORY_TOGGLE = '[data-testid="prompt-tree-category-toggle-button-Category"]'
/** Active-tree action that creates content at the start of Category. */
const CATEGORY_ADD_TO_TOP_BUTTON =
  '[data-testid="prompt-tree-category-add-to-top-button-Category"]'
/** Context-menu action that opens Category without opening its settings. */
const CATEGORY_OPEN_MENU_ITEM =
  '[data-testid="prompt-tree-category-open-menu-item-Category"]'
const CATEGORY_SETTINGS_MENU_ITEM =
  '[data-testid="prompt-tree-category-settings-menu-item-Category"]'
const TOGGLE_ALL_CATEGORIES_BUTTON = '[data-testid="toggle-all-categories-button"]'
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'
const CATEGORY_EDITOR = `[data-testid="category-editor-${CATEGORY_ID}"]`
const CATEGORY_SETTINGS_TOGGLE = `${CATEGORY_EDITOR} [data-testid="category-editor-settings-toggle"]`
const CATEGORY_CONTENT_TOGGLE = `${CATEGORY_EDITOR} [data-testid="category-editor-content-toggle"]`
// Matches the category-navigation bias requested from the virtual window.
const PROMPT_FOLDER_CATEGORY_VERTICAL_BIAS_PX = 80
/** Preferred viewport-top offset for prompt and template navigation. */
const PROMPT_FOLDER_VERTICAL_BIAS_PX = 300
/** Minimum viewport-top offset retained when a complete editor is too tall for symmetric space. */
const PROMPT_FOLDER_MINIMUM_TOP_OFFSET_PX = 20
function createDeterministicId(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

const buildCompletedTreeWorkspace = (): Record<string, string | null> => {
  const workspace = createWorkspaceWithFolders(COMPLETED_TREE_WORKSPACE_PATH, [
    {
      folderName: COMPLETED_TREE_FOLDER_NAME,
      displayName: COMPLETED_TREE_FOLDER_NAME,
      prompts: Array.from({ length: COMPLETED_TREE_PROMPT_COUNT }, (_, index) => ({
        id: `completed-tree-prompt-${index}`,
        title: `Completed Tree Prompt ${index}`,
        promptText: `Completed prompt body ${index}.`,
        status: PromptStatus.Completed,
        finalizedAt: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
      }))
    }
  ])
  const activeFolderPrefix =
    `${COMPLETED_TREE_WORKSPACE_PATH}/Prompts/${COMPLETED_TREE_FOLDER_NAME}/Active/`
  const completedFolderPrefix =
    `${COMPLETED_TREE_WORKSPACE_PATH}/Prompts/${COMPLETED_TREE_FOLDER_NAME}/Completed/`

  for (const [path, content] of Object.entries(workspace)) {
    if (!path.startsWith(activeFolderPrefix) || !path.endsWith('.prompt.md')) continue

    delete workspace[path]
    workspace[path.replace(activeFolderPrefix, completedFolderPrefix)] = content
  }

  return workspace
}

const scrollPromptTreeRowIntoView = async (
  mainWindow: any,
  testHelpers: any,
  rowSelector: string,
  hostSelector = PROMPT_TREE_HOST_SELECTOR
) => {
  const hostHeight = await testHelpers.getPromptRowHeight(hostSelector)
  const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(hostSelector)
  const maxScrollTop = Math.max(0, scrollHeight - hostHeight)
  const stepPx = Math.max(1, Math.round(hostHeight * 0.8))

  for (let scrollTopPx = 0; scrollTopPx <= maxScrollTop; scrollTopPx += stepPx) {
    await testHelpers.scrollVirtualWindowTo(hostSelector, scrollTopPx)
    if ((await mainWindow.locator(rowSelector).count()) > 0) {
      await testHelpers.scrollVirtualElementIntoView(hostSelector, rowSelector)
      return
    }
  }

  throw new Error(`Missing prompt tree row: ${rowSelector}`)
}

/** Verifies tracked prompt navigation applies its bias, fit reduction, and document clamping. */
const expectRowToReachPromptFolderVerticalBias = async (
  mainWindow: any,
  testHelpers: any,
  rowSelector: string,
  verticalBiasPx = PROMPT_FOLDER_VERTICAL_BIAS_PX
) => {
  await expect
    .poll(async () => {
      const [geometry, scrollTop, scrollHeight] = await Promise.all([
        mainWindow.evaluate(
          ({ hostSelector, targetSelector }) => {
            const host = document.querySelector<HTMLElement>(hostSelector)
            const target = document.querySelector<HTMLElement>(targetSelector)
            if (!host || !target) return null

            const hostRect = host.getBoundingClientRect()
            const targetRect = target.getBoundingClientRect()
            return {
              topOffsetPx: targetRect.top - hostRect.top,
              rowHeightPx: targetRect.height,
              viewportHeightPx: hostRect.height
            }
          },
          { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, targetSelector: rowSelector }
        ),
        testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR),
        testHelpers.getVirtualWindowScrollHeight(PROMPT_FOLDER_HOST_SELECTOR)
      ])
      if (!geometry) return Number.POSITIVE_INFINITY

      /** Symmetric bias available after fitting the complete measured editor row. */
      const availableSymmetricBiasPx =
        (geometry.viewportHeightPx - geometry.rowHeightPx) / 2
      /** Effective bias after applying the configured preference and minimum top offset. */
      const effectiveBiasPx = Math.max(
        PROMPT_FOLDER_MINIMUM_TOP_OFFSET_PX,
        Math.min(verticalBiasPx, availableSymmetricBiasPx)
      )
      /** Absolute row offset reconstructed from its current viewport geometry. */
      const rowOffsetPx = scrollTop + geometry.topOffsetPx
      /** Maximum virtual scroll position used by document-boundary clamping. */
      const maxScrollTopPx = Math.max(0, scrollHeight - geometry.viewportHeightPx)
      /** Expected clamped scroll position for the configured vertical bias. */
      const expectedScrollTopPx = Math.min(
        Math.max(0, rowOffsetPx - effectiveBiasPx),
        maxScrollTopPx
      )
      /** Expected viewport-relative row top after boundary clamping. */
      const expectedTopOffsetPx = rowOffsetPx - expectedScrollTopPx
      return Math.abs(geometry.topOffsetPx - expectedTopOffsetPx)
    })
    .toBeLessThanOrEqual(2)
}

/** Verifies category navigation uses the shared tracked-bias fit behavior at 80px. */
const expectRowToReachPromptFolderCategoryBias = async (
  mainWindow: any,
  testHelpers: any,
  rowSelector: string
) => {
  await expectRowToReachPromptFolderVerticalBias(
    mainWindow,
    testHelpers,
    rowSelector,
    PROMPT_FOLDER_CATEGORY_VERTICAL_BIAS_PX
  )
}

const scrollPromptFolderRowAwayFromViewportCenter = async (
  mainWindow: any,
  testHelpers: any,
  rowSelector: string
) => {
  const hostHeight = await testHelpers.getPromptRowHeight(PROMPT_FOLDER_HOST_SELECTOR)
  const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(PROMPT_FOLDER_HOST_SELECTOR)
  const maxScrollTop = Math.max(0, scrollHeight - hostHeight)

  for (const scrollTopPx of [0, maxScrollTop]) {
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, scrollTopPx)
    const crossesCenter = await mainWindow.evaluate(
      ({ hostSelector, targetSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const target = document.querySelector<HTMLElement>(targetSelector)
        if (!host || !target) return false

        const hostRect = host.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const centerLine = hostRect.top + hostRect.height / 2
        return targetRect.top <= centerLine + 1 && targetRect.bottom >= centerLine - 1
      },
      { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, targetSelector: rowSelector }
    )
    if (!crossesCenter) return
  }

  throw new Error(`Could not scroll prompt-folder row away from viewport center: ${rowSelector}`)
}

describe('Prompt folder prompt tree', () => {
  test('highlights prompt tree and editor status lines on every prompt click', async ({
    testSetup
  }) => {
    /** Sample workspace exposes a Todo prompt with transparent normal indicators. */
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders(SAMPLE_FOLDER_NAME)

    /** Clickable tree row that initiates both synchronized highlights. */
    const promptTreeRow = mainWindow.locator(samplePromptTreeRowSelector)
    /** Tree status line overlaid beside the clicked prompt. */
    const treeIndicator = promptTreeRow
      .locator('..')
      .locator('[data-testid="prompt-tree-status-indicator"]')
    /** Matching status line on the prompt editor title bar. */
    const editorIndicator = mainWindow.locator(
      `${promptEditorSelector(SAMPLE_PROMPT_ID)} [data-testid="prompt-title-status-indicator"]`
    )
    await expect(promptTreeRow).toBeVisible()
    await expect(editorIndicator).toHaveCount(1)
    /** Status selector changes the target to a persistent non-transparent warning line. */
    const statusPill = mainWindow.locator(
      `${promptEditorSelector(SAMPLE_PROMPT_ID)} [data-testid="prompt-status-pill"]`
    )
    await statusPill.click()
    await mainWindow.locator('[data-testid="prompt-status-option-in-progress"]').click()
    await expect(treeIndicator).toHaveAttribute('data-status', 'InProgress')
    await expect(editorIndicator).toHaveAttribute('data-status', 'InProgress')

    await promptTreeRow.click()
    await expect(treeIndicator).toHaveAttribute('data-navigation-highlight', 'true')
    await expect(editorIndicator).toHaveAttribute('data-navigation-highlight', 'true')
    /** First generation shared by the tree and editor animations. */
    const firstGeneration = await treeIndicator.getAttribute(
      'data-navigation-highlight-generation'
    )
    expect(firstGeneration).toBeTruthy()
    await expect(editorIndicator).toHaveAttribute(
      'data-navigation-highlight-generation',
      firstGeneration!
    )

    /** Tree animation snapshot verifies the requested 50ms, 500ms, and 120ms phases. */
    const treeAnimation = await readPromptNavigationHighlightAnimation(treeIndicator)
    /** Editor animation snapshot verifies the same phase contract and purple color. */
    const editorAnimation = await readPromptNavigationHighlightAnimation(editorIndicator)
    expect(treeAnimation).toEqual({
      durationMs: 670,
      keyframeTimesMs: [0, 50, 550, 670],
      holdColor: treeAnimation.accentColor,
      accentColor: treeAnimation.accentColor,
      finalKeyframeColor: treeAnimation.normalColor,
      normalColor: treeAnimation.normalColor
    })
    expect(editorAnimation).toEqual({
      durationMs: 670,
      keyframeTimesMs: [0, 50, 550, 670],
      holdColor: editorAnimation.accentColor,
      accentColor: editorAnimation.accentColor,
      finalKeyframeColor: editorAnimation.normalColor,
      normalColor: editorAnimation.normalColor
    })

    await treeIndicator.evaluate((element) => {
      element.setAttribute('data-testid-highlight-instance', 'first')
    })
    await editorIndicator.evaluate((element) => {
      element.setAttribute('data-testid-highlight-instance', 'first')
    })
    await promptTreeRow.click()
    await expect
      .poll(() => treeIndicator.getAttribute('data-navigation-highlight-generation'))
      .not.toBe(firstGeneration)
    /** Replayed generation remains synchronized between the matching indicators. */
    const replayGeneration = await treeIndicator.getAttribute(
      'data-navigation-highlight-generation'
    )
    await expect(editorIndicator).toHaveAttribute(
      'data-navigation-highlight-generation',
      replayGeneration!
    )
    await expect(treeIndicator).not.toHaveAttribute('data-testid-highlight-instance', 'first')
    await expect(editorIndicator).not.toHaveAttribute('data-testid-highlight-instance', 'first')
    /** Replayed snapshot requires a fresh animation on the remounted indicator. */
    const replayTreeAnimation = await readPromptNavigationHighlightAnimation(treeIndicator)
    /** Fresh editor snapshot proves its independently keyed animation also replayed. */
    const replayEditorAnimation = await readPromptNavigationHighlightAnimation(editorIndicator)
    expect(replayTreeAnimation.durationMs).toBe(670)
    expect(replayTreeAnimation.holdColor).toBe(replayTreeAnimation.accentColor)
    expect(replayEditorAnimation.durationMs).toBe(670)
    expect(replayEditorAnimation.holdColor).toBe(replayEditorAnimation.accentColor)
  })

  test('renders categories and persists prompt tree expansion state', async ({
    electronApp,
    testSetup
  }) => {
    const workspaceId = createDeterministicId(CATEGORIES_WORKSPACE_PATH)
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })
    const folderRootButton = mainWindow.locator(SIDEBAR_FOLDER_ROOT_BUTTON_SELECTOR)
    await expect(mainWindow.locator('[data-testid="prompt-tree-root-folder"]')).toHaveCount(0)
    await expect(folderRootButton).toHaveAttribute('data-active', 'true')
    await expect(folderRootButton).toHaveCSS('border-top-style', 'none')
    const folderRootButtonBox = await folderRootButton.boundingBox()
    const folderRootIconBox = await folderRootButton.locator('svg').boundingBox()
    expect(folderRootButtonBox?.width).toBe(36)
    expect(folderRootButtonBox?.height).toBe(36)
    expect(folderRootIconBox?.width).toBe(20)
    expect(folderRootIconBox?.height).toBe(20)
    expect(
      await mainWindow
        .locator('.cthulhuSidebarPromptSectionActions .cthulhuUiIconButton')
        .evaluateAll((buttons) =>
          buttons.every((button) => {
            const buttonBox = button.getBoundingClientRect()
            const iconBox = button.querySelector('svg')?.getBoundingClientRect()
            return (
              buttonBox.width === 36 &&
              buttonBox.height === 36 &&
              iconBox?.width === 20 &&
              iconBox.height === 20
            )
          })
        )
    ).toBe(true)
    expect(
      await mainWindow
        .locator('.cthulhuSidebarPromptSectionActions .cthulhuUiIconButton')
        .evaluateAll((buttons) =>
          buttons.every((button) => button.getAttribute('data-borderless') === 'true')
        )
    ).toBe(true)
    expect(
      await mainWindow
        .locator('.cthulhuSidebarPromptSectionActions .cthulhuUiIconButton')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-testid')))
    ).toEqual([
      'sidebar-folder-root-button',
      'toggle-completed-prompts-button',
      'toggle-archived-prompts-button',
      'toggle-all-categories-button',
      'sidebar-add-category-button',
      'selected-prompt-folder-actions-button'
    ])
    const promptSectionAlignment = await mainWindow
      .locator('.cthulhuSidebarPromptSectionHeader')
      .evaluate((header) => {
        const actions = header.querySelector<HTMLElement>('.cthulhuSidebarPromptSectionActions')
        if (!actions) return null
        const headerBox = header.getBoundingClientRect()
        const actionsBox = actions.getBoundingClientRect()
        return actionsBox.left + actionsBox.width / 2 - (headerBox.left + headerBox.width / 2)
      })
    expect(promptSectionAlignment).not.toBeNull()
    expect(Math.abs(promptSectionAlignment!)).toBeLessThanOrEqual(1)
    await expect(mainWindow.locator('.cthulhuSidebarPromptSectionTitle')).toHaveCount(0)
    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()
    await expect(folderRootButton).toHaveAttribute('data-active', 'true')
    await expect(
      mainWindow.locator('[data-testid="toggle-completed-prompts-button"]')
    ).toHaveAttribute('data-active', 'true')
    // The gear uses the completed-check button's active background and glyph treatment.
    const folderRootActiveStyles = await folderRootButton.evaluate((button) => ({
      backgroundColor: getComputedStyle(button).backgroundColor,
      color: getComputedStyle(button).color
    }))
    await expect
      .poll(async () =>
        mainWindow
          .locator('[data-testid="toggle-completed-prompts-button"]')
          .evaluate((button) => ({
            backgroundColor: getComputedStyle(button).backgroundColor,
            color: getComputedStyle(button).color
          }))
      )
      .toEqual(folderRootActiveStyles)
    await mainWindow.locator('[data-testid="prompt-folder-active-filter"]').click()
    await expect(mainWindow.locator(MAIN_ROOT_DUPLICATE_CATEGORY_TOGGLE)).toHaveCount(0)
    await expect(mainWindow.locator(CATEGORY_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-after"]')).toBeVisible()

    const treeOrder = await mainWindow
      .locator(
        [
          '[data-testid="prompt-tree-prompt-base-before"]',
          '[data-testid="prompt-tree-prompt-base-after"]',
          '[data-testid="prompt-tree-category-toggle-button-Category"]',
          '[data-testid="prompt-tree-prompt-category-prompt"]'
        ].join(', ')
      )
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')))
    expect(treeOrder).toEqual([
      'prompt-tree-prompt-base-before',
      'prompt-tree-prompt-base-after',
      'prompt-tree-category-toggle-button-Category',
      'prompt-tree-prompt-category-prompt'
    ])

    /** Full virtual height used to move the root header away before sidebar navigation. */
    const promptFolderScrollHeightPx = await testHelpers.getVirtualWindowScrollHeight(
      PROMPT_FOLDER_HOST_SELECTOR
    )
    await testHelpers.scrollVirtualWindowTo(
      PROMPT_FOLDER_HOST_SELECTOR,
      promptFolderScrollHeightPx
    )
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
      .toBeGreaterThan(0)
    await folderRootButton.click()
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
      .toBe(0)

    const indentation = await mainWindow.evaluate(
      ({ categorySelector, categoryPromptSelector }) => {
        const basePromptLabel = document
          .querySelector<HTMLElement>('[data-testid="prompt-tree-prompt-base-before"]')
          ?.querySelector<HTMLElement>('.sidebarPromptTreeSettingsLabel')
        const categoryRow = document.querySelector<HTMLElement>(categorySelector)
        const categoryChevron = categoryRow?.querySelector<HTMLElement>(
          '.sidebarPromptTreeChevronWrap'
        )
        const categoryPromptLabel = document
          .querySelector<HTMLElement>(categoryPromptSelector)
          ?.querySelector<HTMLElement>('.sidebarPromptTreeSettingsLabel')

        if (
          !basePromptLabel ||
          !categoryRow ||
          !categoryChevron ||
          !categoryPromptLabel
        ) {
          return null
        }

        return {
          basePromptLabelLeft: Math.round(basePromptLabel.getBoundingClientRect().left),
          categoryHasGutter: Boolean(categoryRow.querySelector('.sidebarPromptTreeGutter')),
          categoryPromptLabelLeft: Math.round(categoryPromptLabel.getBoundingClientRect().left)
        }
      },
      {
        categorySelector: CATEGORY_TOGGLE,
        categoryPromptSelector: '[data-testid="prompt-tree-prompt-category-prompt"]'
      }
    )
    expect(indentation).not.toBeNull()
    expect(indentation!.categoryHasGutter).toBe(false)
    expect(indentation!.categoryPromptLabelLeft).toBeGreaterThan(indentation!.basePromptLabelLeft + 2)

    await scrollPromptFolderRowAwayFromViewportCenter(
      mainWindow,
      testHelpers,
      '[data-testid="prompt-editor-category-prompt"]'
    )
    await mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]').click()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toHaveAttribute('data-row-state', 'active')
    await expectRowToReachPromptFolderVerticalBias(
      mainWindow,
      testHelpers,
      '[data-testid="prompt-editor-category-prompt"]'
    )
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Main')
    await expect
      .poll(async () => {
        const persisted = await readWorkspaceUiState(electronApp, workspaceId)
        return persisted.selectedScreen === 'prompt-folders'
          ? persisted.selectedScreenData.promptFolderId
          : null
      })
      .toBe(CATEGORIES_MAIN_FOLDER_ID)

    await testHelpers.navigateToHomeScreen()
    await expect
      .poll(
        async () => {
          const persisted = await readWorkspaceUiState(electronApp, workspaceId)
          return persisted.promptFolderViewEntries.find(
            (entry) => entry.contentOwnerId === CATEGORY_ID
          )?.selectedEntryId
        },
        { timeout: 15000 }
      )
      .toBe('category-prompt')
    await testHelpers.navigateToPromptFolders('Main')
    await expectRowToReachPromptFolderVerticalBias(
      mainWindow,
      testHelpers,
      '[data-testid="prompt-editor-category-prompt"]'
    )

    await expect(mainWindow.locator(CATEGORY_SETTINGS_TOGGLE)).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await expect(mainWindow.locator(CATEGORY_CONTENT_TOGGLE)).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await mainWindow.locator(CATEGORY_CONTENT_TOGGLE).click()
    await expect(mainWindow.locator(CATEGORY_CONTENT_TOGGLE)).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await mainWindow.locator(CATEGORY_TOGGLE).click()
    await expect(mainWindow.locator(CATEGORY_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await scrollPromptFolderRowAwayFromViewportCenter(mainWindow, testHelpers, CATEGORY_EDITOR)
    await mainWindow.locator(CATEGORY_TOGGLE).click({ button: 'right' })
    await expect(mainWindow.locator(CATEGORY_OPEN_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(CATEGORY_OPEN_MENU_ITEM).click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Main')
    await expectRowToReachPromptFolderCategoryBias(mainWindow, testHelpers, CATEGORY_EDITOR)
    await expect(mainWindow.locator(CATEGORY_SETTINGS_TOGGLE)).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await expect(mainWindow.locator(CATEGORY_CONTENT_TOGGLE)).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await expect(mainWindow.locator(CATEGORY_TOGGLE)).toHaveAttribute('aria-expanded', 'true')

    await scrollPromptFolderRowAwayFromViewportCenter(mainWindow, testHelpers, CATEGORY_EDITOR)
    await mainWindow.locator(CATEGORY_TOGGLE).hover()
    await expect(
      mainWindow.locator('[data-testid^="prompt-tree-category-options-button-"]')
    ).toHaveCount(0)
    // Captures an ordinary point inside the row instead of either hover action.
    const categoryToggleBox = await mainWindow.locator(CATEGORY_TOGGLE).boundingBox()
    expect(categoryToggleBox).not.toBeNull()
    // Anchors the expected popup position to the right-click coordinates and cursor gap.
    const rowContextMenuPoint = {
      x: categoryToggleBox!.x + categoryToggleBox!.width / 2,
      y: categoryToggleBox!.y + categoryToggleBox!.height / 2
    }
    const contextMenuCursorGap = 4
    await mainWindow.mouse.click(rowContextMenuPoint.x, rowContextMenuPoint.y, { button: 'right' })
    await expect(mainWindow.locator(CATEGORY_SETTINGS_MENU_ITEM)).toBeVisible()
    // Reads the rendered popup geometry to verify cursor-relative placement.
    const rowContextMenuBox = await mainWindow
      .locator(CATEGORY_SETTINGS_MENU_ITEM)
      .locator('xpath=ancestor::*[@role="menu"]')
      .boundingBox()
    expect(rowContextMenuBox).not.toBeNull()
    expect(
      Math.abs(rowContextMenuBox!.x - rowContextMenuPoint.x - contextMenuCursorGap)
    ).toBeLessThanOrEqual(2)
    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).focus()
    await mainWindow.keyboard.press('Enter')
    await expect(mainWindow.locator(CATEGORY_SETTINGS_MENU_ITEM)).toHaveCount(0)
    await expect(mainWindow.locator(DELETE_SELECTED_PROMPT_FOLDER_MENU_ITEM)).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await mainWindow.locator(CATEGORY_TOGGLE).focus()
    await mainWindow.keyboard.press('Shift+F10')
    await expect(mainWindow.locator(CATEGORY_SETTINGS_MENU_ITEM)).toHaveCount(0)
    await mainWindow.locator(CATEGORY_ADD_TO_TOP_BUTTON).click({ button: 'right' })
    await expect(mainWindow.locator(CATEGORY_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(CATEGORY_SETTINGS_MENU_ITEM).click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Main')
    await expectRowToReachPromptFolderCategoryBias(mainWindow, testHelpers, CATEGORY_EDITOR)
    await expect(mainWindow.locator(CATEGORY_SETTINGS_TOGGLE)).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await mainWindow.locator(CATEGORY_TOGGLE).hover()
    await expect(mainWindow.locator(CATEGORY_ADD_TO_TOP_BUTTON)).toBeVisible()
    await expect(mainWindow.locator(CATEGORY_ADD_TO_TOP_BUTTON).locator('svg')).toHaveClass(
      /lucide-plus/
    )
    await expect(mainWindow.locator(CATEGORY_ADD_TO_TOP_BUTTON)).toHaveAttribute(
      'aria-label',
      'Add Prompt to top of category Category'
    )
    await mainWindow.locator(CATEGORY_ADD_TO_TOP_BUTTON).click()
    /** Newly biased editor identified by its generated untitled-prompt placeholder. */
    const createdEditor = mainWindow
      .locator(PROMPT_EDITOR_PREFIX_SELECTOR)
      .filter({ has: mainWindow.locator(`${PROMPT_TITLE_SELECTOR}[placeholder^="New Prompt"]`) })
    await expect(createdEditor).toHaveCount(1)
    /** Stable generated ID used to compare the category's resulting tree order. */
    const createdPromptId = (await createdEditor.getAttribute('data-testid'))!.replace(
      'prompt-editor-',
      ''
    )
    await expect
      .poll(() => isMonacoEditorFocused(mainWindow, promptEditorSelector(createdPromptId)))
      .toBe(true)
    await expectRowToReachPromptFolderVerticalBias(
      mainWindow,
      testHelpers,
      promptEditorSelector(createdPromptId)
    )
    /** Category prompt IDs in current tree order after adding at its top boundary. */
    const categoryPromptOrder = await mainWindow
      .locator(
        `[data-testid="prompt-tree-prompt-${createdPromptId}"], [data-testid="prompt-tree-prompt-category-prompt"]`
      )
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')))
    expect(categoryPromptOrder).toEqual([
      `prompt-tree-prompt-${createdPromptId}`,
      'prompt-tree-prompt-category-prompt'
    ])

    await mainWindow.locator(CATEGORY_TOGGLE).click()
    await expect(mainWindow.locator(CATEGORY_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toHaveCount(0)
    await expect
      .poll(
        async () => {
          const persisted = await readWorkspaceUiState(electronApp, workspaceId)
          return persisted.promptFolderViewEntries.find(
            (entry) => entry.contentOwnerId === CATEGORY_ID
          )?.treeIsExpanded
        },
        { timeout: 15000 }
      )
      .toBe(false)

    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toHaveAttribute(
      'aria-label',
      'Expand All Categories'
    )
    await mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).click()
    await expect(mainWindow.locator(CATEGORY_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toBeVisible()
    await expect
      .poll(
        async () => {
          const persisted = await readWorkspaceUiState(electronApp, workspaceId)
          const categoryEntry = persisted.promptFolderViewEntries.find(
            (entry) => entry.contentOwnerId === CATEGORY_ID
          )
          return categoryEntry?.treeIsExpanded
        },
        { timeout: 15000 }
      )
      .toBe(true)
  })

  test('shows category add-to-top only in the Active tree', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories-ui' }
    })
    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()

    /** Active and Completed accordion roots used to scope status-tree actions. */
    const activeTree = mainWindow.locator(
      '[data-testid="sidebar-prompt-status-accordion-content-active"]'
    )
    const completedTree = mainWindow.locator(
      '[data-testid="sidebar-prompt-status-accordion-content-completed"]'
    )
    /** Primary category add action rendered only by the Active status tree. */
    const categoryAddSelector =
      '[data-testid="prompt-tree-category-add-to-top-button-Primary"]'

    await expect(activeTree.locator(categoryAddSelector)).toHaveCount(1)
    await expect(
      completedTree.locator('[data-testid="prompt-tree-prompt-categories-ui-root-completed"]')
    ).toBeVisible()
    await expect(
      completedTree.locator('[data-testid^="prompt-tree-category-add-to-top-button-"]')
    ).toHaveCount(0)
  })

  test('reduces prompt navigation bias to 20px after a tall editor hydrates', async ({
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

    await expectRowToReachPromptFolderVerticalBias(
      mainWindow,
      testHelpers,
      promptEditorSelector(TARGET_PROMPT_ID)
    )
    /** Hydrated target whose maximum editor height exceeds the available viewport. */
    const targetEditor = mainWindow.locator(promptEditorSelector(TARGET_PROMPT_ID))
    await expect
      .poll(async () => {
        /** Settled viewport and row geometry for the minimum-offset overflow case. */
        const targetGeometry = await targetEditor.evaluate((row, hostSelector) => {
          const host = document.querySelector<HTMLElement>(hostSelector)
          if (!host) return null
          const hostRect = host.getBoundingClientRect()
          const rowRect = row.getBoundingClientRect()
          return {
            topOffsetPx: rowRect.top - hostRect.top,
            bottomOverflowPx: rowRect.bottom - hostRect.bottom,
            rowHeightPx: rowRect.height,
            viewportHeightPx: hostRect.height
          }
        }, PROMPT_FOLDER_HOST_SELECTOR)
        if (
          !targetGeometry ||
          targetGeometry.rowHeightPx <=
            targetGeometry.viewportHeightPx - PROMPT_FOLDER_MINIMUM_TOP_OFFSET_PX * 2 ||
          targetGeometry.bottomOverflowPx <= 0
        ) {
          return Number.POSITIVE_INFINITY
        }
        return Math.abs(
          targetGeometry.topOffsetPx - PROMPT_FOLDER_MINIMUM_TOP_OFFSET_PX
        )
      })
      .toBeLessThanOrEqual(2)

    await expect(promptTreeButton).toHaveAttribute('data-row-state', 'active')
  })

  test('stops tracking a biased prompt after hydration beside collapsed folder settings', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    const promptEditor = promptEditorSelector('category-prompt')
    const promptTreeRow = mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    await expect(mainWindow.locator(CATEGORY_SETTINGS_TOGGLE)).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await scrollPromptFolderRowAwayFromViewportCenter(mainWindow, testHelpers, promptEditor)
    await promptTreeRow.click()
    await expectRowToReachPromptFolderVerticalBias(
      mainWindow,
      testHelpers,
      promptEditor
    )
    await waitForMonacoEditor(mainWindow, promptEditor)

    // Wait for every mounted viewport editor to hydrate before checking that tracking stopped.
    await mainWindow.waitForFunction(
      ({ hostSelector, placeholderSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        return host != null && host.querySelectorAll(placeholderSelector).length === 0
      },
      {
        hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
        placeholderSelector: MONACO_PLACEHOLDER_SELECTOR
      }
    )

    await focusMonacoEditor(mainWindow, promptEditor)
    await moveMonacoCursorToEnd(mainWindow, promptEditor)
    const beforeEdit = await mainWindow.locator(promptEditor).boundingBox()
    expect(beforeEdit).not.toBeNull()

    for (let index = 0; index < 8; index += 1) {
      await mainWindow.keyboard.press('Enter')
    }

    await expect
      .poll(async () => (await mainWindow.locator(promptEditor).boundingBox())?.height ?? 0)
      .toBeGreaterThan(beforeEdit!.height)
    const afterEdit = await mainWindow.locator(promptEditor).boundingBox()
    expect(afterEdit).not.toBeNull()
    expect(Math.abs(afterEdit!.y - beforeEdit!.y)).toBeLessThanOrEqual(2)
  })

  test('biases a completed prompt when clicking its prompt tree row', async ({ testSetup }) => {
    await testSetup.setupFilesystem(buildCompletedTreeWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COMPLETED_TREE_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(COMPLETED_TREE_FOLDER_NAME)
    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()
    await expect(mainWindow.locator('[data-testid="prompt-tree-active-empty-status"]')).toHaveText(
      'No active prompts. Click to view.'
    )
    await expect(mainWindow.locator(PROMPT_TREE_HOST_SELECTOR)).toHaveCount(0)
    await mainWindow.locator('[data-testid="prompt-tree-active-empty-status"]').click()
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()

    const targetTreeRow = `[data-testid="prompt-tree-prompt-${COMPLETED_TREE_TARGET_PROMPT_ID}"]`
    const targetEditor = promptEditorSelector(COMPLETED_TREE_TARGET_PROMPT_ID)
    await scrollPromptTreeRowIntoView(
      mainWindow,
      testHelpers,
      targetTreeRow,
      COMPLETED_PROMPT_TREE_HOST_SELECTOR
    )
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await expect(mainWindow.locator(targetEditor)).toHaveCount(0)

    await mainWindow.locator(targetTreeRow).click()

    await expect(mainWindow.locator(targetTreeRow)).toHaveAttribute('data-row-state', 'active')
    await expectRowToReachPromptFolderVerticalBias(
      mainWindow,
      testHelpers,
      targetEditor
    )
  })

  test('opens selected root folder deletion from a scrolled prompt tree', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, SHORT_SCROLL_TARGET_PX)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
      .toBeGreaterThan(0)

    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(DELETE_SELECTED_PROMPT_FOLDER_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(DELETE_SELECTED_PROMPT_FOLDER_MENU_ITEM).click()
    const deleteDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Delete Prompt Folder"]'
    )
    await expect(deleteDialog).toBeVisible()

    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
      .toBeGreaterThan(0)
    await expect(mainWindow.locator(SHORT_ROOT_DUPLICATE_CATEGORY_TOGGLE)).toHaveCount(0)
    await deleteDialog.getByRole('button', { name: 'Cancel' }).click()
  })

  test('expands collapsed prompts section when selecting a prompt in the prompt tree', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    const promptsToggle = mainWindow.locator(CATEGORY_CONTENT_TOGGLE)
    await promptsToggle.click()
    await expect(promptsToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator(promptEditorSelector('category-prompt'))).toHaveCount(0)

    await mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]').click()

    await expect(promptsToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(promptEditorSelector('category-prompt'))).toBeVisible()
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

  test('shows every prompt in the selected folder without show more rows', async ({
    testSetup
  }) => {
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

  test('omits the root row and reduces direct entry indentation', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await expect(mainWindow.locator(MAIN_ROOT_DUPLICATE_CATEGORY_TOGGLE)).toHaveCount(0)
    const basePrompt = mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')
    const category = mainWindow.locator(CATEGORY_TOGGLE)
    const categoryPrompt = mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    await expect(basePrompt).toBeVisible()
    await expect(category).toBeVisible()
    await expect(categoryPrompt).toBeVisible()

    await expect(basePrompt.locator('[data-indent-guide-line]')).toHaveCount(0)
    await expect(category.locator('.sidebarPromptTreeGutter')).toHaveCount(0)
    await expect(categoryPrompt.locator('[data-indent-guide-line]')).toHaveCount(1)

    const categoryRowTreatment = await category.evaluate((button) => {
      const chevron = button.querySelector<HTMLElement>('.sidebarPromptTreeChevronWrap')
      const categoryIcon = button.querySelector<SVGElement>('.sidebarPromptTreeCategoryIcon')
      const label = button.querySelector<HTMLElement>('.sidebarPromptTreeCategoryLabel')
      if (!chevron || !categoryIcon || !label) return null

      const buttonRect = button.getBoundingClientRect()
      const chevronRect = chevron.getBoundingClientRect()
      const categoryIconRect = categoryIcon.getBoundingClientRect()
      const labelRect = label.getBoundingClientRect()
      const labelStyle = getComputedStyle(label)
      return {
        chevronInsetPx: chevronRect.left - buttonRect.left,
        categoryIconOffsetPx: categoryIconRect.left - chevronRect.left,
        labelOffsetPx: labelRect.left - categoryIconRect.left,
        categoryIconWidthPx: categoryIconRect.width,
        labelFontSize: labelStyle.fontSize,
        labelFontWeight: labelStyle.fontWeight
      }
    })

    expect(categoryRowTreatment).not.toBeNull()
    expect(Math.abs(categoryRowTreatment!.chevronInsetPx - 6)).toBeLessThanOrEqual(1)
    expect(Math.abs(categoryRowTreatment!.categoryIconOffsetPx - 32)).toBeLessThanOrEqual(1)
    expect(Math.abs(categoryRowTreatment!.labelOffsetPx - 26)).toBeLessThanOrEqual(1)
    expect(Math.abs(categoryRowTreatment!.categoryIconWidthPx - 16)).toBeLessThanOrEqual(1)
    expect(categoryRowTreatment!.labelFontSize).toBe('14px')
    expect(categoryRowTreatment!.labelFontWeight).toBe('400')
  })

  test('uses the category action space only while category actions are visible', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    const categoryToggle = mainWindow.locator(CATEGORY_TOGGLE)
    const categoryLabel = categoryToggle.locator('.sidebarPromptTreeCategoryLabel')
    const categoryActions = mainWindow.locator(
      '[data-testid="prompt-tree-category-add-to-top-button-Category"]'
    )
    const readRoundedLabelWidth = async (): Promise<number> =>
      categoryLabel.evaluate((label) => Math.round(label.getBoundingClientRect().width))

    await mainWindow.mouse.move(0, 0)
    await expect(categoryActions).toBeHidden()
    const restingLabelWidth = await readRoundedLabelWidth()

    await categoryToggle.hover()
    await expect(categoryActions).toBeVisible()
    const hoveredLabelWidth = await readRoundedLabelWidth()
    const categoryToggleBox = await categoryToggle.boundingBox()
    const categoryActionsBox = await categoryActions.boundingBox()

    expect(Math.abs(restingLabelWidth - hoveredLabelWidth - 44)).toBeLessThanOrEqual(1)
    expect(categoryToggleBox).not.toBeNull()
    expect(categoryActionsBox).not.toBeNull()
    const categoryActionsRightInset =
      categoryToggleBox!.x +
      categoryToggleBox!.width -
      categoryActionsBox!.x -
      categoryActionsBox!.width
    expect(Math.abs(categoryActionsRightInset - 14)).toBeLessThanOrEqual(1)

    await mainWindow.mouse.move(0, 0)
    await expect(categoryActions).toBeHidden()
    await expect.poll(readRoundedLabelWidth).toBe(restingLabelWidth)
  })

  test('selects prompt rows and toggles category rows from the left gutter', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    const promptRow = mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')
    const categoryToggle = mainWindow.locator(CATEGORY_TOGGLE)
    await expect(promptRow).toBeVisible()
    await expect(categoryToggle).toHaveAttribute('aria-expanded', 'true')

    const promptBox = await promptRow.boundingBox()
    if (!promptBox) {
      throw new Error('Missing prompt tree gutter click geometry')
    }
    await mainWindow.mouse.click(promptBox.x + 8, promptBox.y + promptBox.height / 2)
    await expect(promptRow).toHaveAttribute('data-row-state', 'active')

    const categoryBox = await categoryToggle.boundingBox()
    if (!categoryBox) {
      throw new Error('Missing prompt tree category edge click geometry')
    }
    await mainWindow.mouse.click(categoryBox.x + 2, categoryBox.y + categoryBox.height / 2)
    await expect(categoryToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toHaveCount(0)
    await expect(promptRow).toBeVisible()
  })

  test('does not select prompt tree text when dragging from between rows', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    const firstPrompt = mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')
    const category = mainWindow.locator(CATEGORY_TOGGLE)
    await expect(firstPrompt).toBeVisible()
    await expect(category).toBeVisible()

    const firstPromptBox = await firstPrompt.boundingBox()
    const categoryBox = await category.boundingBox()
    if (!firstPromptBox || !categoryBox) {
      throw new Error('Missing prompt tree row-gap drag geometry')
    }

    const gapY = (firstPromptBox.y + firstPromptBox.height + categoryBox.y) / 2
    await mainWindow.mouse.move(firstPromptBox.x + firstPromptBox.width / 2, gapY)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(
      categoryBox.x + categoryBox.width - 24,
      categoryBox.y + categoryBox.height / 2,
      { steps: 4 }
    )
    await mainWindow.mouse.up()

    await expect
      .poll(() => mainWindow.evaluate(() => window.getSelection()?.toString() ?? ''))
      .toBe('')
  })

  test('keeps root prompt rows visible when a category is collapsed', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await expect(mainWindow.locator(CATEGORY_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()

    await mainWindow.locator(CATEGORY_TOGGLE).click()

    await expect(mainWindow.locator(CATEGORY_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-editor-base-before"]')).toBeAttached()
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
