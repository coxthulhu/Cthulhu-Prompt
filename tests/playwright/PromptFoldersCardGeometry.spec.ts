import type { Page } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  measureEditorCardGeometry,
  measureVirtualRowOverflows
} from '../helpers/CardGeometryHelpers'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_FOLDER_HOST_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { heightTestPrompts } from '../fixtures/TestData'
import {
  PROMPT_EDITOR_CARD_BORDER_WIDTH_PX,
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX
} from '@renderer/features/prompt-editor/promptEditorSizing'
import {
  getPromptFolderEditorCollapsedCardRowHeightPx,
  getPromptFolderEditorRowPaddingTopPx,
  PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX
} from '@renderer/features/prompt-folders/promptFolderSettingsSizing'

const { test, describe, expect } = createPlaywrightTestSuite()

const GEOMETRY_WORKSPACE_PATH = '/ws/card-geometry'
const GEOMETRY_FOLDER_NAME = 'Card Geometry'
const FILL_TOLERANCE_PX = 1
// Folder editor rows round up to a 4px grid, so their cards carry designed slack.
const FOLDER_ROW_HEIGHT_GRID_PX = 4

const buildGeometryWorkspace = () =>
  createWorkspaceWithFolders(GEOMETRY_WORKSPACE_PATH, [
    {
      folderName: GEOMETRY_FOLDER_NAME,
      displayName: GEOMETRY_FOLDER_NAME,
      prompts: [
        { ...heightTestPrompts.singleLine, id: 'geometry-single' },
        { ...heightTestPrompts.tenLine, id: 'geometry-ten' },
        { ...heightTestPrompts.twoHundredLine, id: 'geometry-tall' }
      ]
    }
  ])

const expectPromptCardExactFill = async (mainWindow: Page, promptId: string): Promise<void> => {
  const selector = promptEditorSelector(promptId)

  await expect
    .poll(async () => {
      const geometry = await measureEditorCardGeometry(mainWindow, selector)
      if (!geometry) return Number.POSITIVE_INFINITY
      return Math.max(
        geometry.hiddenOverflowPx,
        geometry.internalScrollTopPx,
        Math.abs(geometry.promptBodyFillGapPx ?? Number.POSITIVE_INFINITY),
        Math.abs(geometry.promptSidebarFillGapPx ?? Number.POSITIVE_INFINITY)
      )
    })
    .toBeLessThanOrEqual(FILL_TOLERANCE_PX)

  const geometry = (await measureEditorCardGeometry(mainWindow, selector))!
  expect(geometry.hiddenOverflowPx, `${promptId} card clips content inside overflow:hidden`).toBe(
    0
  )
  expect(geometry.internalScrollTopPx, `${promptId} card scrolled internally`).toBe(0)
}

const getExpectedCollapsedFolderCardGapPx = (isRoot: boolean): number => {
  const rowPaddingTopPx = getPromptFolderEditorRowPaddingTopPx(isRoot)
  const cardHeightPx =
    getPromptFolderEditorCollapsedCardRowHeightPx(rowPaddingTopPx) - rowPaddingTopPx
  const contentBoxHeightPx = cardHeightPx - PROMPT_EDITOR_CARD_BORDER_WIDTH_PX * 2
  return (
    contentBoxHeightPx -
    (PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX + PROMPT_EDITOR_SEPARATOR_HEIGHT_PX)
  )
}

const PROMPT_TREE_WINDOW_TEST_ID = 'prompt-tree-virtual-window'
const PROMPT_FOLDER_WINDOW_TEST_ID = 'prompt-folder-virtual-window'

const expectNoRowClipsItsContent = async (
  mainWindow: Page,
  windowTestId: string
): Promise<void> => {
  await expect
    .poll(async () => {
      const rows = await measureVirtualRowOverflows(mainWindow, windowTestId)
      if (!rows || rows.length === 0) return 'no rows mounted'
      return rows
        .filter((row) => row.contentSpillPx > FILL_TOLERANCE_PX)
        .map((row) => `${row.rowTestId} spills ${row.contentSpillPx}px (row ${row.wrapperHeightPx}px)`)
    }, { message: `virtual rows in ${windowTestId} must not clip their content` })
    .toEqual([])
}

