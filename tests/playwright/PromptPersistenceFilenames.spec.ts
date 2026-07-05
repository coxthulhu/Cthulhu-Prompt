import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_TITLE_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import {
  checkFileExists,
  checkPersistedPromptFilesExistByTitle
} from '../helpers/PromptPersistenceTestHelpers'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/sample'
const FOLDER_NAME = 'Development'
const PROMPT_ID = 'dev-1'
const ORIGINAL_TITLE = 'Code Review'
const COLLISION_WORKSPACE_PATH = '/ws/filename-collisions'
const COLLISION_FOLDER_NAME = 'FilenameCollisions'
const COLLISION_FIRST_PROMPT_ID = 'abcdef1234567890-first'
const COLLISION_SECOND_PROMPT_ID = '1234567890abcdef-second'

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
    ).toEqual({ markdownExists: true })

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
        originalFiles: { markdownExists: false },
        renamedFiles: { markdownExists: true }
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

    const fallbackTitle = 'New Prompt'
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
        originalFiles: { markdownExists: false },
        fallbackFiles: { markdownExists: true }
      })
  })

  test('adds id suffixes to prompts with duplicate sanitized filename stems', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(COLLISION_WORKSPACE_PATH, [
        {
          folderName: COLLISION_FOLDER_NAME,
          displayName: COLLISION_FOLDER_NAME,
          prompts: [
            {
              id: COLLISION_FIRST_PROMPT_ID,
              title: 'Starter One',
              promptText: 'First collision prompt'
            },
            {
              id: COLLISION_SECOND_PROMPT_ID,
              title: 'Starter Two',
              promptText: 'Second collision prompt'
            }
          ]
        }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COLLISION_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(COLLISION_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(COLLISION_FIRST_PROMPT_ID))

    const firstCollisionTitle = 'Case/Name'
    const secondCollisionTitle = 'casename'
    const folderPath = `${COLLISION_WORKSPACE_PATH}/Prompts/${COLLISION_FOLDER_NAME}`

    await setPromptTitle(mainWindow, COLLISION_FIRST_PROMPT_ID, firstCollisionTitle)
    await setPromptTitle(mainWindow, COLLISION_SECOND_PROMPT_ID, secondCollisionTitle)

    await expect
      .poll(
        async () => {
          const [firstUnsuffixed, firstSuffixed, secondUnsuffixed, secondSuffixed, oldSecond] =
            await Promise.all([
              checkFileExists(electronApp, `${folderPath}/CaseName.prompt.md`),
              checkFileExists(electronApp, `${folderPath}/CaseName-abcdef12.prompt.md`),
              checkFileExists(electronApp, `${folderPath}/casename.prompt.md`),
              checkFileExists(electronApp, `${folderPath}/casename-12345678.prompt.md`),
              checkFileExists(electronApp, `${folderPath}/Starter Two.prompt.md`)
            ])

          return { firstUnsuffixed, firstSuffixed, secondUnsuffixed, secondSuffixed, oldSecond }
        },
        { timeout: 8000 }
      )
      .toEqual({
        firstUnsuffixed: false,
        firstSuffixed: true,
        secondUnsuffixed: false,
        secondSuffixed: true,
        oldSecond: false
      })
  })
})
