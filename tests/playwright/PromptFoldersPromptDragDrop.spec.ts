import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import type { Locator, Page } from 'playwright'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_FOLDER_HOST_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { checkPersistedPromptFilesExistByTitle } from '../helpers/PromptPersistenceTestHelpers'
import {
  beginPromptHandleDrag,
  beginPromptTreeRowDrag,
  beginPromptTreeRowGutterDrag,
  dragGhostSelector,
  dragPromptHandleToTarget,
  dragPromptTreeRowToTarget,
  expectCurrentFolderPromptEditors,
  expectDragGhostIconBeforeLabel,
  expectPersistedFolderPromptIds,
  expectPromptTreeRowDraggingState,
  expectPromptTreeRowActiveState,
  finishActiveDrag,
  getRowViewportOffsets,
  moveActiveDragToTarget,
  promptFolderSelectorDropdownItemSelector,
  promptFolderSelectorMenuSelector,
  promptFolderSelectorTriggerSelector,
  promptTreePromptDropIndicatorSelector,
  promptTreePromptSelector,
  readPromptFolderEntryIds,
  scrollPromptEditorAcrossViewportTop,
  scrollUntilPromptEditorVisible
} from '../helpers/PromptDragDropHelpers'
import {
  createWorkspaceWithFolders,
  getWorkspaceInfoPath,
  setupWorkspaceScenario
} from '../fixtures/WorkspaceFixtures'
import { heightTestPrompts } from '../fixtures/TestData'
import { seedWorkspacePersistence } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/sample'
const VIRTUAL_WORKSPACE_PATH = '/ws/virtual'
const DEVELOPMENT_FOLDER_NAME = 'Development'
const EXAMPLES_FOLDER_NAME = 'Examples'
const promptFolderOrderPath = (workspacePath: string, folderName: string): string => {
  // FolderOrder belongs only to the selected root's flat Active directory.
  const [rootFolderName] = folderName.split('/')
  return `${workspacePath}/Prompts/${rootFolderName}/Active/_FolderInfo/FolderOrder.json`
}
const DEVELOPMENT_FOLDER_PATH = promptFolderOrderPath(WORKSPACE_PATH, DEVELOPMENT_FOLDER_NAME)
const EXAMPLES_FOLDER_PATH = promptFolderOrderPath(WORKSPACE_PATH, EXAMPLES_FOLDER_NAME)
const createDeterministicId = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}
const WORKSPACE_ID = createDeterministicId(WORKSPACE_PATH)
const DEVELOPMENT_FOLDER_ID = createDeterministicId(`${WORKSPACE_PATH}:${DEVELOPMENT_FOLDER_NAME}`)
const EXAMPLES_FOLDER_ID = createDeterministicId(`${WORKSPACE_PATH}:${EXAMPLES_FOLDER_NAME}`)
const DEV_1_ID = 'dev-1'
const DEV_2_ID = 'dev-2'
const EXAMPLE_1_ID = 'simple-1'
const DRAG_SCROLL_WORKSPACE_PATH = '/ws/drag-scroll-anchor'
const MOVE_FALLBACK_WORKSPACE_PATH = '/ws/drag-fallback-title'
const CATEGORY_SCROLL_WORKSPACE_PATH = '/ws/drag-category-scroll'
const ANCHORING_FOLDER_NAME = 'Anchoring'
const DESTINATION_FOLDER_NAME = 'Destination'
const FALLBACK_SOURCE_FOLDER_NAME = 'FallbackSource'
const FALLBACK_DESTINATION_FOLDER_NAME = 'FallbackDestination'
const CATEGORY_SCROLL_FOLDER_NAME = 'Cross Category'
const CATEGORY_SCROLL_FOLDER_PATH = promptFolderOrderPath(
  CATEGORY_SCROLL_WORKSPACE_PATH,
  CATEGORY_SCROLL_FOLDER_NAME
)
const CATEGORY_SCROLL_CATEGORY_ID = 'drag-category-scroll-destination'
const CATEGORY_SCROLL_SOURCE_ID = 'drag-category-scroll-source'
const CATEGORY_SCROLL_DESTINATION_ID = 'drag-category-scroll-destination-prompt'
const ANCHORING_FOLDER_PATH = promptFolderOrderPath(
  DRAG_SCROLL_WORKSPACE_PATH,
  ANCHORING_FOLDER_NAME
)
const ANCHOR_1_ID = 'anchor-1'
const ANCHOR_2_ID = 'anchor-2'
const ANCHOR_3_ID = 'anchor-3'
const DESTINATION_1_ID = 'destination-1'
const SHORT_FOLDER_NAME = 'Short'
const SHORT_FOLDER_PATH = promptFolderOrderPath(VIRTUAL_WORKSPACE_PATH, SHORT_FOLDER_NAME)
const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'
const PROMPT_MOVE_SCROLL_TOLERANCE_PX = 2
const FALLBACK_DESTINATION_FOLDER_ID = createDeterministicId(
  `${MOVE_FALLBACK_WORKSPACE_PATH}:${FALLBACK_DESTINATION_FOLDER_NAME}`
)

type PromptDividerHighlightStyles = {
  indicatorBackgroundColor: string
  buttonBorderWidth: string
  fontSize: string
  separatorColors: string[]
}

type PromptDragGhostSnapshot = {
  backgroundColor: string
  borderColor: string
  borderRadius: string
  borderStyle: string
  borderWidth: string
  color: string
  ghostMaxWidth: string
  ghostMinWidth: string
  height: number
  isTextClipped: boolean
  kind: string | null
  maxWidth: string
  minWidth: string
  mutedBorderColor: string
  opacity: string
  text: string
  width: number
}

const promptDividerSelector = (previousPromptId: string | null): string =>
  previousPromptId
    ? `[data-testid="prompt-divider-add-after-${previousPromptId}"]`
    : '[data-testid="prompt-divider-add-initial"]'
const getPromptTreeStatusIndicator = (page: Page, promptId: string): Locator =>
  page
    .locator(promptTreePromptSelector(promptId))
    .locator('..')
    .locator('[data-testid="prompt-tree-status-indicator"]')
const promptEditorStatusIndicatorSelector = (promptId: string): string =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-title-status-indicator"]`