describe('Prompt folder card geometry', () => {
  test('prompt editor cards exactly fill their pinned row height', async ({ testSetup }) => {
    await testSetup.setupFilesystem(buildGeometryWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(GEOMETRY_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(GEOMETRY_FOLDER_NAME)
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    // Short prompts hydrate near the top of the list.
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    for (const promptId of ['geometry-single', 'geometry-ten']) {
      const selector = promptEditorSelector(promptId)
      await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, selector)
      await waitForMonacoEditor(mainWindow, selector)
      await expectPromptCardExactFill(mainWindow, promptId)
    }

    // The clamped tall prompt sits at the bottom of the list.
    const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(PROMPT_FOLDER_HOST_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, scrollHeight)
    await mainWindow.waitForSelector(promptEditorSelector('geometry-tall'), { state: 'attached' })
    await waitForMonacoEditor(mainWindow, promptEditorSelector('geometry-tall'))
    await expectPromptCardExactFill(mainWindow, 'geometry-tall')
  })

  test('folder editor cards fit their content within the row grid slack', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)

    // Only subfolders render folder-editor cards; the screen root uses a
    // root-header row instead.
    const folderRows = mainWindow.locator('[data-prompt-folder-id]')
    await expect.poll(async () => await folderRows.count()).toBeGreaterThanOrEqual(1)

    const rowCount = await folderRows.count()
    for (let index = 0; index < rowCount; index += 1) {
      const row = folderRows.nth(index)
      const folderId = (await row.getAttribute('data-prompt-folder-id'))!
      const rowSelector = `[data-prompt-folder-id="${folderId}"]`
      await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, rowSelector)

      // Collapsed cards have a deterministic slack from the 4px row grid.
      const expectedGapPx = getExpectedCollapsedFolderCardGapPx(false)
      await expect
        .poll(async () => {
          const geometry = await measureEditorCardGeometry(mainWindow, rowSelector)
          return geometry?.bodyChildrenFillGapPx ?? Number.POSITIVE_INFINITY
        })
        .toBeLessThanOrEqual(expectedGapPx + FILL_TOLERANCE_PX)
      const collapsed = (await measureEditorCardGeometry(mainWindow, rowSelector))!
      expect(
        collapsed.hiddenOverflowPx,
        `collapsed folder card ${folderId} clips content inside overflow:hidden`
      ).toBe(0)
      expect(
        Math.abs(collapsed.bodyChildrenFillGapPx! - expectedGapPx),
        `collapsed folder card ${folderId} slack ${collapsed.bodyChildrenFillGapPx} != expected ${expectedGapPx}`
      ).toBeLessThanOrEqual(FILL_TOLERANCE_PX)

      // Expanded settings sections must still fit inside the bordered card.
      await row.locator('[data-testid="prompt-folder-editor-settings-toggle"]').click()
      await row
        .locator('[data-testid="prompt-folder-settings-section-folderDescription"]')
        .waitFor({ state: 'attached' })
      await expect
        .poll(async () => {
          const geometry = await measureEditorCardGeometry(mainWindow, rowSelector)
          if (!geometry) return Number.POSITIVE_INFINITY
          return Math.max(geometry.hiddenOverflowPx, geometry.internalScrollTopPx)
        })
        .toBe(0)
      const expanded = (await measureEditorCardGeometry(mainWindow, rowSelector))!
      expect(
        expanded.bodyChildrenFillGapPx,
        `expanded folder card ${folderId} content overflows the card`
      ).toBeGreaterThanOrEqual(-FILL_TOLERANCE_PX)
      expect(
        expanded.bodyChildrenFillGapPx,
        `expanded folder card ${folderId} slack exceeds the row grid`
      ).toBeLessThanOrEqual(FOLDER_ROW_HEIGHT_GRID_PX + FILL_TOLERANCE_PX)

      // Restore the collapsed state for the next row's scroll math.
      await row.locator('[data-testid="prompt-folder-editor-settings-toggle"]').click()
    }
  })

  test('no virtual row clips its content in either virtual window', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    // The subfolders screen mounts every folder-screen row kind: root header,
    // dividers, prompt editors, a subfolder editor, and the bottom spacer.
    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('base-before'))

    await expectNoRowClipsItsContent(mainWindow, PROMPT_FOLDER_WINDOW_TEST_ID)
    await expectNoRowClipsItsContent(mainWindow, PROMPT_TREE_WINDOW_TEST_ID)

    // Cover the rows mounted at the far end of the list as well.
    const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(PROMPT_FOLDER_HOST_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, scrollHeight)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('base-after'))
    await expectNoRowClipsItsContent(mainWindow, PROMPT_FOLDER_WINDOW_TEST_ID)
  })
})
