import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_TITLE_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { checkPersistedPromptFilesExistByTitle } from '../helpers/PromptPersistenceTestHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/sample'
const FOLDER_NAME = 'Development'
const PROMPT_ID = 'dev-1'
const ORIGINAL_TITLE = 'Code Review'

const promptTitleSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} ${PROMPT_TITLE_SELECTOR}`

const setPromptTitle = async (page: any, promptId: string, title: string) => {
  const input = page.locator(promptTitleSelector(promptId))
  await input.waitFor({ state: 'visible' })
  await input.fill(title)
}

describe('Prompt persistence filenames', () => {
  test('renames prompt files after title change persists', async ({ testSetup, electronApp }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(PROMPT_ID))

    const renamedTitle = 'Renamed Prompt Title'

    await expect(
      await checkPersistedPromptFilesExistByTitle(electronApp, {
        workspacePath: WORKSPACE_PATH,
        folderName: FOLDER_NAME,
        promptId: PROMPT_ID,
        promptTitle: ORIGINAL_TITLE
      })
    ).toEqual({ markdownExists: true, metadataExists: true })

    await setPromptTitle(mainWindow, PROMPT_ID, renamedTitle)

    await expect
      .poll(
        async () => {
          const [originalFiles, renamedFiles] = await Promise.all([
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: WORKSPACE_PATH,
              folderName: FOLDER_NAME,
              promptId: PROMPT_ID,
              promptTitle: ORIGINAL_TITLE
            }),
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: WORKSPACE_PATH,
              folderName: FOLDER_NAME,
              promptId: PROMPT_ID,
              promptTitle: renamedTitle
            })
          ])

          return { originalFiles, renamedFiles }
        },
        { timeout: 8000 }
      )
      .toEqual({
        originalFiles: { markdownExists: false, metadataExists: false },
        renamedFiles: { markdownExists: true, metadataExists: true }
      })
  })

  test('uses UI fallback title for filename when explicit title is blank', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders(FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(PROMPT_ID))

    // The UI fallback for this prompt is based on promptFolderCount (dev-1 => Prompt 1).
    const fallbackTitle = 'Prompt 1'
    await setPromptTitle(mainWindow, PROMPT_ID, '')

    await expect
      .poll(
        async () => {
          const [originalFiles, fallbackFiles] = await Promise.all([
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: WORKSPACE_PATH,
              folderName: FOLDER_NAME,
              promptId: PROMPT_ID,
              promptTitle: ORIGINAL_TITLE
            }),
            checkPersistedPromptFilesExistByTitle(electronApp, {
              workspacePath: WORKSPACE_PATH,
              folderName: FOLDER_NAME,
              promptId: PROMPT_ID,
              promptTitle: fallbackTitle
            })
          ])

          return { originalFiles, fallbackFiles }
        },
        { timeout: 8000 }
      )
      .toEqual({
        originalFiles: { markdownExists: false, metadataExists: false },
        fallbackFiles: { markdownExists: true, metadataExists: true }
      })
  })
})