const getPromptDividerRow = (page: Page, previousPromptId: string | null): Locator =>
  page
    .locator(promptDividerSelector(previousPromptId))
    .locator('xpath=ancestor::div[contains(@class, "promptDividerRow")]')

const dragPromptHandleToFolderSelectorItem = async (
  mainWindow: Page,
  promptId: string,
  promptFolderId: string
): Promise<void> => {
  await beginPromptHandleDrag(mainWindow, promptId)
  await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
  await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()
  await moveActiveDragToTarget(mainWindow, promptFolderSelectorDropdownItemSelector(promptFolderId))
  await finishActiveDrag(mainWindow)
}

const getPromptDividerHighlightStyles = async (
  locator: Locator
): Promise<PromptDividerHighlightStyles> => {
  return await locator.evaluate((element) => {
    const buttonStyle = getComputedStyle(element)
    const separators = Array.from(
      element
        .closest('.promptDividerContent')
        ?.querySelectorAll<HTMLElement>('.cthulhuUiSeparator') ?? []
    )

    return {
      indicatorBackgroundColor: buttonStyle.backgroundColor,
      buttonBorderWidth: buttonStyle.borderWidth,
      fontSize: buttonStyle.fontSize,
      separatorColors: separators.map((separator) => {
        // Read the border for normal separators and the fill for thick drop indicators.
        const style = getComputedStyle(separator)
        return style.borderTopWidth === '0px' ? style.backgroundColor : style.borderTopColor
      })
    }
  })
}

const scrollUntilPromptDividerVisible = async (
  page: Page,
  testHelpers: { scrollVirtualWindowBy: (selector: string, deltaPx: number) => Promise<void> },
  previousPromptId: string | null
): Promise<void> => {
  const selector = promptDividerSelector(previousPromptId)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await page.locator(selector).count()) > 0) {
      return
    }

    await testHelpers.scrollVirtualWindowBy(PROMPT_FOLDER_HOST_SELECTOR, 300)
  }

  throw new Error(`Prompt divider did not become visible: ${previousPromptId}`)
}

const getPromptDragGhostSnapshot = async (locator: Locator): Promise<PromptDragGhostSnapshot> => {
  return await locator.evaluate((element) => {
    const ghost = element.querySelector<HTMLElement>('.promptDragGhost')
    if (!ghost) {
      throw new Error('Missing prompt drag ghost')
    }
    const row = element.querySelector<HTMLElement>('.promptDragGhostButton')
    if (!row) {
      throw new Error('Missing prompt drag ghost row')
    }

    const ghostRect = element.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const label = row.querySelector<HTMLElement>('.sidebarPromptTreeSettingsLabel')
    if (!label) {
      throw new Error('Missing prompt drag ghost label')
    }
    const overlayStyle = getComputedStyle(element)
    const ghostStyle = getComputedStyle(ghost)
    const rowStyle = getComputedStyle(row)
    const mutedBorderProbe = document.createElement('div')
    mutedBorderProbe.style.borderColor = 'var(--ui-neutral-muted-border)'
    document.body.append(mutedBorderProbe)
    const mutedBorderColor = getComputedStyle(mutedBorderProbe).borderColor
    mutedBorderProbe.remove()

    return {
      backgroundColor: rowStyle.backgroundColor,
      borderColor: rowStyle.borderColor,
      borderRadius: rowStyle.borderRadius,
      borderStyle: rowStyle.borderStyle,
      borderWidth: rowStyle.borderWidth,
      color: rowStyle.color,
      ghostMaxWidth: ghostStyle.maxWidth,
      ghostMinWidth: ghostStyle.minWidth,
      height: Math.round(rowRect.height),
      isTextClipped: label.scrollWidth > label.clientWidth,
      kind: element.getAttribute('data-drag-ghost-kind'),
      maxWidth: rowStyle.maxWidth,
      minWidth: rowStyle.minWidth,
      mutedBorderColor,
      opacity: overlayStyle.opacity,
      text: row.textContent?.trim() ?? '',
      width: Math.round(ghostRect.width)
    }
  })
}

const expectDragGhostNear = async (locator: Locator, x: number, y: number): Promise<void> => {
  await expect
    .poll(async () => {
      const box = await locator.boundingBox()
      return box
        ? {
            x: Math.round(box.x),
            y: Math.round(box.y)
          }
        : null
    })
    .toEqual({
      x: x + 4,
      y: y + 4
    })
}

const expectPromptEditorDraggingState = async (
  page: Page,
  promptId: string,
  isDragging: boolean
): Promise<void> => {
  const editorRow = page.locator(promptEditorSelector(promptId))
  await expect(editorRow).toHaveAttribute('data-dragging', isDragging ? 'true' : 'false')
  await expect(editorRow).toHaveCSS('opacity', isDragging ? '0.72' : '1')
}

const scrollPromptTreeUntilRowUnmounts = async (
  mainWindow: Parameters<typeof beginPromptTreeRowDrag>[0],
  promptId: string
): Promise<void> => {
  const promptTree = mainWindow.locator(PROMPT_TREE_HOST_SELECTOR)
  const promptTreeBox = await promptTree.boundingBox()
  if (!promptTreeBox) {
    throw new Error('Missing prompt tree geometry for wheel-drag test')
  }

  // Keep wheel input over the prompt tree while the left mouse button stays held.
  await mainWindow.mouse.move(
    promptTreeBox.x + promptTreeBox.width / 2,
    promptTreeBox.y + promptTreeBox.height / 2
  )

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if ((await mainWindow.locator(promptTreePromptSelector(promptId)).count()) === 0) {
      return
    }

    await mainWindow.mouse.wheel(0, 900)
  }

  throw new Error(`Dragged prompt row stayed mounted after wheel scrolling: ${promptId}`)
}

const moveActiveDragRightOfPromptFolderSelector = async (page: Page): Promise<void> => {
  const trigger = page.locator(promptFolderSelectorTriggerSelector)
  const triggerBox = await trigger.boundingBox()
  if (!triggerBox) {
    throw new Error('Missing prompt folder selector geometry')
  }

  await page.mouse.move(
    triggerBox.x + triggerBox.width + 420,
    triggerBox.y + triggerBox.height / 2,
    {
      steps: 12
    }
  )
}

