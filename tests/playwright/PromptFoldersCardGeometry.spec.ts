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

const { test, describe, expect } = createPlaywrightTestSuite()

const GEOMETRY_WORKSPACE_PATH = '/ws/card-geometry'
const GEOMETRY_FOLDER_NAME = 'Card Geometry'
const FILL_TOLERANCE_PX = 1

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
  expect(geometry.hiddenOverflowPx, `${promptId} card clips content inside overflow:hidden`).toBe(0)
  expect(geometry.internalScrollTopPx, `${promptId} card scrolled internally`).toBe(0)

  const titleGeometry = await mainWindow.locator(`${selector} .prompt-editor-title-area`).evaluate(
    (titleArea) => {
      const areaRect = titleArea.getBoundingClientRect()
      const titleMain = titleArea.querySelector<HTMLElement>('.prompt-editor-title-main')!
      const titleCopy = titleArea.querySelector<HTMLElement>('.prompt-editor-title-copy')!
      const mainRect = titleMain.getBoundingClientRect()
      const copyRect = titleCopy.getBoundingClientRect()
      return {
        mainTopInsetPx: mainRect.top - areaRect.top,
        mainBottomInsetPx: areaRect.bottom - mainRect.bottom,
        copyTopInsetPx: copyRect.top - areaRect.top,
        copyBottomInsetPx: areaRect.bottom - copyRect.bottom
      }
    }
  )
  expect(titleGeometry.mainTopInsetPx, `${promptId} title overruns its area at the top`).toBe(0)
  expect(titleGeometry.mainBottomInsetPx, `${promptId} title overruns its area at the bottom`).toBe(
    0
  )
  expect(
    Math.abs(titleGeometry.copyTopInsetPx - titleGeometry.copyBottomInsetPx),
    `${promptId} title content is not vertically centered`
  ).toBeLessThanOrEqual(FILL_TOLERANCE_PX)
}

const PROMPT_TREE_WINDOW_TEST_ID = 'prompt-tree-virtual-window'
const PROMPT_FOLDER_WINDOW_TEST_ID = 'prompt-folder-virtual-window'

const expectNoRowClipsItsContent = async (
  mainWindow: Page,
  windowTestId: string
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const rows = await measureVirtualRowOverflows(mainWindow, windowTestId)
        if (!rows || rows.length === 0) return 'no rows mounted'
        return rows
          .filter((row) => row.contentSpillPx > FILL_TOLERANCE_PX)
          .map(
            (row) =>
              `${row.rowTestId} spills ${row.contentSpillPx}px (row ${row.wrapperHeightPx}px)`
          )
      },
      { message: `virtual rows in ${windowTestId} must not clip their content` }
    )
    .toEqual([])
}

