import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_FOLDER_HOST_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { checkPersistedPromptFilesExistByTitle } from '../helpers/PromptPersistenceTestHelpers'
import {
  beginPromptHandleDrag,
  beginPromptTreeRowDrag,
  dragPromptHandleToTarget,
  dragPromptTreeRowToTarget,
  expectCurrentFolderPromptEditors,
  expectPersistedFolderPromptIds,
  expectPromptTreeRowActiveState,
  finishActiveDrag,
  getRowViewportOffsets,
  moveActiveDragToTarget,
  promptTreeFolderSelector,
  promptTreeFolderSettingsDropIndicatorSelector,
  promptTreeFolderSettingsSelector,
  promptTreePromptDropIndicatorSelector,
  promptTreePromptSelector,
  readPromptFolderPromptIds,
  scrollPromptEditorAcrossViewportTop,
  scrollUntilPromptEditorVisible
} from '../helpers/PromptDragDropHelpers'
import { createWorkspaceWithFolders } from '../fixtures/WorkspaceFixtures'
import { heightTestPrompts } from '../fixtures/TestData'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/sample'
const DEVELOPMENT_FOLDER_NAME = 'Development'
const EXAMPLES_FOLDER_NAME = 'Examples'
const DEVELOPMENT_FOLDER_PATH = `${WORKSPACE_PATH}/Prompts/${DEVELOPMENT_FOLDER_NAME}/FolderData.json`
const EXAMPLES_FOLDER_PATH = `${WORKSPACE_PATH}/Prompts/${EXAMPLES_FOLDER_NAME}/FolderData.json`
const DEV_1_ID = 'dev-1'
const DEV_2_ID = 'dev-2'
const EXAMPLE_1_ID = 'simple-1'
const DRAG_SCROLL_WORKSPACE_PATH = '/ws/drag-scroll-anchor'
const ANCHORING_FOLDER_NAME = 'Anchoring'
const DESTINATION_FOLDER_NAME = 'Destination'
const ANCHORING_FOLDER_PATH = `${DRAG_SCROLL_WORKSPACE_PATH}/Prompts/${ANCHORING_FOLDER_NAME}/FolderData.json`
const DESTINATION_FOLDER_PATH = `${DRAG_SCROLL_WORKSPACE_PATH}/Prompts/${DESTINATION_FOLDER_NAME}/FolderData.json`
const ANCHOR_1_ID = 'anchor-1'
const ANCHOR_2_ID = 'anchor-2'
const ANCHOR_3_ID = 'anchor-3'
const DESTINATION_1_ID = 'destination-1'
const SHORT_FOLDER_NAME = 'Short'
const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'

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