const buildDragScrollAnchoringWorkspace = (workspacePath: string) => {
  const tallPrompt = heightTestPrompts.twoHundredLine

  return createWorkspaceWithFolders(workspacePath, [
    {
      folderName: ANCHORING_FOLDER_NAME,
      displayName: ANCHORING_FOLDER_NAME,
      prompts: [
        {
          ...tallPrompt,
          id: ANCHOR_1_ID,
          title: 'Anchor One'
        },
        {
          ...tallPrompt,
          id: ANCHOR_2_ID,
          title: 'Anchor Two'
        },
        {
          ...tallPrompt,
          id: ANCHOR_3_ID,
          title: 'Anchor Three'
        }
      ]
    },
    {
      folderName: DESTINATION_FOLDER_NAME,
      displayName: DESTINATION_FOLDER_NAME,
      prompts: [
        {
          ...heightTestPrompts.singleLine,
          id: DESTINATION_1_ID,
          title: 'Destination One'
        }
      ]
    }
  ])
}

const buildCategoryScrollWorkspace = (): Record<string, string | null> => {
  const rootPrompts = [
    {
      id: CATEGORY_SCROLL_SOURCE_ID,
      title: 'Move Between Categories',
      promptText: 'This prompt starts at the top of the root group.'
    },
    ...Array.from({ length: 18 }, (_, index) => ({
      id: `drag-category-scroll-filler-${index + 1}`,
      title: `Root Prompt ${index + 1}`,
      promptText: 'Keeps the destination category outside both initial viewports.'
    }))
  ]
  const filesystem = createWorkspaceWithFolders(CATEGORY_SCROLL_WORKSPACE_PATH, [
    {
      folderName: CATEGORY_SCROLL_FOLDER_NAME,
      displayName: CATEGORY_SCROLL_FOLDER_NAME,
      prompts: [
        ...rootPrompts,
        {
          id: CATEGORY_SCROLL_DESTINATION_ID,
          title: 'Destination Prompt',
          promptText: 'Existing categorized prompt.',
          category: CATEGORY_SCROLL_CATEGORY_ID
        }
      ]
    }
  ])
  filesystem[
    `${CATEGORY_SCROLL_WORKSPACE_PATH}/Prompts/${CATEGORY_SCROLL_FOLDER_NAME}/Categories/Destination.category.json`
  ] = JSON.stringify(
    {
      id: CATEGORY_SCROLL_CATEGORY_ID,
      displayName: 'Destination',
      description: null
    },
    null,
    2
  )
  return filesystem
}

const buildMoveFallbackWorkspace = () =>
  createWorkspaceWithFolders(MOVE_FALLBACK_WORKSPACE_PATH, [
    {
      folderName: FALLBACK_SOURCE_FOLDER_NAME,
      displayName: FALLBACK_SOURCE_FOLDER_NAME,
      prompts: [
        {
          id: 'move-fallback-source-existing',
          title: '',
          promptText: 'I already use New Prompt in the source folder.'
        },
        {
          id: 'move-fallback-source',
          title: '',
          promptText: 'Move New Prompt 1.'
        }
      ]
    },
    {
      folderName: FALLBACK_DESTINATION_FOLDER_NAME,
      displayName: FALLBACK_DESTINATION_FOLDER_NAME,
      prompts: [
        {
          id: 'move-fallback-destination',
          title: '',
          promptText: 'I already use New Prompt.'
        },
        {
          id: 'move-fallback-destination-1',
          title: '',
          promptText: 'I already use New Prompt 1.'
        }
      ]
    }
  ])

