import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_TITLE_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import {
  checkFileExists,
  readTextFile,
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
const COLLISION_SECOND_PROMPT_ID = 'abcdef1234567890-second'

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

  test('allocates duplicate titles with identical ID prefixes and keeps surviving filenames stable', async ({
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

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(COLLISION_FOLDER_NAME)
    await waitForMonacoEditor(mainWindow, promptEditorSelector(COLLISION_FIRST_PROMPT_ID))

    const firstCollisionTitle = 'Case/Name'
    const secondCollisionTitle = 'casename'
    const folderPath = `${COLLISION_WORKSPACE_PATH}/Prompts/${COLLISION_FOLDER_NAME}/Active`

    await setPromptTitle(mainWindow, COLLISION_FIRST_PROMPT_ID, firstCollisionTitle)
    await setPromptTitle(mainWindow, COLLISION_SECOND_PROMPT_ID, secondCollisionTitle)

    await expect.poll(() => checkFileExists(electronApp, `${folderPath}/casename 1.prompt.md`)).toBe(true)
    expect(await readTextFile(electronApp, `${folderPath}/CaseName.prompt.md`)).toContain(`id: ${COLLISION_FIRST_PROMPT_ID}`)
    expect(await readTextFile(electronApp, `${folderPath}/casename 1.prompt.md`)).toContain(`id: ${COLLISION_SECOND_PROMPT_ID}`)
    expect(await readTextFile(electronApp, `${folderPath}/CaseName.prompt.md`)).toContain('First collision prompt')
    expect(await readTextFile(electronApp, `${folderPath}/casename 1.prompt.md`)).toContain('Second collision prompt')

    await mainWindow
      .locator(
        `${promptEditorSelector(COLLISION_FIRST_PROMPT_ID)} [data-testid="prompt-delete-more-options-button"]`
      )
      .click()
    await mainWindow.locator('[data-testid="prompt-delete-menu-item"]').click()
    await mainWindow.locator('[data-testid="prompt-confirm-delete-button"]').click()

    await expect(mainWindow.locator(promptEditorSelector(COLLISION_FIRST_PROMPT_ID))).toHaveCount(0)
    await expect.poll(() => checkFileExists(electronApp, `${folderPath}/CaseName.prompt.md`)).toBe(false)
    await focusMonacoEditor(mainWindow, promptEditorSelector(COLLISION_SECOND_PROMPT_ID))
    await mainWindow.keyboard.type('Content edit preserves filename. ')
    await expect.poll(() => readTextFile(electronApp, `${folderPath}/casename 1.prompt.md`)).toContain('Content edit preserves filename.')
    expect(await checkFileExists(electronApp, `${folderPath}/casename.prompt.md`)).toBe(false)
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COLLISION_WORKSPACE_PATH)])
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(COLLISION_FOLDER_NAME)
    expect(await readTextFile(electronApp, `${folderPath}/casename 1.prompt.md`)).toContain(`id: ${COLLISION_SECOND_PROMPT_ID}`)
    // A case-only title change reallocates the now-available base filename.
    await setPromptTitle(mainWindow, COLLISION_SECOND_PROMPT_ID, 'CaseName')
    await expect.poll(() => checkFileExists(electronApp, `${folderPath}/CaseName.prompt.md`)).toBe(true)
    expect(await checkFileExists(electronApp, `${folderPath}/casename 1.prompt.md`)).toBe(false)
  })
})
