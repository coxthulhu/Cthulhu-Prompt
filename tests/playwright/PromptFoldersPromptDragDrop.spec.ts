import { createPlaywrightTestSuite, createTestRequestId } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_FOLDER_HOST_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { checkPersistedPromptFilesExistByTitle } from '../helpers/PromptPersistenceTestHelpers'
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

const promptHandleSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-drag-handle"]`
const promptTreePromptSelector = (promptId: string) =>
  `[data-testid="prompt-folder-prompt-${promptId}"]`
const promptTreeFolderSelector = (folderName: string) =>
  `[data-testid="regular-prompt-folder-${folderName}"]`
const promptTreeFolderSettingsSelector = (folderName: string) =>
  `[data-testid="prompt-folder-settings-${folderName}"]`

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

const getPromptEditorIds = async (page: any): Promise<string[]> => {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="prompt-editor-"]'))
      .map((element) => element.getAttribute('data-testid') ?? '')
      .map((testId) => testId.replace('prompt-editor-', ''))
  })
}

const readTextFile = async (electronApp: any, filePath: string): Promise<string> => {
  const requestId = createTestRequestId('read')

  return await electronApp.evaluate(
    async ({ app }, payload) => {
      const { targetPath, requestId } = payload
      return await new Promise<string>((resolve) => {
        app.once(`test-read-file-ready:${requestId}`, (result: { content: string }) => {
          resolve(result.content)
        })
        app.emit('test-read-file', { filePath: targetPath, requestId })
      })
    },
    { targetPath: filePath, requestId }
  )
}

const readPromptFolderPromptIds = async (
  electronApp: any,
  folderDataPath: string
): Promise<string[]> => {
  const fileContents = await readTextFile(electronApp, folderDataPath)
  const parsed = JSON.parse(fileContents) as { promptIds: string[] }
  return parsed.promptIds
}

const dragPromptHandleToTarget = async (page: any, promptId: string, targetSelector: string) => {
  const handle = page.locator(promptHandleSelector(promptId))

  await handle.scrollIntoViewIfNeeded()
  await expect(handle).toBeVisible()

  const handleBox = await handle.boundingBox()

  if (!handleBox) {
    throw new Error(`Missing drag geometry for ${promptId}`)
  }

  const handleCenterX = handleBox.x + handleBox.width / 2
  const handleCenterY = handleBox.y + handleBox.height / 2

  await page.mouse.move(handleCenterX, handleCenterY)
  await page.mouse.down()
  await page.mouse.move(handleCenterX + 8, handleCenterY + 8, { steps: 4 })
  await expect(page.locator('[data-testid="drag-drop-overlay"]')).toBeVisible()

  const target = page.locator(targetSelector)
  await target.scrollIntoViewIfNeeded()
  await expect(target).toBeVisible()

  const targetBox = await target.boundingBox()
  if (!targetBox) {
    throw new Error(`Missing drag geometry for ${targetSelector}`)
  }

  const targetCenterX = targetBox.x + targetBox.width / 2
  const targetCenterY = targetBox.y + targetBox.height / 2

  await page.mouse.move(targetCenterX, targetCenterY, { steps: 12 })
  await page.mouse.up()
}

const dragPromptTreeRowToTarget = async (page: any, promptId: string, targetSelector: string) => {
  const row = page.locator(promptTreePromptSelector(promptId))

  await row.scrollIntoViewIfNeeded()
  await expect(row).toBeVisible()

  const rowBox = await row.boundingBox()

  if (!rowBox) {
    throw new Error(`Missing prompt tree drag geometry for ${promptId}`)
  }

  const rowCenterX = rowBox.x + rowBox.width / 2
  const rowCenterY = rowBox.y + rowBox.height / 2

  await page.mouse.move(rowCenterX, rowCenterY)
  await page.mouse.down()
  await page.mouse.move(rowCenterX + 8, rowCenterY + 8, { steps: 4 })
  await expect(page.locator('[data-testid="drag-drop-overlay"]')).toBeVisible()

  const target = page.locator(targetSelector)
  await target.scrollIntoViewIfNeeded()
  await expect(target).toBeVisible()

  const targetBox = await target.boundingBox()
  if (!targetBox) {
    throw new Error(`Missing drag geometry for ${targetSelector}`)
  }

  const targetCenterX = targetBox.x + targetBox.width / 2
  const targetCenterY = targetBox.y + targetBox.height / 2

  await page.mouse.move(targetCenterX, targetCenterY, { steps: 12 })
  await page.mouse.up()
}

const beginPromptHandleDrag = async (page: any, promptId: string) => {
  const handle = page.locator(promptHandleSelector(promptId))

  await handle.scrollIntoViewIfNeeded()
  await expect(handle).toBeVisible()

  const handleBox = await handle.boundingBox()
  if (!handleBox) {
    throw new Error(`Missing drag geometry for ${promptId}`)
  }

  const handleCenterX = handleBox.x + handleBox.width / 2
  const handleCenterY = handleBox.y + handleBox.height / 2

  await page.mouse.move(handleCenterX, handleCenterY)
  await page.mouse.down()
  await page.mouse.move(handleCenterX + 8, handleCenterY + 8, { steps: 4 })
  await expect(page.locator('[data-testid="drag-drop-overlay"]')).toBeVisible()
}