describe('Prompt folder prompt drag-drop', () => {
  test('increments an existing fallback suffix when moving into a folder with a collision', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildMoveFallbackWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(MOVE_FALLBACK_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(FALLBACK_SOURCE_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('move-fallback-source'))

    await dragPromptHandleToFolderSelectorItem(
      mainWindow,
      'move-fallback-source',
      FALLBACK_DESTINATION_FOLDER_ID
    )

    await expect(mainWindow.locator(promptFolderSelectorTriggerSelector)).toContainText(
      FALLBACK_SOURCE_FOLDER_NAME
    )
    await expectCurrentFolderPromptEditors(mainWindow, ['move-fallback-source-existing'])

    await expect
      .poll(async () => {
        const [oldFiles, newFiles] = await Promise.all([
          checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: MOVE_FALLBACK_WORKSPACE_PATH,
            folderName: FALLBACK_SOURCE_FOLDER_NAME,
            promptId: 'move-fallback-source',
            promptTitle: 'New Prompt 1'
          }),
          checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: MOVE_FALLBACK_WORKSPACE_PATH,
            folderName: FALLBACK_DESTINATION_FOLDER_NAME,
            promptId: 'move-fallback-source',
            promptTitle: 'New Prompt 2'
          })
        ])

        return { oldFiles, newFiles }
      })
      .toEqual({
        oldFiles: { markdownExists: false },
        newFiles: { markdownExists: true }
      })
  })

  test('silently ignores dropping a prompt onto itself in the prompt tree', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector(DEV_1_ID))
    /** Gray edge indicator claimed by the blocked self target. */
    const blockedIndicator = mainWindow.locator(promptTreePromptDropIndicatorSelector(DEV_1_ID))
    await expect(blockedIndicator).toHaveCount(1)
    await expect(blockedIndicator).toHaveAttribute('data-blocked', 'true')
    /** Computed blocked stroke and its palette-token reference color. */
    const blockedIndicatorColors = await blockedIndicator.evaluate((indicator) => {
      /** Rendered arrow/line stroke controlled by the blocked target. */
      const stroke = indicator.querySelector('.dragDropIndicatorStroke')
      if (!stroke) throw new Error('Missing blocked prompt-tree indicator stroke')
      /** Temporary element resolving the expected palette token through Chromium. */
      const probe = document.createElement('div')
      probe.style.color = 'var(--ui-muted-icon-glyph)'
      document.body.appendChild(probe)
      /** Resolved blocked-stroke palette color. */
      const expectedColor = getComputedStyle(probe).color
      /** One-pixel canvas used to read the resolved color's alpha channel. */
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      /** Raster context used to convert the CSS color into channel data. */
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Missing canvas context for blocked indicator color')
      context.fillStyle = expectedColor
      context.fillRect(0, 0, 1, 1)
      /** Alpha byte proving the blocked indicator token is fully opaque. */
      const expectedAlpha = context.getImageData(0, 0, 1, 1).data[3]
      probe.remove()
      return { expectedAlpha, expectedColor, strokeColor: getComputedStyle(stroke).stroke }
    })
    expect(blockedIndicatorColors.expectedAlpha).toBe(255)
    expect(blockedIndicatorColors.strokeColor).toBe(blockedIndicatorColors.expectedColor)
    await finishActiveDrag(mainWindow)

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_1_ID, DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_1_ID, DEV_2_ID])
  })

  test('does not select a prompt tree row after dragging and releasing it on itself', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))
    await mainWindow.locator(promptTreePromptSelector(DEV_2_ID)).click()
    await expectPromptTreeRowActiveState(mainWindow, DEV_2_ID, true)

    await beginPromptTreeRowDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector(DEV_1_ID))
    await finishActiveDrag(mainWindow)

    await expectPromptTreeRowActiveState(mainWindow, DEV_1_ID, false)
    await expectPromptTreeRowActiveState(mainWindow, DEV_2_ID, true)
  })

  test('silently ignores dropping a prompt onto adjacent prompt rows without moving it', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await beginPromptHandleDrag(mainWindow, DEV_2_ID)
    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector(DEV_1_ID), 'bottom')
    await expect(
      mainWindow.locator(promptTreePromptDropIndicatorSelector(DEV_1_ID))
    ).toHaveAttribute('data-blocked', 'true')
    await finishActiveDrag(mainWindow)

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector(DEV_2_ID), 'top')
    await expect(
      mainWindow.locator(
        `${promptTreePromptDropIndicatorSelector(DEV_1_ID)}[data-edge="bottom"]`
      )
    ).toHaveAttribute('data-blocked', 'true')
    await finishActiveDrag(mainWindow)

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_1_ID, DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_1_ID, DEV_2_ID])
  })

  test('silently ignores dropping a prompt onto no-op add prompt rows', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptDividerSelector(null))
    /** Initial divider claimed by the blocked no-op placement. */
    const initialDividerRow = getPromptDividerRow(mainWindow, null)
    await expect(initialDividerRow).toHaveAttribute('data-drop-over', 'true')
    await expect(initialDividerRow).toHaveAttribute('data-drop-blocked', 'true')
    await expect(initialDividerRow.locator('.cthulhuUiSeparator')).toHaveCount(1)
    await expect(initialDividerRow.locator('.promptDividerMoveIndicator')).toHaveCount(0)
    await finishActiveDrag(mainWindow)

    await beginPromptHandleDrag(mainWindow, DEV_2_ID)
    await moveActiveDragToTarget(mainWindow, promptDividerSelector(DEV_1_ID))
    /** Adjacent divider claimed by the second blocked no-op placement. */
    const afterFirstPromptDividerRow = getPromptDividerRow(mainWindow, DEV_1_ID)
    await expect(afterFirstPromptDividerRow).toHaveAttribute('data-drop-over', 'true')
    await expect(afterFirstPromptDividerRow).toHaveAttribute('data-drop-blocked', 'true')
    /** Computed blocked separator color and its palette-token reference. */
    const blockedDividerColors = await afterFirstPromptDividerRow.evaluate((dividerRow) => {
      /** Single solid separator in the blocked divider indicator. */
      const separator = dividerRow.querySelector<HTMLElement>('.cthulhuUiSeparator')
      if (!separator) throw new Error('Missing blocked divider separator')
      /** Temporary element resolving the blocked separator token. */
      const borderProbe = document.createElement('div')
      borderProbe.style.backgroundColor = 'var(--ui-muted-icon-glyph)'
      document.body.appendChild(borderProbe)
      /** Resolved actual and expected colors returned to the test process. */
      const colors = {
        expectedSeparator: getComputedStyle(borderProbe).backgroundColor,
        separator: getComputedStyle(separator).backgroundColor
      }
      borderProbe.remove()
      return colors
    })
    await expect(afterFirstPromptDividerRow.locator('.cthulhuUiSeparator')).toHaveCount(1)
    await expect(afterFirstPromptDividerRow.locator('.promptDividerMoveIndicator')).toHaveCount(0)
    /** Blocked divider row geometry used to verify the separator spans the target. */
    const blockedDividerRowBox = await afterFirstPromptDividerRow.boundingBox()
    /** Single blocked separator geometry compared against the full row. */
    const blockedSeparatorBox = await afterFirstPromptDividerRow
      .locator('.cthulhuUiSeparator')
      .boundingBox()
    if (!blockedDividerRowBox || !blockedSeparatorBox) {
      throw new Error('Missing blocked divider width geometry')
    }
    expect(Math.abs(blockedSeparatorBox.x - blockedDividerRowBox.x)).toBeLessThanOrEqual(2)
    expect(
      Math.abs(
        blockedSeparatorBox.x +
          blockedSeparatorBox.width -
          (blockedDividerRowBox.x + blockedDividerRowBox.width)
      )
    ).toBeLessThanOrEqual(2)
    expect(blockedDividerColors.separator).toBe(blockedDividerColors.expectedSeparator)
    await finishActiveDrag(mainWindow)

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_1_ID, DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_1_ID, DEV_2_ID])
  })

  test('moves a prompt after a different prompt when dropped onto that prompt row', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))
    await expect(getPromptTreeStatusIndicator(mainWindow, DEV_1_ID)).toHaveAttribute(
      'data-edited',
      'false'
    )

    await dragPromptHandleToTarget(
      mainWindow,
      DEV_1_ID,
      promptTreePromptSelector(DEV_2_ID),
      'bottom'
    )

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID, DEV_1_ID])
    await expect(getPromptTreeStatusIndicator(mainWindow, DEV_1_ID)).toHaveAttribute(
      'data-edited',
      'true'
    )
    await expect(mainWindow.locator(promptEditorStatusIndicatorSelector(DEV_1_ID))).toHaveAttribute(
      'data-edited',
      'true'
    )
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID, DEV_1_ID])
  })

  test('moves a prompt after an add prompt row in the same folder', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await dragPromptHandleToTarget(mainWindow, DEV_1_ID, promptDividerSelector(DEV_2_ID))

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID, DEV_1_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID, DEV_1_ID])
  })

  test('moves a prompt from the prompt tree after a different prompt in the same folder', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await dragPromptTreeRowToTarget(
      mainWindow,
      DEV_1_ID,
      promptTreePromptSelector(DEV_2_ID),
      'bottom'
    )

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID, DEV_1_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID, DEV_1_ID])
  })

  test('moves a prompt from the prompt tree to the initial add prompt row', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await dragPromptTreeRowToTarget(mainWindow, DEV_2_ID, promptDividerSelector(null))

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID, DEV_1_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID, DEV_1_ID])
  })

  test('marks an add prompt row divider as a drop target while hovering a valid drop', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await scrollUntilPromptEditorVisible(mainWindow, testHelpers, DEV_1_ID)
    await scrollUntilPromptEditorVisible(mainWindow, testHelpers, DEV_2_ID)
    await scrollUntilPromptDividerVisible(mainWindow, testHelpers, DEV_2_ID)

    const dividerButton = mainWindow.locator(promptDividerSelector(DEV_2_ID))
    const defaultStyles = await getPromptDividerHighlightStyles(dividerButton)

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptDividerSelector(DEV_2_ID))

    const dividerRow = getPromptDividerRow(mainWindow, DEV_2_ID)
    await expect(dividerRow).toHaveAttribute('data-drop-over', 'true')
    await expect(dividerButton).toHaveText('Move Here')
    await expect(dividerButton.locator('svg')).toHaveCount(0)
    await expect(dividerRow.locator('.cthulhuUiSeparator')).toHaveCount(2)

    const dividerRowBox = await dividerRow.boundingBox()
    const moveIndicatorBox = await dividerButton.boundingBox()
    expect(dividerRowBox).not.toBeNull()
    expect(moveIndicatorBox).not.toBeNull()
    const dividerCenter = dividerRowBox!.x + dividerRowBox!.width / 2
    const moveIndicatorCenter = moveIndicatorBox!.x + moveIndicatorBox!.width / 2
    expect(Math.abs(dividerCenter - moveIndicatorCenter)).toBeLessThanOrEqual(1)

    const dropStyles = await getPromptDividerHighlightStyles(dividerButton)

    expect(dropStyles.indicatorBackgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(dropStyles.buttonBorderWidth).toBe(defaultStyles.buttonBorderWidth)
    expect(dropStyles.buttonBorderWidth).toBe('0px')
    expect(dropStyles.fontSize).toBe('14px')
    expect(defaultStyles.separatorColors).toHaveLength(2)
    expect(defaultStyles.separatorColors[1]).toBe(defaultStyles.separatorColors[0])
    expect(dropStyles.separatorColors).toHaveLength(2)
    expect(dropStyles.separatorColors[1]).toBe(dropStyles.separatorColors[0])
    expect(dropStyles.separatorColors[0]).not.toBe(defaultStyles.separatorColors[0])

    await finishActiveDrag(mainWindow)
  })

  test('moves a dragged editor prompt without navigating while the root page header is mounted', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toBeVisible()
    await mainWindow.locator(promptTreePromptSelector(DEV_1_ID)).click()
    await expect(mainWindow.locator(promptTreePromptSelector(DEV_1_ID))).toHaveAttribute(
      'aria-current',
      'true'
    )

    await dragPromptHandleToFolderSelectorItem(mainWindow, DEV_1_ID, EXAMPLES_FOLDER_ID)

    await expect(mainWindow.locator(promptFolderSelectorTriggerSelector)).toContainText(
      DEVELOPMENT_FOLDER_NAME
    )
    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID])
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toBeVisible()
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, EXAMPLES_FOLDER_PATH, [
      DEV_1_ID,
      EXAMPLE_1_ID
    ])
    await expect
      .poll(async () => {
        const [oldFiles, newFiles] = await Promise.all([
          checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: WORKSPACE_PATH,
            folderName: DEVELOPMENT_FOLDER_NAME,
            promptId: DEV_1_ID,
            promptTitle: 'Code Review'
          }),
          checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: WORKSPACE_PATH,
            folderName: EXAMPLES_FOLDER_NAME,
            promptId: DEV_1_ID,
            promptTitle: 'Code Review'
          })
        ])

        return { oldFiles, newFiles }
      })
      .toEqual({
        oldFiles: { markdownExists: false },
        newFiles: { markdownExists: true }
      })
  })

  test('moves a prompt to the start of another folder without navigating to it', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await dragPromptHandleToFolderSelectorItem(mainWindow, DEV_1_ID, EXAMPLES_FOLDER_ID)

    await expect(mainWindow.locator(promptFolderSelectorTriggerSelector)).toContainText(
      DEVELOPMENT_FOLDER_NAME
    )
    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, EXAMPLES_FOLDER_PATH, [
      DEV_1_ID,
      EXAMPLE_1_ID
    ])
    await expect
      .poll(async () => {
        const [oldFiles, newFiles] = await Promise.all([
          checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: WORKSPACE_PATH,
            folderName: DEVELOPMENT_FOLDER_NAME,
            promptId: DEV_1_ID,
            promptTitle: 'Code Review'
          }),
          checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: WORKSPACE_PATH,
            folderName: EXAMPLES_FOLDER_NAME,
            promptId: DEV_1_ID,
            promptTitle: 'Code Review'
          })
        ])

        return { oldFiles, newFiles }
      })
      .toEqual({
        oldFiles: { markdownExists: false },
        newFiles: { markdownExists: true }
      })
  })

  test('moves a prompt-tree row into another folder without navigating to it', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await beginPromptTreeRowDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(EXAMPLES_FOLDER_ID)
    )
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(promptFolderSelectorTriggerSelector)).toContainText(
      DEVELOPMENT_FOLDER_NAME
    )
    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, EXAMPLES_FOLDER_PATH, [
      DEV_1_ID,
      EXAMPLE_1_ID
    ])

    await testHelpers.navigateToPromptFolders(EXAMPLES_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await expect(getPromptTreeStatusIndicator(mainWindow, DEV_1_ID)).toHaveAttribute(
      'data-edited',
      'true'
    )
    await expect(mainWindow.locator(promptEditorStatusIndicatorSelector(DEV_1_ID))).toHaveAttribute(
      'data-edited',
      'true'
    )
  })

  test('keeps the current folder open after moving an editor prompt from the selector dropdown', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(setupWorkspaceScenario(WORKSPACE_PATH, 'sample'))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    await seedWorkspacePersistence(electronApp, {
      workspaceId: WORKSPACE_ID,
      selectedScreen: 'home',
      selectedScreenData: null,
      promptFolderViewEntries: [
        {
          contentOwnerId: EXAMPLES_FOLDER_ID,
          selectedEntryId: 'root-header',
          detailsSectionIsExpanded: true
        }
      ]
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await testHelpers.setupWorkspaceViaUI()

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()

    const destinationItem = mainWindow.locator(
      promptFolderSelectorDropdownItemSelector(EXAMPLES_FOLDER_ID)
    )
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(EXAMPLES_FOLDER_ID)
    )
    await expect(destinationItem).toHaveAttribute('data-row-state', 'over')
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(promptFolderSelectorTriggerSelector)).toContainText(
      DEVELOPMENT_FOLDER_NAME
    )
    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID])
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toBeVisible()
    await expect(mainWindow.locator(promptEditorSelector(DEV_1_ID))).toHaveCount(0)
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, EXAMPLES_FOLDER_PATH, [
      DEV_1_ID,
      EXAMPLE_1_ID
    ])
  })

  test('closes the selector dropdown when an active prompt drag moves off to the right', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()

    await moveActiveDragRightOfPromptFolderSelector(mainWindow)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toHaveCount(0)
    await expect(mainWindow.locator('body')).toHaveCSS('cursor', 'grabbing')
    await finishActiveDrag(mainWindow)

    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_1_ID, DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, EXAMPLES_FOLDER_PATH, [EXAMPLE_1_ID])
  })

  test('does not allow dropping a selector prompt drag onto its own folder', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await beginPromptHandleDrag(mainWindow, DEV_2_ID)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()

    const sourceItem = mainWindow.locator(
      promptFolderSelectorDropdownItemSelector(DEVELOPMENT_FOLDER_ID)
    )
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(DEVELOPMENT_FOLDER_ID)
    )
    await expect(sourceItem).toHaveAttribute('data-row-state', 'blocked-over')
    await expect
      .poll(() =>
        sourceItem.evaluate((item) => {
          /** Temporary element resolving the blocked row token. */
          const probe = document.createElement('div')
          probe.style.backgroundColor = 'var(--ui-neutral-emphasis-surface)'
          document.body.appendChild(probe)
          /** Whether the completed transition reached the blocked row color. */
          const matches = getComputedStyle(item).backgroundColor === getComputedStyle(probe).backgroundColor
          probe.remove()
          return matches
        })
      )
      .toBe(true)
    await finishActiveDrag(mainWindow)

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_1_ID, DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_1_ID, DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, EXAMPLES_FOLDER_PATH, [EXAMPLE_1_ID])
  })

  test('keeps scroll position stable when a same-folder drag only reorders rows', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildDragScrollAnchoringWorkspace(DRAG_SCROLL_WORKSPACE_PATH))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(DRAG_SCROLL_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(ANCHORING_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(ANCHOR_1_ID))

    await scrollPromptEditorAcrossViewportTop(mainWindow, testHelpers, ANCHOR_1_ID)

    const scrollTopBefore = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)

    await dragPromptHandleToTarget(
      mainWindow,
      ANCHOR_1_ID,
      promptTreePromptSelector(ANCHOR_2_ID),
      'bottom'
    )

    await expect
      .poll(async () =>
        (await readPromptFolderEntryIds(electronApp, ANCHORING_FOLDER_PATH)).slice(0, 3)
      )
      .toEqual([ANCHOR_2_ID, ANCHOR_1_ID, ANCHOR_3_ID])

    await expect
      .poll(async () =>
        Math.abs(
          (await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)) - scrollTopBefore
        )
      )
      .toBeLessThanOrEqual(PROMPT_MOVE_SCROLL_TOLERANCE_PX)
  })

  for (const dragSource of ['prompt folder screen', 'sidebar'] as const) {
    test(`does not reveal a prompt after moving it between categories from the ${dragSource}`, async ({
      testSetup,
      electronApp
    }) => {
      await testSetup.setupFilesystem(buildCategoryScrollWorkspace())
      await testSetup.setupFileDialog([getWorkspaceInfoPath(CATEGORY_SCROLL_WORKSPACE_PATH)])

      const { mainWindow, testHelpers } = await testSetup.setupAndStart()
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptFolders(CATEGORY_SCROLL_FOLDER_NAME)
      await waitForMonacoEditor(mainWindow, promptEditorSelector(CATEGORY_SCROLL_SOURCE_ID))

      if (dragSource === 'prompt folder screen') {
        await beginPromptHandleDrag(mainWindow, CATEGORY_SCROLL_SOURCE_ID)
      } else {
        await beginPromptTreeRowDrag(mainWindow, CATEGORY_SCROLL_SOURCE_ID)
      }

      await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, 100_000)
      const destinationCategorySelector =
        '[data-testid="prompt-tree-category-toggle-button-Destination"]'
      await expect(mainWindow.locator(destinationCategorySelector)).toBeVisible()
      await moveActiveDragToTarget(mainWindow, destinationCategorySelector, 'bottom')

      const contentScrollTopBefore = await testHelpers.getElementScrollTop(
        PROMPT_FOLDER_HOST_SELECTOR
      )
      const treeTargetOffsetBefore = await getRowViewportOffsets(
        mainWindow,
        destinationCategorySelector
      )
      if (!treeTargetOffsetBefore) {
        throw new Error('Missing destination category viewport offset before drop')
      }
      await finishActiveDrag(mainWindow)

      await expect
        .poll(async () =>
          (await readPromptFolderEntryIds(electronApp, CATEGORY_SCROLL_FOLDER_PATH)).slice(-2)
        )
        .toEqual([CATEGORY_SCROLL_SOURCE_ID, CATEGORY_SCROLL_DESTINATION_ID])
      await expect
        .poll(async () =>
          Math.abs(
            (await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)) -
              contentScrollTopBefore
          )
        )
        .toBeLessThanOrEqual(PROMPT_MOVE_SCROLL_TOLERANCE_PX)
      await expect
        .poll(async () => {
          const offset = await getRowViewportOffsets(mainWindow, destinationCategorySelector)
          return offset ? Math.abs(offset.top - treeTargetOffsetBefore.top) : Number.POSITIVE_INFINITY
        })
        .toBeLessThanOrEqual(PROMPT_MOVE_SCROLL_TOLERANCE_PX)
    })
  }

  test('moves a prompt before a different prompt when dropped on the top half of that prompt row', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))

    await dragPromptHandleToTarget(mainWindow, DEV_2_ID, promptTreePromptSelector(DEV_1_ID), 'top')

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID, DEV_1_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID, DEV_1_ID])
  })

  test('keeps dragging after wheel scrolling unloads the source prompt-tree row', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)

    const sourcePromptId = 'short-1'

    await beginPromptTreeRowDrag(mainWindow, sourcePromptId)
    await scrollPromptTreeUntilRowUnmounts(mainWindow, sourcePromptId)

    await expect(mainWindow.locator(promptTreePromptSelector(sourcePromptId))).toHaveCount(0)
    await expect(mainWindow.locator('body')).toHaveCSS('cursor', 'grabbing')

    await finishActiveDrag(mainWindow)
    await expect(mainWindow.locator('body')).not.toHaveCSS('cursor', 'grabbing')
  })

  test('temporarily marks the dragged prompt row while dragging from the editor handle', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await mainWindow.locator(promptTreePromptSelector(DEV_2_ID)).click()
    await expectPromptTreeRowActiveState(mainWindow, DEV_2_ID, true)

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await expectPromptTreeRowDraggingState(mainWindow, DEV_1_ID, true)
    await expectPromptTreeRowActiveState(mainWindow, DEV_1_ID, false)
    await expectPromptTreeRowActiveState(mainWindow, DEV_2_ID, true)

    await finishActiveDrag(mainWindow)
    await expectPromptTreeRowDraggingState(mainWindow, DEV_1_ID, false)
    await expectPromptTreeRowActiveState(mainWindow, DEV_1_ID, false)
    await expectPromptTreeRowActiveState(mainWindow, DEV_2_ID, true)
  })

  test('temporarily dims the dragged prompt editor row from both drag sources', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await expectPromptEditorDraggingState(mainWindow, DEV_1_ID, false)

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await expectPromptEditorDraggingState(mainWindow, DEV_1_ID, true)
    await finishActiveDrag(mainWindow)
    await expectPromptEditorDraggingState(mainWindow, DEV_1_ID, false)

    await beginPromptTreeRowDrag(mainWindow, DEV_1_ID)
    await expectPromptEditorDraggingState(mainWindow, DEV_1_ID, true)
    await finishActiveDrag(mainWindow)
    await expectPromptEditorDraggingState(mainWindow, DEV_1_ID, false)
  })

  test('starts prompt-tree dragging from the prompt row gutter', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))

    await beginPromptTreeRowGutterDrag(mainWindow, DEV_1_ID)
    await expectPromptTreeRowDraggingState(mainWindow, DEV_1_ID, true)
    await expect(mainWindow.locator(dragGhostSelector)).toBeVisible()

    await finishActiveDrag(mainWindow)
    await expectPromptTreeRowDraggingState(mainWindow, DEV_1_ID, false)
  })

  test('shows the same prompt row ghost from both prompt drag handles', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await mainWindow.locator(promptTreePromptSelector(DEV_2_ID)).click()

    const dragGhost = mainWindow.locator(dragGhostSelector)

    await beginPromptTreeRowDrag(mainWindow, DEV_1_ID)
    await expect(dragGhost).toBeVisible()
    await expect(dragGhost.locator('[data-testid="drag-ghost-icon"]')).toHaveClass(
      /lucide-file-text/
    )
    await expectDragGhostIconBeforeLabel(dragGhost)
    const treeGhost = await getPromptDragGhostSnapshot(dragGhost)
    await mainWindow.mouse.move(320, 320, { steps: 2 })
    await expectDragGhostNear(dragGhost, 320, 320)
    await finishActiveDrag(mainWindow)
    await expect(dragGhost).toHaveCount(0)

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await expect(dragGhost).toBeVisible()
    const handleGhost = await getPromptDragGhostSnapshot(dragGhost)
    await mainWindow.mouse.move(360, 360, { steps: 2 })
    await expectDragGhostNear(dragGhost, 360, 360)
    await finishActiveDrag(mainWindow)
    await expect(dragGhost).toHaveCount(0)

    expect(treeGhost).toMatchObject({
      borderRadius: '6px',
      borderStyle: 'solid',
      borderWidth: '1px',
      ghostMaxWidth: '400px',
      ghostMinWidth: '120px',
      height: 30,
      isTextClipped: false,
      kind: 'prompt',
      maxWidth: '400px',
      minWidth: '120px',
      opacity: '1',
      text: 'Code Review'
    })
    expect(treeGhost.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(treeGhost.borderColor).toBe(treeGhost.mutedBorderColor)
    expect(treeGhost.width).toBeLessThanOrEqual(400)
    expect(handleGhost).toEqual(treeGhost)
  })

  test('skips a clipped prompt edge and snaps to the nearest visible edge', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await beginPromptTreeRowDrag(mainWindow, 'short-3')
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, 8)

    const clippedRow = mainWindow.locator(promptTreePromptSelector('short-1'))
    await expect
      .poll(async () => {
        const clippedPx = await clippedRow.evaluate((row) => {
          const viewport = row.closest<HTMLElement>('[data-virtual-window-viewport]')
          return viewport
            ? Math.round(viewport.getBoundingClientRect().top - row.getBoundingClientRect().top)
            : null
        })
        return clippedPx === null ? null : Math.abs(clippedPx - 8)
      })
      .toBeLessThanOrEqual(1)

    const viewportBox = await mainWindow.locator(PROMPT_TREE_HOST_SELECTOR).boundingBox()
    if (!viewportBox) {
      throw new Error('Missing prompt tree viewport geometry for clipped-edge drag')
    }

    await mainWindow.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + 1, {
      steps: 12
    })

    const indicator = mainWindow.locator(
      `${promptTreePromptDropIndicatorSelector('short-1')}[data-edge="bottom"]`
    )
    await expect(indicator).toHaveCount(1)
    await expect(indicator).toBeVisible()
    await expect(mainWindow.locator('[data-drop-indicator-active="true"]')).toHaveCount(1)

    const clippedRowBox = await clippedRow.boundingBox()
    const indicatorBox = await indicator.boundingBox()
    if (!clippedRowBox || !indicatorBox) {
      throw new Error('Missing prompt tree geometry for visible-edge assertion')
    }
    expect(
      Math.abs(
        indicatorBox.y + indicatorBox.height / 2 - (clippedRowBox.y + clippedRowBox.height)
      )
    ).toBeLessThanOrEqual(2)

    await finishActiveDrag(mainWindow)
    await expect
      .poll(async () => (await readPromptFolderEntryIds(electronApp, SHORT_FOLDER_PATH)).slice(0, 3))
      .toEqual(['short-1', 'short-3', 'short-2'])
  })

  test('snaps within the default dimensions above the prompt tree', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await beginPromptTreeRowDrag(mainWindow, 'short-3')
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, 32)

    const viewport = mainWindow.locator(PROMPT_TREE_HOST_SELECTOR)
    const topRow = mainWindow.locator(promptTreePromptSelector('short-2'))
    await expect
      .poll(async () => {
        const viewportBox = await viewport.boundingBox()
        const topRowBox = await topRow.boundingBox()
        return viewportBox && topRowBox ? Math.abs(topRowBox.y - viewportBox.y) : null
      })
      .toBeLessThanOrEqual(1)

    const viewportBox = await viewport.boundingBox()
    if (!viewportBox) {
      throw new Error('Missing prompt tree viewport geometry for snap-zone drag')
    }

    /** Positive page-space distance that remains inside the default 100px vertical zone. */
    const snapDistancePx = Math.min(50, Math.floor(viewportBox.y) - 1)
    await mainWindow.mouse.move(
      viewportBox.x + viewportBox.width / 2,
      viewportBox.y - snapDistancePx,
      {
      steps: 12
      }
    )

    const indicator = mainWindow.locator(
      `${promptTreePromptDropIndicatorSelector('short-1')}[data-edge="bottom"]`
    )
    await expect(indicator).toHaveCount(1)
    await expect(indicator).toBeVisible()

    await mainWindow.mouse.move(
      viewportBox.x + viewportBox.width + 1,
      viewportBox.y - snapDistancePx,
      { steps: 12 }
    )
    await expect(
      mainWindow.locator('[data-testid^="prompt-tree-drop-indicator-"]')
    ).toHaveCount(0)

    await mainWindow.mouse.move(
      viewportBox.x + viewportBox.width / 2,
      viewportBox.y - snapDistancePx,
      { steps: 12 }
    )
    await expect(indicator).toHaveCount(1)

    await finishActiveDrag(mainWindow)
    await expect
      .poll(async () => (await readPromptFolderEntryIds(electronApp, SHORT_FOLDER_PATH)).slice(0, 3))
      .toEqual(['short-1', 'short-3', 'short-2'])
  })

  test('uses the preceding prompt target at a row top and its own target at the bottom', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('short-1'))

    await beginPromptHandleDrag(mainWindow, 'short-1')

    const promptRow = mainWindow.locator(promptTreePromptSelector('short-3'))
    /** Single preceding-row target representing the boundary above the tested row. */
    const topIndicator = mainWindow.locator(
      `${promptTreePromptDropIndicatorSelector('short-2')}[data-edge="bottom"]`
    )
    /** Bottom-edge indicator owned unambiguously by the tested row. */
    const bottomIndicator = mainWindow.locator(
      `${promptTreePromptDropIndicatorSelector('short-3')}[data-edge="bottom"]`
    )

    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector('short-3'), 'top')
    await expect(topIndicator).toHaveCount(1)

    const promptRowBox = await promptRow.boundingBox()
    const topIndicatorBox = await topIndicator.boundingBox()
    const promptLabelBox = await promptRow.locator('.sidebarPromptTreeSettingsLabel').boundingBox()
    const indicatorArrowBox = await topIndicator.locator('path').boundingBox()
    if (!promptRowBox || !topIndicatorBox || !promptLabelBox || !indicatorArrowBox) {
      throw new Error('Missing geometry for top-edge indicator assertion')
    }

    expect(
      Math.abs(indicatorArrowBox.x + indicatorArrowBox.width - promptLabelBox.x)
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(topIndicatorBox.y + topIndicatorBox.height / 2 - promptRowBox.y)
    ).toBeLessThanOrEqual(2)

    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector('short-3'), 'bottom')
    await expect(bottomIndicator).toHaveCount(1)

    const bottomIndicatorBox = await bottomIndicator.boundingBox()
    if (!bottomIndicatorBox) {
      throw new Error('Missing geometry for bottom-edge indicator assertion')
    }

    expect(
      Math.abs(
        bottomIndicatorBox.y +
          bottomIndicatorBox.height / 2 -
          (promptRowBox.y + promptRowBox.height)
      )
    ).toBeLessThanOrEqual(2)

    await finishActiveDrag(mainWindow)
  })

  test('registers one prompt target at each boundary between prompt rows', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await beginPromptTreeRowDrag(mainWindow, 'short-1')

    /** Preceding row that exclusively owns the shared prompt boundary. */
    const earlierRow = mainWindow.locator(promptTreePromptSelector('short-2'))
    /** Preceding row geometry used to address the exact shared boundary. */
    const earlierRowBox = await earlierRow.boundingBox()
    if (!earlierRowBox) throw new Error('Missing earlier prompt row geometry for tie assertion')

    await mainWindow.mouse.move(
      earlierRowBox.x + earlierRowBox.width / 2,
      earlierRowBox.y + earlierRowBox.height,
      { steps: 12 }
    )

    await expect(
      mainWindow.locator(
        `${promptTreePromptDropIndicatorSelector('short-2')}[data-edge="bottom"]`
      )
    ).toHaveCount(1)
    await expect(
      mainWindow.locator(`${promptTreePromptDropIndicatorSelector('short-3')}[data-edge="top"]`)
    ).toHaveCount(0)

    await finishActiveDrag(mainWindow)
  })
})
