import type { ElectronApplication, Page } from 'playwright'
import { createPlaywrightTestSuite, createTestRequestId } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'

const { test, describe, expect } = createPlaywrightTestSuite()

const FOLDER_ORDER_WORKSPACE_PATH = '/ws/folder-order'
const CREATE_FOLDER_WORKSPACE_PATH = '/ws/folder-order-create'

const workspaceFolderOrderPath = (workspacePath: string): string =>
  `${workspacePath}/Prompts/FolderOrder.json`

const readTextFile = async (
  electronApp: ElectronApplication,
  filePath: string
): Promise<string> => {
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

const readWorkspacePromptFolderIds = async (
  electronApp: ElectronApplication,
  workspacePath: string
): Promise<string[]> => {
  const fileContents = await readTextFile(electronApp, workspaceFolderOrderPath(workspacePath))
  return (JSON.parse(fileContents) as { promptFolderIds: string[] }).promptFolderIds
}

const readPromptTreeFolderTestIds = async (page: Page): Promise<string[]> => {
  return await page
    .locator('[data-testid^="regular-prompt-folder-"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-testid') ?? '')
    )
}

describe('Prompt Folder Order', () => {
  test('loads explicitly ordered folders before unordered folders sorted by disk name', async ({
    electronApp,
    testSetup
  }) => {
    const filesystem = createWorkspaceWithFolders(FOLDER_ORDER_WORKSPACE_PATH, [
      { folderName: 'zeta', displayName: 'Zeta', promptFolderId: 'folder-zeta' },
      { folderName: 'Alpha', displayName: 'Alpha', promptFolderId: 'folder-alpha' },
      { folderName: 'middle', displayName: 'Middle', promptFolderId: 'folder-middle' },
      { folderName: 'beta', displayName: 'Beta', promptFolderId: 'folder-beta' }
    ])
    filesystem[workspaceFolderOrderPath(FOLDER_ORDER_WORKSPACE_PATH)] = JSON.stringify(
      { promptFolderIds: ['missing-folder', 'folder-middle', 'folder-zeta'] },
      null,
      2
    )

    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(FOLDER_ORDER_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await expect.poll(async () => await readPromptTreeFolderTestIds(mainWindow)).toEqual([
      'regular-prompt-folder-middle',
      'regular-prompt-folder-zeta',
      'regular-prompt-folder-Alpha',
      'regular-prompt-folder-beta'
    ])
    await expect(
      await readWorkspacePromptFolderIds(electronApp, FOLDER_ORDER_WORKSPACE_PATH)
    ).toEqual(['missing-folder', 'folder-middle', 'folder-zeta'])
  })

  test('adds new folders to the top of the persisted folder order', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(CREATE_FOLDER_WORKSPACE_PATH, [
        { folderName: 'Alpha', displayName: 'Alpha', promptFolderId: 'folder-alpha' },
        { folderName: 'Beta', displayName: 'Beta', promptFolderId: 'folder-beta' }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(CREATE_FOLDER_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator('[data-testid="new-prompt-folder-button"]').click()
    await mainWindow.locator('[data-testid="folder-name-input"]').fill('New Folder')
    await mainWindow.locator('[data-testid="create-folder-button"]').click()

    await expect(mainWindow.locator('[data-testid="regular-prompt-folder-NewFolder"]')).toHaveCount(
      1
    )
    await expect.poll(async () => await readPromptTreeFolderTestIds(mainWindow)).toEqual([
      'regular-prompt-folder-NewFolder',
      'regular-prompt-folder-Alpha',
      'regular-prompt-folder-Beta'
    ])
    await expect
      .poll(async () => await readWorkspacePromptFolderIds(electronApp, CREATE_FOLDER_WORKSPACE_PATH))
      .toEqual([expect.not.stringMatching(/^folder-(alpha|beta)$/), 'folder-alpha', 'folder-beta'])
  })
})
