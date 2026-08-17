import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import { readWorkspacePersistence } from '../helpers/UserPersistenceHelpers'
import {
  focusMonacoEditor,
  moveMonacoCursorToEnd,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'
import { PromptStatus } from '../../src/shared/Prompt'

const { test, describe, expect } = createPlaywrightTestSuite()

const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'
const SIDEBAR_FOLDER_ROOT_BUTTON_SELECTOR = '[data-testid="sidebar-folder-root-button"]'
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
const COMPLETED_TREE_WORKSPACE_PATH = '/ws/completed-tree-navigation'
const COMPLETED_TREE_FOLDER_NAME = 'Completed Tree Navigation'
const COMPLETED_TREE_PROMPT_COUNT = 20
const COMPLETED_TREE_TARGET_PROMPT_ID = 'completed-tree-prompt-0'
const SUBFOLDERS_WORKSPACE_PATH = '/ws/subfolders'
const SUBFOLDERS_MAIN_FOLDER_ID = createDeterministicId(`${SUBFOLDERS_WORKSPACE_PATH}:Main`)
const SUBFOLDERS_NESTED_FOLDER_ID = createDeterministicId(
  `${SUBFOLDERS_WORKSPACE_PATH}:Main/Nested`
)
const MAIN_FOLDER_TOGGLE = '[data-testid="prompt-tree-folder-toggle-button-Main"]'
const NESTED_FOLDER_TOGGLE = '[data-testid="prompt-tree-folder-toggle-button-Nested"]'
const NESTED_FOLDER_OPEN_BUTTON = '[data-testid="prompt-tree-folder-open-button-Nested"]'
const NESTED_FOLDER_SETTINGS_MENU_ITEM =
  '[data-testid="prompt-tree-folder-settings-menu-item-Nested"]'
const TOGGLE_ALL_PROMPT_FOLDERS_BUTTON = '[data-testid="toggle-all-prompt-folders-button"]'
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'
const NESTED_FOLDER_EDITOR = `[data-testid="prompt-folder-editor-${SUBFOLDERS_NESTED_FOLDER_ID}"]`
const NESTED_FOLDER_SETTINGS_TOGGLE = `${NESTED_FOLDER_EDITOR} [data-testid="prompt-folder-editor-settings-toggle"]`
const NESTED_FOLDER_TITLE_TOGGLE = `${NESTED_FOLDER_EDITOR} [data-testid="prompt-folder-editor-title-toggle"]`
// Matches the folder-navigation offset requested from the virtual window.
const PROMPT_FOLDER_NAVIGATION_TOP_OFFSET_PX = 80
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
        completedAt: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
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

const expectRowToReachClosestPromptFolderViewportCenter = async (
  mainWindow: any,
  testHelpers: any,
  rowSelector: string
) => {
  await expect
    .poll(async () => {
      const [geometry, scrollTop, scrollHeight, hostHeight] = await Promise.all([
        mainWindow.evaluate(
          ({ hostSelector, targetSelector }) => {
            const host = document.querySelector<HTMLElement>(hostSelector)
            const target = document.querySelector<HTMLElement>(targetSelector)
            if (!host || !target) return null

            const hostRect = host.getBoundingClientRect()
            const targetRect = target.getBoundingClientRect()
            const centerLine = hostRect.top + hostRect.height / 2
            return {
              crossesCenter:
                targetRect.top <= centerLine + 1 && targetRect.bottom >= centerLine - 1,
              isFullyVisible:
                targetRect.top >= hostRect.top - 1 && targetRect.bottom <= hostRect.bottom + 1,
              targetCenter: targetRect.top + targetRect.height / 2,
              centerLine
            }
          },
          { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, targetSelector: rowSelector }
        ),
        testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR),
        testHelpers.getVirtualWindowScrollHeight(PROMPT_FOLDER_HOST_SELECTOR),
        testHelpers.getPromptRowHeight(PROMPT_FOLDER_HOST_SELECTOR)
      ])
      if (!geometry) return false
      if (geometry.crossesCenter) return true

      const maxScrollTop = Math.max(0, scrollHeight - hostHeight)
      const isAtTopBoundary = scrollTop <= 1 && geometry.targetCenter <= geometry.centerLine + 1
      const isAtBottomBoundary =
        scrollTop >= maxScrollTop - 1 && geometry.targetCenter >= geometry.centerLine - 1
      return geometry.isFullyVisible && (isAtTopBoundary || isAtBottomBoundary)
    })
    .toBe(true)
}

