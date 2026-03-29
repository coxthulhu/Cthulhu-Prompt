import { createPlaywrightTestSuite, createTestRequestId } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_FOLDER_HOST_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { checkPersistedPromptFilesExistByTitle } from '../helpers/PromptPersistenceTestHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/sample'
const DEVELOPMENT_FOLDER_NAME = 'Development'
const EXAMPLES_FOLDER_NAME = 'Examples'
const DEVELOPMENT_FOLDER_PATH = `${WORKSPACE_PATH}/Prompts/${DEVELOPMENT_FOLDER_NAME}/FolderData.json`
const EXAMPLES_FOLDER_PATH = `${WORKSPACE_PATH}/Prompts/${EXAMPLES_FOLDER_NAME}/FolderData.json`
const DEV_1_ID = 'dev-1'
const DEV_2_ID = 'dev-2'
const EXAMPLE_1_ID = 'simple-1'

const promptHandleSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-drag-handle"]`
const promptTreePromptSelector = (promptId: string) =>
  `[data-testid="prompt-folder-prompt-${promptId}"]`
const promptTreeFolderSelector = (folderName: string) =>
  `[data-testid="regular-prompt-folder-${folderName}"]`
const promptTreeFolderSettingsSelector = (folderName: string) =>
  `[data-testid="prompt-folder-settings-${folderName}"]`

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
  const target = page.locator(targetSelector)

  await handle.scrollIntoViewIfNeeded()
  await target.scrollIntoViewIfNeeded()
  await expect(handle).toBeVisible()
  await expect(target).toBeVisible()

  const handleBox = await handle.boundingBox()
  const targetBox = await target.boundingBox()

  if (!handleBox || !targetBox) {
    throw new Error(`Missing drag geometry for ${promptId} -> ${targetSelector}`)
  }

  const handleCenterX = handleBox.x + handleBox.width / 2
  const handleCenterY = handleBox.y + handleBox.height / 2
  const targetCenterX = targetBox.x + targetBox.width / 2
  const targetCenterY = targetBox.y + targetBox.height / 2

  await page.mouse.move(handleCenterX, handleCenterY)
  await page.mouse.down()
  await page.mouse.move(handleCenterX + 8, handleCenterY + 8, { steps: 4 })
  await expect(page.locator('[data-testid="drag-drop-overlay"]')).toBeVisible()
  await page.mouse.move(targetCenterX, targetCenterY, { steps: 12 })
  await page.mouse.up()
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
})