const moveActiveDragToTarget = async (page: any, targetSelector: string) => {
  const target = page.locator(targetSelector)

  await target.scrollIntoViewIfNeeded()
  await expect(target).toBeVisible()

  const targetBox = await target.boundingBox()
  if (!targetBox) {
    throw new Error(`Missing drag geometry for ${targetSelector}`)
  }

  const targetCenterX = targetBox.x + targetBox.width / 2
  const targetCenterY = targetBox.y + targetBox.height / 2

  await page.mouse.move(targetCenterX, targetCenterY, { steps: 12 })
}

const finishActiveDrag = async (page: any) => {
  await page.mouse.up()
}

const getRowViewportOffsets = async (page: any, selector: string) => {
  return await page.evaluate(
    ({ hostSelector, rowSelector }) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      const row = document.querySelector<HTMLElement>(rowSelector)
      if (!host || !row) {
        return null
      }

      const hostRect = host.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()

      return {
        top: Math.round(rowRect.top - hostRect.top),
        bottom: Math.round(rowRect.bottom - hostRect.top)
      }
    },
    {
      hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
      rowSelector: selector
    }
  )
}

const scrollUntilPromptEditorVisible = async (page: any, testHelpers: any, promptId: string) => {
  const selector = promptEditorSelector(promptId)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await page.locator(selector).count()) > 0) {
      return
    }

    await testHelpers.scrollVirtualWindowBy(PROMPT_FOLDER_HOST_SELECTOR, 600)
  }

  throw new Error(`Prompt editor did not become visible: ${promptId}`)
}

const scrollPromptEditorAcrossViewportTop = async (
  page: any,
  testHelpers: any,
  promptId: string,
  overlapPx = 24
) => {
  const selector = promptEditorSelector(promptId)
  await scrollUntilPromptEditorVisible(page, testHelpers, promptId)

  const offsets = await getRowViewportOffsets(page, selector)
  if (!offsets) {
    throw new Error(`Missing viewport offsets for ${promptId}`)
  }

  const currentScrollTop = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)
  await testHelpers.scrollVirtualWindowTo(
    PROMPT_FOLDER_HOST_SELECTOR,
    currentScrollTop + offsets.top + overlapPx
  )

  await expect
    .poll(async () => {
      const nextOffsets = await getRowViewportOffsets(page, selector)
      return nextOffsets ? nextOffsets.top <= 0 && nextOffsets.bottom > 0 : false
    })
    .toBe(true)
}

const expectCurrentFolderPromptEditors = async (page: any, expectedPromptIds: string[]) => {
  await expect.poll(async () => await getPromptEditorIds(page)).toEqual(expectedPromptIds)
}

const expectPersistedFolderPromptIds = async (
  electronApp: any,
  folderDataPath: string,
  expectedPromptIds: string[]
) => {
  await expect
    .poll(async () => await readPromptFolderPromptIds(electronApp, folderDataPath))
    .toEqual(expectedPromptIds)
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

    await dragPromptHandleToTarget(mainWindow, DEV_2_ID, promptTreePromptSelector(DEV_1_ID))

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

    await dragPromptHandleToTarget(mainWindow, DEV_1_ID, promptTreePromptSelector(DEV_2_ID))

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

    await dragPromptTreeRowToTarget(mainWindow, DEV_1_ID, promptTreePromptSelector(DEV_2_ID))

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

    await dragPromptHandleToTarget(mainWindow, DEV_1_ID, promptTreePromptSelector(EXAMPLE_1_ID))

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

    await dragPromptHandleToTarget(mainWindow, ANCHOR_1_ID, promptTreePromptSelector(ANCHOR_2_ID))

    await expect
      .poll(async () => (await readPromptFolderPromptIds(electronApp, ANCHORING_FOLDER_PATH)).slice(0, 3))
      .toEqual([ANCHOR_2_ID, ANCHOR_1_ID, ANCHOR_3_ID])

    await expect
      .poll(
        async () =>
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

    await dragPromptTreeRowToTarget(mainWindow, ANCHOR_1_ID, promptTreePromptSelector(ANCHOR_2_ID))

    await expectCurrentFolderPromptEditors(mainWindow, [DESTINATION_1_ID])
    await expectPersistedFolderPromptIds(electronApp, ANCHORING_FOLDER_PATH, [
      ANCHOR_2_ID,
      ANCHOR_1_ID,
      ANCHOR_3_ID
    ])
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
      .poll(
        async () =>
          Math.abs(
            (await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)) - scrollTopBefore
          )
      )
      .toBeGreaterThan(100)
  })
})
