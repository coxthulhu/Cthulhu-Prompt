import type { ElectronApplication } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { readWorkspaceState, seedWorkspaceState, seedUserPersistence } from '../helpers/UserPersistenceHelpers'

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
  return (await readWorkspaceState(electronApp, null, 'workspace-dialog', null))?.directory
}

describe('Workspace Open dialog persistence', () => {
  test('stores the selected directory in SQLite and retains it after closing and reloading', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(createWorkspaceWithCollections(workspacePath, []))
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
    await seedWorkspaceState(electronApp, null, 'workspace-dialog', null, { directory: '/ws/remembered' }, 'machine-specific')
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
      await testSetup.setupFilesystem(createWorkspaceWithCollections(workspacePath, []))
      const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await seedWorkspaceState(electronApp, null, 'workspace-dialog', null, { directory: savedDirectory }, 'machine-specific')
      await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: workspaceInfoPath })
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
    await seedWorkspaceState(electronApp, null, 'workspace-dialog', null, { directory: '/ws/deleted' }, 'machine-specific')
    await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: '/ws/also-deleted/Workspace.cthulhuprompt' })
    const downloads = await electronApp.evaluate(({ app }) => app.getPath('downloads').replace(/\\/g, '/'))
    await stubNativeDialog(electronApp, { canceled: true, filePaths: [] })
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect.poll(() => readDefaultPath(electronApp)).toBe(downloads)
  })
})