describe('Prompt folder card geometry', () => {
  test('moves prompt actions below the title when the card narrows', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const selector = promptEditorSelector('dev-1')
    const titleRow = mainWindow.locator(`${selector} .prompt-editor-title-row`)

    const setTitleRowWidth = async (targetWidthPx: number) => {
      const currentWidthPx = await titleRow.evaluate((row) => row.getBoundingClientRect().width)
      await electronApp.evaluate(
        ({ BrowserWindow }, widthDeltaPx) => {
          const window = BrowserWindow.getAllWindows()[0]
          if (!window) throw new Error('Missing main window')
          const bounds = window.getBounds()
          window.setSize(bounds.width + widthDeltaPx, bounds.height)
        },
        Math.round(targetWidthPx - currentWidthPx)
      )
      await expect
        .poll(async () => await titleRow.evaluate((row) => row.getBoundingClientRect().width))
        .toBe(targetWidthPx)
    }

    await setTitleRowWidth(600)
    await expect(titleRow).toHaveAttribute('data-layout', 'default')
    await setTitleRowWidth(599)
    await expect(titleRow).toHaveAttribute('data-layout', 'compact')
    await waitForMonacoEditor(mainWindow, selector)

    const layout = await titleRow.evaluate((row) => {
      const rowRect = row.getBoundingClientRect()
      const mainRect = row
        .querySelector<HTMLElement>('.prompt-editor-title-main')!
        .getBoundingClientRect()
      const actions = row.querySelector<HTMLElement>('.prompt-editor-title-actions')!
      const actionsRect = actions.getBoundingClientRect()
      const buttonBarRect = row
        .querySelector<HTMLElement>('.prompt-editor-title-button-bar')!
        .getBoundingClientRect()
      const statusRect = row
        .querySelector<HTMLElement>('.prompt-editor-status-segmented-control')!
        .getBoundingClientRect()
      const verticalSeparator = row.querySelector<HTMLElement>(
        '.prompt-editor-title-actions-separator'
      )!
      const actionsStyle = getComputedStyle(actions)

      return {
        widthPx: rowRect.width,
        actionRowOffsetPx: actionsRect.top - mainRect.bottom,
        buttonLeftInsetPx: buttonBarRect.left - actionsRect.left,
        statusRightInsetPx: actionsRect.right - statusRect.right,
        horizontalSeparatorWidthPx: parseFloat(actionsStyle.borderTopWidth),
        horizontalSeparatorColor: actionsStyle.borderTopColor,
        verticalSeparatorDisplay: getComputedStyle(verticalSeparator).display
      }
    })

    expect(layout.widthPx).toBeLessThan(600)
    expect(Math.abs(layout.actionRowOffsetPx)).toBeLessThanOrEqual(FILL_TOLERANCE_PX)
    expect(Math.abs(layout.buttonLeftInsetPx - 16)).toBeLessThanOrEqual(FILL_TOLERANCE_PX)
    expect(Math.abs(layout.statusRightInsetPx - 16)).toBeLessThanOrEqual(FILL_TOLERANCE_PX)
    expect(layout.horizontalSeparatorWidthPx).toBe(1)
    expect(layout.horizontalSeparatorColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(layout.verticalSeparatorDisplay).toBe('none')

    await expect
      .poll(async () => {
        const geometry = await measureEditorCardGeometry(mainWindow, selector)
        if (!geometry) return Number.POSITIVE_INFINITY
        return Math.max(
          geometry.hiddenOverflowPx,
          Math.abs(geometry.promptBodyFillGapPx ?? Number.POSITIVE_INFINITY),
          Math.abs(geometry.promptSidebarFillGapPx ?? Number.POSITIVE_INFINITY)
        )
      })
      .toBeLessThanOrEqual(FILL_TOLERANCE_PX)
  })

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

  test('folder editor cards fit collapsed titles exactly and expanded settings within grid slack', async ({
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

      await expect
        .poll(async () => {
          const geometry = await measureEditorCardGeometry(mainWindow, rowSelector)
          return Math.abs(geometry?.bodyChildrenFillGapPx ?? Number.POSITIVE_INFINITY)
        })
        .toBeLessThanOrEqual(FILL_TOLERANCE_PX)
      const collapsed = (await measureEditorCardGeometry(mainWindow, rowSelector))!
      expect(
        collapsed.hiddenOverflowPx,
        `collapsed folder card ${folderId} clips content inside overflow:hidden`
      ).toBe(0)
      expect(
        Math.abs(collapsed.bodyChildrenFillGapPx!),
        `collapsed folder card ${folderId} has ${collapsed.bodyChildrenFillGapPx}px of internal slack`
      ).toBeLessThanOrEqual(FILL_TOLERANCE_PX)

      const titleGeometry = await row
        .locator('[data-testid="prompt-folder-editor-title-bar"]')
        .evaluate((titleBar) => {
          const titleBarRect = titleBar.getBoundingClientRect()
          const titleMain = titleBar.querySelector<HTMLElement>('.prompt-folder-editor-title-main')!
          const titleMainRect = titleMain.getBoundingClientRect()
          return {
            topInsetPx: titleMainRect.top - titleBarRect.top,
            bottomInsetPx: titleBarRect.bottom - titleMainRect.bottom
          }
        })
      expect(titleGeometry.topInsetPx, `folder ${folderId} title top spacing`).toBe(8)
      expect(titleGeometry.bottomInsetPx, `folder ${folderId} title bottom spacing`).toBe(8)

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
        `expanded folder card ${folderId} has extra bottom slack`
      ).toBeLessThanOrEqual(FILL_TOLERANCE_PX)

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
