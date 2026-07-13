import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import type { ElectronApplication, Locator, Page } from 'playwright'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import { checkPersistedPromptFilesExistByTitle } from '../helpers/PromptPersistenceTestHelpers'
import {
  beginPromptHandleDrag,
  beginPromptFolderHandleDrag,
  beginPromptTreeRowDrag,
  beginPromptTreeFolderRowDrag,
  beginPromptTreeRowGutterDrag,
  dragGhostSelector,
  dragPromptHandleToTarget,
  dragPromptTreeRowToTarget,
  expectCurrentFolderPromptEditors,
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
const SUBFOLDERS_WORKSPACE_PATH = '/ws/subfolders'
const DEVELOPMENT_FOLDER_NAME = 'Development'
const EXAMPLES_FOLDER_NAME = 'Examples'
const promptFolderOrderPath = (workspacePath: string, folderName: string): string =>
  `${workspacePath}/Prompts/${folderName}/_FolderInfo/FolderOrder.json`
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
const BASE_BEFORE_ID = 'base-before'
const BASE_AFTER_ID = 'base-after'
const NESTED_FOLDER_ID = createDeterministicId(`${SUBFOLDERS_WORKSPACE_PATH}:Main/Nested`)
const SUBFOLDERS_MAIN_FOLDER_PATH = promptFolderOrderPath(SUBFOLDERS_WORKSPACE_PATH, 'Main')
const SUBFOLDERS_NESTED_FOLDER_PATH = promptFolderOrderPath(
  SUBFOLDERS_WORKSPACE_PATH,
  'Main/Nested'
)
const DRAG_SCROLL_WORKSPACE_PATH = '/ws/drag-scroll-anchor'
const MOVE_FALLBACK_WORKSPACE_PATH = '/ws/drag-fallback-title'
const ANCHORING_FOLDER_NAME = 'Anchoring'
const DESTINATION_FOLDER_NAME = 'Destination'
const FALLBACK_SOURCE_FOLDER_NAME = 'FallbackSource'
const FALLBACK_DESTINATION_FOLDER_NAME = 'FallbackDestination'
const ANCHORING_FOLDER_PATH = promptFolderOrderPath(
  DRAG_SCROLL_WORKSPACE_PATH,
  ANCHORING_FOLDER_NAME
)
const ANCHOR_1_ID = 'anchor-1'
const ANCHOR_2_ID = 'anchor-2'
const ANCHOR_3_ID = 'anchor-3'
const DESTINATION_1_ID = 'destination-1'
const SHORT_FOLDER_NAME = 'Short'
const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'
const SAME_FOLDER_REORDER_SCROLL_TOLERANCE_PX = 32
const FALLBACK_DESTINATION_FOLDER_ID = createDeterministicId(
  `${MOVE_FALLBACK_WORKSPACE_PATH}:${FALLBACK_DESTINATION_FOLDER_NAME}`
)

type PromptDividerHighlightStyles = {
  indicatorBackgroundColor: string
  buttonBorderWidth: string
  separatorBackgroundColors: string[]
}

type PromptDragGhostSnapshot = {
  backgroundColor: string
  color: string
  height: number
  kind: string | null
  opacity: string
  text: string
  width: number
}

const promptDividerSelector = (previousPromptId: string | null): string =>
  previousPromptId
    ? `[data-testid="prompt-divider-add-after-${previousPromptId}"]`
    : '[data-testid="prompt-divider-add-initial"]'

const getRootEntryTreeOrder = async (page: Page): Promise<string[]> => {
  return await page
    .locator(
      [
        `[data-testid="prompt-tree-prompt-${BASE_BEFORE_ID}"]`,
        '[data-testid="prompt-tree-folder-toggle-button-Nested"]',
        `[data-testid="prompt-tree-prompt-${BASE_AFTER_ID}"]`
      ].join(', ')
    )
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid') ?? ''))
}

const getRootEntryScreenOrder = async (page: Page): Promise<string[]> => {
  return await page
    .locator(
      [
        `[data-testid="prompt-editor-${BASE_BEFORE_ID}"]`,
        `[data-testid="prompt-folder-editor-${NESTED_FOLDER_ID}"]`,
        `[data-testid="prompt-editor-${BASE_AFTER_ID}"]`
      ].join(', ')
    )
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid') ?? ''))
}

const expectRootEntryOrder = async (
  page: Page,
  electronApp: ElectronApplication,
  expectedEntryIds: string[]
): Promise<void> => {
  await expect
    .poll(async () => await readPromptFolderEntryIds(electronApp, SUBFOLDERS_MAIN_FOLDER_PATH))
    .toEqual(expectedEntryIds)
  await expect.poll(async () => await getRootEntryScreenOrder(page)).toEqual(
    expectedEntryIds.map((entryId) =>
      entryId === NESTED_FOLDER_ID
        ? `prompt-folder-editor-${entryId}`
        : `prompt-editor-${entryId}`
    )
  )
}

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
      separatorBackgroundColors: separators.map(
        (separator) => getComputedStyle(separator).backgroundColor
      )
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
    const row = element.querySelector<HTMLElement>('.promptDragGhostButton')
    if (!row) {
      throw new Error('Missing prompt drag ghost row')
    }

    const ghostRect = element.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const ghostStyle = getComputedStyle(element)
    const rowStyle = getComputedStyle(row)

    return {
      backgroundColor: rowStyle.backgroundColor,
      color: rowStyle.color,
      height: Math.round(rowRect.height),
      kind: element.getAttribute('data-drag-ghost-kind'),
      opacity: ghostStyle.opacity,
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

const expectPromptEditorNearViewportCenter = async (
  page: Page,
  promptId: string
): Promise<void> => {
  await expect
    .poll(async () => {
      const hostBox = await page.locator(PROMPT_FOLDER_HOST_SELECTOR).boundingBox()
      const offsets = await getRowViewportOffsets(page, promptEditorSelector(promptId))
      if (!hostBox || !offsets) {
        return Number.POSITIVE_INFINITY
      }

      const rowCenter = (offsets.top + offsets.bottom) / 2
      return Math.round(Math.abs(rowCenter - hostBox.height / 2))
    })
    .toBeLessThanOrEqual(2)
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

const buildMoveFallbackWorkspace = () =>
  createWorkspaceWithFolders(MOVE_FALLBACK_WORKSPACE_PATH, [
    {
      folderName: FALLBACK_SOURCE_FOLDER_NAME,
      displayName: FALLBACK_SOURCE_FOLDER_NAME,
      prompts: [
        {
          id: 'move-fallback-source',
          title: '',
          promptText: 'Move me.'
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
        }
      ]
    }
  ])

describe('Prompt folder prompt drag-drop', () => {
  test('increments a fallback title when moving into a folder with a fallback collision', async ({
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

    await waitForMonacoEditor(mainWindow, promptEditorSelector('move-fallback-source'))
    await expectPromptTreeRowActiveState(mainWindow, 'move-fallback-source', true)
    await expect(
      mainWindow.locator(`${promptEditorSelector('move-fallback-source')} ${PROMPT_TITLE_SELECTOR}`)
    ).toHaveAttribute('placeholder', 'New Prompt 1...')

    await expect
      .poll(async () => {
        const [oldFiles, newFiles] = await Promise.all([
          checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: MOVE_FALLBACK_WORKSPACE_PATH,
            folderName: FALLBACK_SOURCE_FOLDER_NAME,
            promptId: 'move-fallback-source',
            promptTitle: 'New Prompt'
          }),
          checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: MOVE_FALLBACK_WORKSPACE_PATH,
            folderName: FALLBACK_DESTINATION_FOLDER_NAME,
            promptId: 'move-fallback-source',
            promptTitle: 'New Prompt 1'
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
    await expect(mainWindow.locator(promptTreePromptDropIndicatorSelector(DEV_1_ID))).toHaveCount(0)
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
    await expect(mainWindow.locator(promptTreePromptDropIndicatorSelector(DEV_1_ID))).toHaveCount(0)
    await finishActiveDrag(mainWindow)

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector(DEV_2_ID), 'top')
    await expect(mainWindow.locator(promptTreePromptDropIndicatorSelector(DEV_2_ID))).toHaveCount(0)
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
    await expect(getPromptDividerRow(mainWindow, null)).toHaveAttribute('data-drop-over', 'false')
    await finishActiveDrag(mainWindow)

    await beginPromptHandleDrag(mainWindow, DEV_2_ID)
    await moveActiveDragToTarget(mainWindow, promptDividerSelector(DEV_1_ID))
    await expect(getPromptDividerRow(mainWindow, DEV_1_ID)).toHaveAttribute(
      'data-drop-over',
      'false'
    )
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

    await dragPromptHandleToTarget(
      mainWindow,
      DEV_1_ID,
      promptTreePromptSelector(DEV_2_ID),
      'bottom'
    )

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID, DEV_1_ID])
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

  test('reorders root prompts before and after a subfolder', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    await testHelpers.navigateToPromptFolders('Main')
    await scrollUntilPromptEditorVisible(mainWindow, testHelpers, BASE_BEFORE_ID)
    await scrollUntilPromptEditorVisible(mainWindow, testHelpers, BASE_AFTER_ID)

    await dragPromptHandleToTarget(
      mainWindow,
      BASE_AFTER_ID,
      promptDividerSelector(BASE_BEFORE_ID)
    )
    await expectRootEntryOrder(mainWindow, electronApp, [
      BASE_BEFORE_ID,
      BASE_AFTER_ID,
      NESTED_FOLDER_ID
    ])

    await dragPromptHandleToTarget(
      mainWindow,
      BASE_BEFORE_ID,
      promptDividerSelector(NESTED_FOLDER_ID)
    )
    await expectRootEntryOrder(mainWindow, electronApp, [
      BASE_AFTER_ID,
      NESTED_FOLDER_ID,
      BASE_BEFORE_ID
    ])

    const moveUp = `${promptEditorSelector(BASE_BEFORE_ID)} [data-testid="prompt-move-up"]`
    const moveDown = `${promptEditorSelector(BASE_BEFORE_ID)} [data-testid="prompt-move-down"]`

    await mainWindow.locator(moveUp).click()
    await expect
      .poll(async () => await readPromptFolderEntryIds(electronApp, SUBFOLDERS_MAIN_FOLDER_PATH))
      .toEqual([BASE_AFTER_ID, NESTED_FOLDER_ID])
    await expectPersistedFolderPromptIds(electronApp, SUBFOLDERS_NESTED_FOLDER_PATH, [
      'nested-prompt',
      BASE_BEFORE_ID
    ])

    await mainWindow.locator(moveDown).click()
    await expect
      .poll(async () => await readPromptFolderEntryIds(electronApp, SUBFOLDERS_MAIN_FOLDER_PATH))
      .toEqual([BASE_AFTER_ID, NESTED_FOLDER_ID, BASE_BEFORE_ID])
    await expectPersistedFolderPromptIds(electronApp, SUBFOLDERS_NESTED_FOLDER_PATH, [
      'nested-prompt'
    ])
    await expect.poll(async () => await getRootEntryTreeOrder(mainWindow)).toEqual([
      `prompt-tree-prompt-${BASE_AFTER_ID}`,
      'prompt-tree-folder-toggle-button-Nested',
      `prompt-tree-prompt-${BASE_BEFORE_ID}`
    ])
  })

  test('drags prompts into and out of a nested subfolder', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    await testHelpers.navigateToPromptFolders('Main')
    await scrollUntilPromptEditorVisible(mainWindow, testHelpers, BASE_BEFORE_ID)
    await dragPromptHandleToTarget(
      mainWindow,
      BASE_BEFORE_ID,
      `[data-testid="prompt-folder-editor-${NESTED_FOLDER_ID}"] [data-testid="prompt-folder-editor-title-toggle"]`
    )
    await expect
      .poll(async () => await readPromptFolderEntryIds(electronApp, SUBFOLDERS_MAIN_FOLDER_PATH))
      .toEqual([NESTED_FOLDER_ID, BASE_AFTER_ID])
    await expectPersistedFolderPromptIds(electronApp, SUBFOLDERS_NESTED_FOLDER_PATH, [
      BASE_BEFORE_ID,
      'nested-prompt'
    ])

    await dragPromptHandleToTarget(
      mainWindow,
      'nested-prompt',
      promptDividerSelector(BASE_AFTER_ID)
    )
    await expect
      .poll(async () => await readPromptFolderEntryIds(electronApp, SUBFOLDERS_MAIN_FOLDER_PATH))
      .toEqual([NESTED_FOLDER_ID, BASE_AFTER_ID, 'nested-prompt'])
    await expectPersistedFolderPromptIds(electronApp, SUBFOLDERS_NESTED_FOLDER_PATH, [
      BASE_BEFORE_ID
    ])
  })

  test('moves nested prompts and subfolders from the prompt tree', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    await testHelpers.navigateToPromptFolders('Main')
    await dragPromptTreeRowToTarget(
      mainWindow,
      'nested-prompt',
      promptTreePromptSelector(BASE_AFTER_ID),
      'bottom'
    )
    await expect
      .poll(async () => await readPromptFolderEntryIds(electronApp, SUBFOLDERS_MAIN_FOLDER_PATH))
      .toEqual([BASE_BEFORE_ID, NESTED_FOLDER_ID, BASE_AFTER_ID, 'nested-prompt'])
    await expectPersistedFolderPromptIds(electronApp, SUBFOLDERS_NESTED_FOLDER_PATH, [])

    await beginPromptTreeFolderRowDrag(mainWindow, 'Nested')
    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector(BASE_AFTER_ID), 'bottom')
    await finishActiveDrag(mainWindow)
    await expect
      .poll(async () => await readPromptFolderEntryIds(electronApp, SUBFOLDERS_MAIN_FOLDER_PATH))
      .toEqual([BASE_BEFORE_ID, BASE_AFTER_ID, NESTED_FOLDER_ID, 'nested-prompt'])
  })

  test('moves a subfolder from its editor grip to a mixed-entry divider', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders' }
    })

    await testHelpers.navigateToPromptFolders('Main')
    await beginPromptFolderHandleDrag(mainWindow, NESTED_FOLDER_ID)
    await moveActiveDragToTarget(mainWindow, promptDividerSelector(BASE_AFTER_ID))
    await finishActiveDrag(mainWindow)

    await expect
      .poll(async () => await readPromptFolderEntryIds(electronApp, SUBFOLDERS_MAIN_FOLDER_PATH))
      .toEqual([BASE_BEFORE_ID, BASE_AFTER_ID, NESTED_FOLDER_ID])
    await expectPersistedFolderPromptIds(electronApp, SUBFOLDERS_NESTED_FOLDER_PATH, [
      'nested-prompt'
    ])
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

    expect(dropStyles.indicatorBackgroundColor).not.toBe(defaultStyles.indicatorBackgroundColor)
    expect(dropStyles.buttonBorderWidth).toBe(defaultStyles.buttonBorderWidth)
    expect(dropStyles.buttonBorderWidth).toBe('0px')
    expect(defaultStyles.separatorBackgroundColors).toHaveLength(1)
    expect(dropStyles.separatorBackgroundColors).toHaveLength(2)
    expect(dropStyles.separatorBackgroundColors[1]).toBe(
      dropStyles.separatorBackgroundColors[0]
    )
    expect(dropStyles.separatorBackgroundColors[0]).not.toBe(
      defaultStyles.separatorBackgroundColors[0]
    )

    await finishActiveDrag(mainWindow)
  })

  test('moves a dragged editor prompt while source folder settings are hydrated', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_2_ID))
    await mainWindow.locator('[data-testid="prompt-folder-editor-settings-toggle"]').click()
    await waitForMonacoEditor(
      mainWindow,
      '[data-testid="prompt-folder-settings-section-folderDescription"]'
    )
    await mainWindow.locator(promptTreePromptSelector(DEV_1_ID)).click()
    await expect(mainWindow.locator(promptTreePromptSelector(DEV_1_ID))).toHaveAttribute(
      'aria-current',
      'true'
    )

    await dragPromptHandleToFolderSelectorItem(mainWindow, DEV_1_ID, EXAMPLES_FOLDER_ID)

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_1_ID, EXAMPLE_1_ID])
    await expectPromptTreeRowActiveState(mainWindow, DEV_1_ID, true)
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

  test('moves a prompt to the start of another folder when dropped onto that folder row', async ({
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

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_1_ID, EXAMPLE_1_ID])
    await expectPromptTreeRowActiveState(mainWindow, DEV_1_ID, true)
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

  test('moves an editor prompt to the start of another folder from the selector dropdown', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(setupWorkspaceScenario(WORKSPACE_PATH, 'sample'))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    await seedWorkspacePersistence(electronApp, {
      workspaceId: WORKSPACE_ID,
      selectedScreen: 'home',
      selectedScreenData: null,
      promptFolderPromptTreeEntries: [
        {
          promptFolderId: EXAMPLES_FOLDER_ID,
          promptTreeEntryId: 'folder-settings',
          folderSettingsSectionIsExpanded: true
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

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_1_ID, EXAMPLE_1_ID])
    await expectPromptTreeRowActiveState(mainWindow, DEV_1_ID, true)
    await expectPromptEditorNearViewportCenter(mainWindow, DEV_1_ID)
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
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()

    const sourceItem = mainWindow.locator(
      promptFolderSelectorDropdownItemSelector(DEVELOPMENT_FOLDER_ID)
    )
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(DEVELOPMENT_FOLDER_ID)
    )
    await expect(sourceItem).toHaveAttribute('data-row-state', 'active')
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
      .toBeLessThanOrEqual(SAME_FOLDER_REORDER_SCROLL_TOLERANCE_PX)
  })

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
      height: 30,
      kind: 'prompt',
      opacity: '1',
      text: 'Code Review'
    })
    expect(treeGhost.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(handleGhost).toEqual(treeGhost)
  })

  test('moves the prompt-tree indicator between the top and bottom edges of a prompt row', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders(SHORT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector('short-1'))

    await beginPromptHandleDrag(mainWindow, 'short-1')

    const promptRow = mainWindow.locator(promptTreePromptSelector('short-3'))
    const indicator = mainWindow.locator(promptTreePromptDropIndicatorSelector('short-3'))

    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector('short-3'), 'top')
    await expect(indicator).toHaveAttribute('data-edge', 'top')

    const promptRowBox = await promptRow.boundingBox()
    const topIndicatorBox = await indicator.boundingBox()
    const promptLabelBox = await promptRow
      .locator('.sidebarPromptTreeSettingsLabel')
      .boundingBox()
    const indicatorArrowBox = await indicator.locator('path').boundingBox()
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
    await expect(indicator).toHaveAttribute('data-edge', 'bottom')

    const bottomIndicatorBox = await indicator.boundingBox()
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

})
