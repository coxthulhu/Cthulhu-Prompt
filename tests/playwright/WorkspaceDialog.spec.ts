import type { ElectronApplication } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { runSqlQuery, runSqlStatement, toSqlText } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()
const workspacePath = '/ws/dialog-workspace'
const workspaceInfoPath = getWorkspaceInfoPath(workspacePath)

/** Exercise the production dialog provider while replacing only the native Windows picker. */
const stubNativeDialog = async (
  electronApp: ElectronApplication,
  result: { canceled: boolean; filePaths: string[] }
): Promise<void> => {
  await electronApp.evaluate(({ app, dialog }, selection) => {
    ;(app as any).emit('test-setup-file-dialog', null)
    ;(app as any).workspaceDialogOptions = null
    dialog.showOpenDialog = (async (options: unknown) => {
      ;(app as any).workspaceDialogOptions = options
      return selection
    }) as typeof dialog.showOpenDialog
  }, result)
}

const readDefaultPath = async (electronApp: ElectronApplication): Promise<string | null> =>
  electronApp.evaluate(({ app }) =>
    ((app as any).workspaceDialogOptions?.defaultPath as string | undefined)?.replace(/\\/g, '/') ?? null
  )

const readSavedDirectory = async (electronApp: ElectronApplication): Promise<unknown> => {
  const result = await runSqlQuery(
    electronApp,
    'SELECT workspace_dialog_directory FROM app_persistence WHERE id = 1'
  )
  expect(result.success).toBe(true)
  return result.rows?.[0]?.workspace_dialog_directory
}

describe('Workspace Open dialog persistence', () => {
  test('stores the selected directory in SQLite and retains it after closing and reloading', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, []))
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    await stubNativeDialog(electronApp, { canceled: false, filePaths: [workspaceInfoPath] })
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect(mainWindow.getByTestId('workspace-ready-path')).toBeVisible()
    expect(await readSavedDirectory(electronApp)).toBe(workspacePath)

    await mainWindow.getByTestId('close-workspace-button').click()
    await expect(mainWindow.getByTestId('workspace-ready-path')).toHaveCount(0)
    expect(await readSavedDirectory(electronApp)).toBe(workspacePath)
    await mainWindow.reload()
    await testHelpers.navigateToHomeScreen()

    await stubNativeDialog(electronApp, { canceled: true, filePaths: [] })
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect.poll(() => readDefaultPath(electronApp)).toBe(workspacePath)
    expect(await readSavedDirectory(electronApp)).toBe(workspacePath)
  })

  test('uses a directory read from SQLite and leaves it unchanged on cancel', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem({ '/ws/remembered': null })
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await runSqlStatement(
      electronApp,
      "UPDATE app_persistence SET workspace_dialog_directory = '/ws/remembered' WHERE id = 1"
    )
    await stubNativeDialog(electronApp, { canceled: true, filePaths: [] })
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect.poll(() => readDefaultPath(electronApp)).toBe('/ws/remembered')
    expect(await readSavedDirectory(electronApp)).toBe('/ws/remembered')
  })

  for (const savedDirectory of [null, '/ws/deleted']) {
    test(`falls back to the last workspace when the saved directory is ${savedDirectory}`, async ({
      electronApp,
      testSetup
    }) => {
      await testSetup.setupFilesystem(createWorkspaceWithFolders(workspacePath, []))
      const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await runSqlStatement(
        electronApp,
        `UPDATE app_persistence SET
          workspace_dialog_directory = ${savedDirectory === null ? 'NULL' : toSqlText(savedDirectory)},
          last_workspace_info_path = ${toSqlText(workspaceInfoPath)} WHERE id = 1`
      )
      await stubNativeDialog(electronApp, { canceled: true, filePaths: [] })
      await mainWindow.getByTestId('open-workspace-button').click()
      await expect.poll(() => readDefaultPath(electronApp)).toBe(workspacePath)
    })
  }

  test('falls back to Downloads when both saved directories are unavailable', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await runSqlStatement(
      electronApp,
      `UPDATE app_persistence SET workspace_dialog_directory = '/ws/deleted',
       last_workspace_info_path = '/ws/also-deleted/Workspace.cthulhuprompt.json' WHERE id = 1`
    )
    const downloads = await electronApp.evaluate(({ app }) => app.getPath('downloads').replace(/\\/g, '/'))
    await stubNativeDialog(electronApp, { canceled: true, filePaths: [] })
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect.poll(() => readDefaultPath(electronApp)).toBe(downloads)
  })
})