// Verifies folder navigation aligns the row below the virtual viewport's top edge.
const expectRowToReachPromptFolderViewportTopOffset = async (
  mainWindow: any,
  rowSelector: string
) => {
  await expect
    .poll(async () => {
      // Measures the rendered folder row from the scrollable viewport edge.
      const topOffsetPx = await mainWindow.evaluate(
        ({ hostSelector, targetSelector }) => {
          const host = document.querySelector<HTMLElement>(hostSelector)
          const target = document.querySelector<HTMLElement>(targetSelector)
          if (!host || !target) return null

          return target.getBoundingClientRect().top - host.getBoundingClientRect().top
        },
        { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, targetSelector: rowSelector }
      )
      return topOffsetPx == null
        ? null
        : Math.abs(topOffsetPx - PROMPT_FOLDER_NAVIGATION_TOP_OFFSET_PX)
    })
    .toBeLessThanOrEqual(1)
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
  test('renders categories and persists prompt tree expansion state', async ({
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
      'toggle-all-prompt-folders-button',
      'sidebar-add-prompt-button',
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
    await expect(mainWindow.locator(MAIN_FOLDER_TOGGLE)).toHaveCount(0)
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')
    ).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-after"]')).toBeVisible()

    const treeOrder = await mainWindow
      .locator(
        [
          '[data-testid="prompt-tree-prompt-base-before"]',
          '[data-testid="prompt-tree-prompt-base-after"]',
          '[data-testid="prompt-tree-folder-toggle-button-Nested"]',
          '[data-testid="prompt-tree-prompt-nested-prompt"]'
        ].join(', ')
      )
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')))
    expect(treeOrder).toEqual([
      'prompt-tree-prompt-base-before',
      'prompt-tree-prompt-base-after',
      'prompt-tree-folder-toggle-button-Nested',
      'prompt-tree-prompt-nested-prompt'
    ])

    const indentation = await mainWindow.evaluate(
      ({ nestedSelector, nestedPromptSelector }) => {
        const basePromptLabel = document
          .querySelector<HTMLElement>('[data-testid="prompt-tree-prompt-base-before"]')
          ?.querySelector<HTMLElement>('.sidebarPromptTreeSettingsLabel')
        const nestedRow = document.querySelector<HTMLElement>(nestedSelector)
        const nestedChevron = nestedRow?.querySelector<HTMLElement>(
          '.sidebarPromptTreeChevronWrap'
        )
        const nestedPromptLabel = document
          .querySelector<HTMLElement>(nestedPromptSelector)
          ?.querySelector<HTMLElement>('.sidebarPromptTreeSettingsLabel')

        if (
          !basePromptLabel ||
          !nestedRow ||
          !nestedChevron ||
          !nestedPromptLabel
        ) {
          return null
        }

        return {
          basePromptLabelLeft: Math.round(basePromptLabel.getBoundingClientRect().left),
          nestedHasGutter: Boolean(nestedRow.querySelector('.sidebarPromptTreeGutter')),
          nestedPromptLabelLeft: Math.round(nestedPromptLabel.getBoundingClientRect().left)
        }
      },
      {
        nestedSelector: NESTED_FOLDER_TOGGLE,
        nestedPromptSelector: '[data-testid="prompt-tree-prompt-nested-prompt"]'
      }
    )
    expect(indentation).not.toBeNull()
    expect(indentation!.nestedHasGutter).toBe(false)
    expect(indentation!.nestedPromptLabelLeft).toBeGreaterThan(indentation!.basePromptLabelLeft + 2)

    await scrollPromptFolderRowAwayFromViewportCenter(
      mainWindow,
      testHelpers,
      '[data-testid="prompt-editor-nested-prompt"]'
    )
    await mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]').click()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')
    ).toHaveAttribute('data-row-state', 'active')
    await expectRowToReachClosestPromptFolderViewportCenter(
      mainWindow,
      testHelpers,
      '[data-testid="prompt-editor-nested-prompt"]'
    )
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Main')
    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistence(electronApp, workspaceId)
        return persisted.selectedScreen === 'prompt-folders'
          ? persisted.selectedScreenData.promptFolderId
          : null
      })
      .toBe(SUBFOLDERS_MAIN_FOLDER_ID)

    await testHelpers.navigateToHomeScreen()
    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          return persisted.promptFolderPromptTreeEntries.find(
            (entry) => entry.promptFolderId === SUBFOLDERS_NESTED_FOLDER_ID
          )?.promptTreeEntryId
        },
        { timeout: 15000 }
      )
      .toBe('nested-prompt')
    await testHelpers.navigateToPromptFolders('Main')
    await expectRowToReachClosestPromptFolderViewportCenter(
      mainWindow,
      testHelpers,
      '[data-testid="prompt-editor-nested-prompt"]'
    )

    await expect(mainWindow.locator(NESTED_FOLDER_SETTINGS_TOGGLE)).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await expect(mainWindow.locator(NESTED_FOLDER_TITLE_TOGGLE)).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await scrollPromptFolderRowAwayFromViewportCenter(mainWindow, testHelpers, NESTED_FOLDER_EDITOR)
    await mainWindow.locator(NESTED_FOLDER_TOGGLE).hover()
    await expect(mainWindow.locator(NESTED_FOLDER_OPEN_BUTTON)).toBeVisible()
    await mainWindow.locator(NESTED_FOLDER_OPEN_BUTTON).click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Main')
    await expectRowToReachPromptFolderViewportTopOffset(mainWindow, NESTED_FOLDER_EDITOR)
    await expect(mainWindow.locator(NESTED_FOLDER_SETTINGS_TOGGLE)).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await expect(mainWindow.locator(NESTED_FOLDER_TITLE_TOGGLE)).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')

    await scrollPromptFolderRowAwayFromViewportCenter(mainWindow, testHelpers, NESTED_FOLDER_EDITOR)
    await mainWindow.locator(NESTED_FOLDER_TOGGLE).hover()
    await expect(
      mainWindow.locator('[data-testid^="prompt-tree-folder-options-button-"]')
    ).toHaveCount(0)
    // Captures an ordinary point inside the row instead of either hover action.
    const nestedFolderToggleBox = await mainWindow.locator(NESTED_FOLDER_TOGGLE).boundingBox()
    expect(nestedFolderToggleBox).not.toBeNull()
    // Anchors the expected popup position to the right-click coordinates and cursor gap.
    const rowContextMenuPoint = {
      x: nestedFolderToggleBox!.x + nestedFolderToggleBox!.width / 2,
      y: nestedFolderToggleBox!.y + nestedFolderToggleBox!.height / 2
    }
    const contextMenuCursorGap = 4
    await mainWindow.mouse.click(rowContextMenuPoint.x, rowContextMenuPoint.y, { button: 'right' })
    await expect(mainWindow.locator(NESTED_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    // Reads the rendered popup geometry to verify cursor-relative placement.
    const rowContextMenuBox = await mainWindow
      .locator(NESTED_FOLDER_SETTINGS_MENU_ITEM)
      .locator('xpath=ancestor::*[@role="menu"]')
      .boundingBox()
    expect(rowContextMenuBox).not.toBeNull()
    expect(
      Math.abs(rowContextMenuBox!.x - rowContextMenuPoint.x - contextMenuCursorGap)
    ).toBeLessThanOrEqual(2)
    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).focus()
    await mainWindow.keyboard.press('Enter')
    await expect(mainWindow.locator(NESTED_FOLDER_SETTINGS_MENU_ITEM)).toHaveCount(0)
    await expect(mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await mainWindow.locator(NESTED_FOLDER_TOGGLE).focus()
    await mainWindow.keyboard.press('Shift+F10')
    await expect(mainWindow.locator(NESTED_FOLDER_SETTINGS_MENU_ITEM)).toHaveCount(0)
    await mainWindow.locator(NESTED_FOLDER_OPEN_BUTTON).click({ button: 'right' })
    await expect(mainWindow.locator(NESTED_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(NESTED_FOLDER_SETTINGS_MENU_ITEM).click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Main')
    await expectRowToReachPromptFolderViewportTopOffset(mainWindow, NESTED_FOLDER_EDITOR)
    await expect(mainWindow.locator(NESTED_FOLDER_SETTINGS_TOGGLE)).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await mainWindow.locator(NESTED_FOLDER_TOGGLE).click()
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')
    ).toHaveCount(0)
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

    await expect(mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON)).toHaveAttribute(
      'aria-label',
      'Expand All Prompt Folders'
    )
    await mainWindow.locator(TOGGLE_ALL_PROMPT_FOLDERS_BUTTON).click()
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')
    ).toBeVisible()
    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const nestedEntry = persisted.promptFolderPromptTreeEntries.find(
            (entry) => entry.promptFolderId === SUBFOLDERS_NESTED_FOLDER_ID
          )
          return nestedEntry?.promptTreeIsExpanded
        },
        { timeout: 15000 }
      )
      .toBe(true)
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

  test('stops tracking a centered prompt after hydration beside collapsed folder settings', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    const promptEditor = promptEditorSelector('nested-prompt')
    const promptTreeRow = mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')
    await expect(mainWindow.locator(NESTED_FOLDER_SETTINGS_TOGGLE)).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await scrollPromptFolderRowAwayFromViewportCenter(mainWindow, testHelpers, promptEditor)
    await promptTreeRow.click()
    await expectRowToReachClosestPromptFolderViewportCenter(
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

  test('centers a completed prompt when clicking its prompt tree row', async ({ testSetup }) => {
    await testSetup.setupFilesystem(buildCompletedTreeWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COMPLETED_TREE_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(COMPLETED_TREE_FOLDER_NAME)
    await mainWindow.locator('[data-testid="prompt-folder-completed-filter"]').click()

    const targetTreeRow = `[data-testid="prompt-tree-prompt-${COMPLETED_TREE_TARGET_PROMPT_ID}"]`
    const targetEditor = promptEditorSelector(COMPLETED_TREE_TARGET_PROMPT_ID)
    await scrollPromptTreeRowIntoView(mainWindow, testHelpers, targetTreeRow)
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await expect(mainWindow.locator(targetEditor)).toHaveCount(0)

    await mainWindow.locator(targetTreeRow).click()

    await expect(mainWindow.locator(targetTreeRow)).toHaveAttribute('data-row-state', 'active')
    await expectRowToReachClosestPromptFolderViewportCenter(
      mainWindow,
      testHelpers,
      targetEditor
    )
  })

  test('keeps selected root folder settings action inert', async ({ testSetup }) => {
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
    await expect(mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM).click()

    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR))
      .toBeGreaterThan(0)
    await expect(mainWindow.locator(SHORT_FOLDER_TOGGLE)).toHaveCount(0)
  })

  test('expands collapsed prompts section when selecting a prompt in the prompt tree', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })

    const promptsToggle = mainWindow.locator(NESTED_FOLDER_TITLE_TOGGLE)
    await promptsToggle.click()
    await expect(promptsToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator(promptEditorSelector('nested-prompt'))).toHaveCount(0)

    await mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]').click()

    await expect(promptsToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator(promptEditorSelector('nested-prompt'))).toBeVisible()
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
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await expect(mainWindow.locator(MAIN_FOLDER_TOGGLE)).toHaveCount(0)
    const basePrompt = mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')
    const nestedFolder = mainWindow.locator(NESTED_FOLDER_TOGGLE)
    const nestedPrompt = mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')
    await expect(basePrompt).toBeVisible()
    await expect(nestedFolder).toBeVisible()
    await expect(nestedPrompt).toBeVisible()

    await expect(basePrompt.locator('[data-indent-guide-line]')).toHaveCount(0)
    await expect(nestedFolder.locator('.sidebarPromptTreeGutter')).toHaveCount(0)
    await expect(nestedPrompt.locator('[data-indent-guide-line]')).toHaveCount(1)

    const folderRowTreatment = await nestedFolder.evaluate((button) => {
      const chevron = button.querySelector<HTMLElement>('.sidebarPromptTreeChevronWrap')
      const folderIcon = button.querySelector<SVGElement>('.sidebarPromptTreeFolderIcon')
      const label = button.querySelector<HTMLElement>('.sidebarPromptTreeFolderLabel')
      if (!chevron || !folderIcon || !label) return null

      const buttonRect = button.getBoundingClientRect()
      const chevronRect = chevron.getBoundingClientRect()
      const folderIconRect = folderIcon.getBoundingClientRect()
      const labelRect = label.getBoundingClientRect()
      const labelStyle = getComputedStyle(label)
      return {
        chevronInsetPx: chevronRect.left - buttonRect.left,
        folderIconOffsetPx: folderIconRect.left - chevronRect.left,
        labelOffsetPx: labelRect.left - folderIconRect.left,
        folderIconWidthPx: folderIconRect.width,
        labelFontSize: labelStyle.fontSize,
        labelFontWeight: labelStyle.fontWeight
      }
    })

    expect(folderRowTreatment).not.toBeNull()
    expect(Math.abs(folderRowTreatment!.chevronInsetPx - 9)).toBeLessThanOrEqual(1)
    expect(Math.abs(folderRowTreatment!.folderIconOffsetPx - 32)).toBeLessThanOrEqual(1)
    expect(Math.abs(folderRowTreatment!.labelOffsetPx - 26)).toBeLessThanOrEqual(1)
    expect(Math.abs(folderRowTreatment!.folderIconWidthPx - 16)).toBeLessThanOrEqual(1)
    expect(folderRowTreatment!.labelFontSize).toBe('14px')
    expect(folderRowTreatment!.labelFontWeight).toBe('400')
  })

  test('uses the folder action space only while folder actions are visible', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    const folderToggle = mainWindow.locator(NESTED_FOLDER_TOGGLE)
    const folderLabel = folderToggle.locator('.sidebarPromptTreeFolderLabel')
    const folderActions = mainWindow.locator(
      '[data-testid="prompt-tree-folder-open-button-Nested"]'
    )
    const readRoundedLabelWidth = async (): Promise<number> =>
      folderLabel.evaluate((label) => Math.round(label.getBoundingClientRect().width))

    await mainWindow.mouse.move(0, 0)
    await expect(folderActions).toBeHidden()
    const restingLabelWidth = await readRoundedLabelWidth()

    await folderToggle.hover()
    await expect(folderActions).toBeVisible()
    const hoveredLabelWidth = await readRoundedLabelWidth()
    const folderToggleBox = await folderToggle.boundingBox()
    const folderActionsBox = await folderActions.boundingBox()

    expect(Math.abs(restingLabelWidth - hoveredLabelWidth - 44)).toBeLessThanOrEqual(1)
    expect(folderToggleBox).not.toBeNull()
    expect(folderActionsBox).not.toBeNull()
    const folderActionsRightInset =
      folderToggleBox!.x +
      folderToggleBox!.width -
      folderActionsBox!.x -
      folderActionsBox!.width
    expect(Math.abs(folderActionsRightInset - 14)).toBeLessThanOrEqual(1)

    await mainWindow.mouse.move(0, 0)
    await expect(folderActions).toBeHidden()
    await expect.poll(readRoundedLabelWidth).toBe(restingLabelWidth)
  })

  test('selects prompt rows and toggles folder rows from the left gutter', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    const promptRow = mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')
    const folderToggle = mainWindow.locator(NESTED_FOLDER_TOGGLE)
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
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')
    ).toHaveCount(0)
    await expect(promptRow).toBeVisible()
  })

  test('does not select prompt tree text when dragging from between rows', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    const firstPrompt = mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')
    const nestedFolder = mainWindow.locator(NESTED_FOLDER_TOGGLE)
    await expect(firstPrompt).toBeVisible()
    await expect(nestedFolder).toBeVisible()

    const firstPromptBox = await firstPrompt.boundingBox()
    const nestedFolderBox = await nestedFolder.boundingBox()
    if (!firstPromptBox || !nestedFolderBox) {
      throw new Error('Missing prompt tree row-gap drag geometry')
    }

    const gapY = (firstPromptBox.y + firstPromptBox.height + nestedFolderBox.y) / 2
    await mainWindow.mouse.move(firstPromptBox.x + firstPromptBox.width / 2, gapY)
    await mainWindow.mouse.down()
    await mainWindow.mouse.move(
      nestedFolderBox.x + nestedFolderBox.width - 24,
      nestedFolderBox.y + nestedFolderBox.height / 2,
      { steps: 4 }
    )
    await mainWindow.mouse.up()

    await expect
      .poll(() => mainWindow.evaluate(() => window.getSelection()?.toString() ?? ''))
      .toBe('')
  })

  test('keeps root prompt rows visible when a descendant folder is collapsed', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'true')
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()

    await mainWindow.locator(NESTED_FOLDER_TOGGLE).click()

    await expect(mainWindow.locator(NESTED_FOLDER_TOGGLE)).toHaveAttribute('aria-expanded', 'false')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-nested-prompt"]')
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