describe('Prompt folder prompt drag-drop', () => {
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

    await dragPromptHandleToTarget(mainWindow, DEV_1_ID, promptTreePromptSelector(DEV_1_ID))

    await expectCurrentFolderPromptEditors(mainWindow, [DEV_1_ID, DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_1_ID, DEV_2_ID])
  })

  test('silently ignores dropping a prompt onto the row above when it is already after it', async ({
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
      DEV_2_ID,
      promptTreePromptSelector(DEV_1_ID),
      'bottom'
    )

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
    await mainWindow.locator(promptTreePromptSelector(DEV_1_ID)).click()
    await expect(mainWindow.locator(promptTreePromptSelector(DEV_1_ID))).toHaveAttribute(
      'aria-current',
      'true'
    )

    await dragPromptHandleToTarget(
      mainWindow,
      DEV_1_ID,
      promptTreeFolderSelector(EXAMPLES_FOLDER_NAME)
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

  test('moves a prompt to the start of another folder when dropped onto that folder settings row', async ({
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
      promptTreeFolderSettingsSelector(EXAMPLES_FOLDER_NAME)
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

  test('moves a prompt between folders after the prompt row it is dropped onto', async ({
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
      promptTreePromptSelector(EXAMPLE_1_ID),
      'bottom'
    )

    await expect(mainWindow.locator(PROMPT_FOLDER_HOST_SELECTOR)).toBeVisible()
    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, EXAMPLES_FOLDER_PATH, [
      EXAMPLE_1_ID,
      DEV_1_ID
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

  test('keeps scroll position stable when a same-folder drag only reorders rows', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildDragScrollAnchoringWorkspace(DRAG_SCROLL_WORKSPACE_PATH))
    await testSetup.setupFileDialog([DRAG_SCROLL_WORKSPACE_PATH])

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
        (await readPromptFolderPromptIds(electronApp, ANCHORING_FOLDER_PATH)).slice(0, 3)
      )
      .toEqual([ANCHOR_2_ID, ANCHOR_1_ID, ANCHOR_3_ID])

    await expect
      .poll(async () =>
        Math.abs(
          (await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)) - scrollTopBefore
        )
      )
      .toBeLessThanOrEqual(2)
  })

  test('keeps the current screen selected when reordering prompts from a non-selected tree folder', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildDragScrollAnchoringWorkspace(DRAG_SCROLL_WORKSPACE_PATH))
    await testSetup.setupFileDialog([DRAG_SCROLL_WORKSPACE_PATH])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(DESTINATION_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DESTINATION_1_ID))
    await mainWindow.locator(promptTreePromptSelector(DESTINATION_1_ID)).click()
    await expectPromptTreeRowActiveState(mainWindow, DESTINATION_1_ID, true)

    await beginPromptTreeRowDrag(mainWindow, ANCHOR_1_ID)
    await expectPromptTreeRowActiveState(mainWindow, ANCHOR_1_ID, true)
    await expectPromptTreeRowActiveState(mainWindow, DESTINATION_1_ID, false)
    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector(ANCHOR_2_ID), 'bottom')
    await finishActiveDrag(mainWindow)
    await expectPromptTreeRowActiveState(mainWindow, ANCHOR_1_ID, false)
    await expectPromptTreeRowActiveState(mainWindow, DESTINATION_1_ID, true)

    await expectCurrentFolderPromptEditors(mainWindow, [DESTINATION_1_ID])
    await expectPersistedFolderPromptIds(electronApp, ANCHORING_FOLDER_PATH, [
      ANCHOR_2_ID,
      ANCHOR_1_ID,
      ANCHOR_3_ID
    ])
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

  test('moves a prompt between folders before the prompt row it is dropped onto', async ({
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
      promptTreePromptSelector(EXAMPLE_1_ID),
      'top'
    )

    await expect(mainWindow.locator(PROMPT_FOLDER_HOST_SELECTOR)).toBeVisible()
    await expectCurrentFolderPromptEditors(mainWindow, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, DEVELOPMENT_FOLDER_PATH, [DEV_2_ID])
    await expectPersistedFolderPromptIds(electronApp, EXAMPLES_FOLDER_PATH, [
      DEV_1_ID,
      EXAMPLE_1_ID
    ])
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
    await expect(mainWindow.locator('[data-testid="drag-drop-overlay"]')).toBeVisible()

    await finishActiveDrag(mainWindow)
    await expect(mainWindow.locator('[data-testid="drag-drop-overlay"]')).toHaveCount(0)
  })

  test('temporarily highlights the dragged prompt row while dragging from the editor handle', async ({
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
    await expectPromptTreeRowActiveState(mainWindow, DEV_1_ID, true)
    await expectPromptTreeRowActiveState(mainWindow, DEV_2_ID, false)

    await finishActiveDrag(mainWindow)
    await expectPromptTreeRowActiveState(mainWindow, DEV_1_ID, false)
    await expectPromptTreeRowActiveState(mainWindow, DEV_2_ID, true)
  })

  test('moves the prompt-tree indicator between the top and bottom edges of a prompt row', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)

    const promptRow = mainWindow.locator(promptTreePromptSelector(EXAMPLE_1_ID))
    const indicator = mainWindow.locator(promptTreePromptDropIndicatorSelector(EXAMPLE_1_ID))

    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector(EXAMPLE_1_ID), 'top')
    await expect(indicator).toHaveAttribute('data-edge', 'top')

    const promptRowBox = await promptRow.boundingBox()
    const topIndicatorBox = await indicator.boundingBox()
    if (!promptRowBox || !topIndicatorBox) {
      throw new Error('Missing geometry for top-edge indicator assertion')
    }

    expect(
      Math.abs(topIndicatorBox.y + topIndicatorBox.height / 2 - promptRowBox.y)
    ).toBeLessThanOrEqual(2)

    await moveActiveDragToTarget(mainWindow, promptTreePromptSelector(EXAMPLE_1_ID), 'bottom')
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

  test('shows the folder-settings indicator on the bottom edge', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(DEVELOPMENT_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(DEV_1_ID))

    await beginPromptHandleDrag(mainWindow, DEV_1_ID)
    await moveActiveDragToTarget(mainWindow, promptTreeFolderSettingsSelector(EXAMPLES_FOLDER_NAME))

    const settingsRow = mainWindow.locator(promptTreeFolderSettingsSelector(EXAMPLES_FOLDER_NAME))
    const indicator = mainWindow.locator(
      promptTreeFolderSettingsDropIndicatorSelector(EXAMPLES_FOLDER_NAME)
    )

    await expect(indicator).toHaveAttribute('data-edge', 'bottom')

    const settingsRowBox = await settingsRow.boundingBox()
    const indicatorBox = await indicator.boundingBox()
    if (!settingsRowBox || !indicatorBox) {
      throw new Error('Missing geometry for folder-settings indicator assertion')
    }

    expect(
      Math.abs(
        indicatorBox.y + indicatorBox.height / 2 - (settingsRowBox.y + settingsRowBox.height)
      )
    ).toBeLessThanOrEqual(2)

    await finishActiveDrag(mainWindow)
  })

  test('keeps the surviving top row anchored when a drag changes the folder rows', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildDragScrollAnchoringWorkspace(DRAG_SCROLL_WORKSPACE_PATH))
    await testSetup.setupFileDialog([DRAG_SCROLL_WORKSPACE_PATH])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(ANCHORING_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(ANCHOR_1_ID))

    await beginPromptHandleDrag(mainWindow, ANCHOR_1_ID)
    await scrollPromptEditorAcrossViewportTop(mainWindow, testHelpers, ANCHOR_2_ID)

    const promptTwoOffsetsBefore = await getRowViewportOffsets(
      mainWindow,
      promptEditorSelector(ANCHOR_2_ID)
    )
    if (!promptTwoOffsetsBefore) {
      throw new Error('Failed to capture prompt two offsets before move')
    }

    const scrollTopBefore = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)

    await moveActiveDragToTarget(mainWindow, promptTreeFolderSelector(DESTINATION_FOLDER_NAME))
    await finishActiveDrag(mainWindow)

    await expect
      .poll(async () => await readPromptFolderPromptIds(electronApp, ANCHORING_FOLDER_PATH))
      .toEqual([ANCHOR_2_ID, ANCHOR_3_ID])
    await expect
      .poll(async () => await readPromptFolderPromptIds(electronApp, DESTINATION_FOLDER_PATH))
      .toEqual([ANCHOR_1_ID, DESTINATION_1_ID])

    await scrollUntilPromptEditorVisible(mainWindow, testHelpers, ANCHOR_2_ID)

    await expect
      .poll(async () => {
        const promptTwoOffsetsAfter = await getRowViewportOffsets(
          mainWindow,
          promptEditorSelector(ANCHOR_2_ID)
        )
        return promptTwoOffsetsAfter
          ? Math.abs(promptTwoOffsetsAfter.top - promptTwoOffsetsBefore.top)
          : Number.POSITIVE_INFINITY
      })
      .toBeLessThanOrEqual(2)

    await expect
      .poll(async () =>
        Math.abs(
          (await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)) - scrollTopBefore
        )
      )
      .toBeGreaterThan(100)
  })
})
