import type { ElectronApplication } from 'playwright'
import { selectedQuickCollectionSelector } from '../helpers/PromptCollectionSelectors'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { getWorkspaceInfoPath, setupWorkspaceScenario } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  readUserPersistence,
  seedUserPersistence,
  seedWorkspaceUiState
} from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

/** Workspace opened by simulated Windows file association launches. */
const fileWorkspacePath = '/ws/file-target'
/** Workspace file passed on the simulated command line. */
const fileWorkspaceInfoPath = getWorkspaceInfoPath(fileWorkspacePath)

/** Suite whose Electron command line includes a double-clicked workspace file. */
const startupFileSuite = createPlaywrightTestSuite({
  launchOptions: { args: [fileWorkspaceInfoPath] }
})

/** Seeds the file workspace with a saved Development collection screen. */
const seedFileWorkspaceScreen = async (electronApp: ElectronApplication): Promise<void> => {
  await seedWorkspaceUiState(electronApp, {
    workspaceId: createDeterministicId(fileWorkspacePath),
    selectedScreen: 'prompt-task-collections',
    selectedScreenData: {
      promptCollectionId: createDeterministicId(`${fileWorkspacePath}:Development`)
    },
    promptCollectionViewEntries: []
  })
}

/** Simulates Windows launching a second instance for a double-clicked workspace file. */
const emitSecondInstance = async (
  electronApp: ElectronApplication,
  workspaceInfoPath: string
): Promise<void> => {
  await electronApp.evaluate(({ app }, path) => {
    app.emit('second-instance', {}, ['cthulhuprompt.exe', path], 'C:\\')
  }, workspaceInfoPath)
}

describe('Workspace file association', () => {
  test('replaces the open workspace and restores the file workspace saved screen', async ({
    electronApp,
    testSetup
  }) => {
    await seedFileWorkspaceScreen(electronApp)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: {
        scenario: 'minimal',
        additionalFilesystem: setupWorkspaceScenario(fileWorkspacePath, 'sample')
      }
    })
    await testHelpers.navigateToSettingsScreen()

    await emitSecondInstance(electronApp, fileWorkspaceInfoPath)

    await expect(mainWindow.locator('[data-testid="prompt-collection-screen"]')).toBeVisible()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Development Tools'
    )
    await expect
      .poll(async () => (await readUserPersistence(electronApp)).lastWorkspaceInfoPath)
      .toBe(fileWorkspaceInfoPath)
  })

  test('closes the open workspace and shows the failure dialog on Home', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await testHelpers.navigateToPromptCollections('Development')

    await emitSecondInstance(electronApp, '/ws/missing/missing.cthulhuprompt')

    await expect(
      mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace', exact: true })
    ).toBeVisible()
    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()
    expect(await testHelpers.isWorkspaceReady()).toBe(false)
    testSetup.removeRendererErrorsContaining('IPC invocation error')
    testSetup.removeRendererErrorsContaining('missing.cthulhuprompt')
  })
})

startupFileSuite.describe('Workspace file association startup', () => {
  startupFileSuite.test('opens the command-line workspace instead of the last workspace', async ({
    electronApp,
    testSetup
  }) => {
    /** Previously open workspace that the command-line file must replace. */
    const lastWorkspacePath = '/ws/last-workspace'
    await testSetup.setupFilesystem({
      ...setupWorkspaceScenario(lastWorkspacePath, 'minimal'),
      ...setupWorkspaceScenario(fileWorkspacePath, 'sample')
    })
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(lastWorkspacePath)
    })
    await seedFileWorkspaceScreen(electronApp)

    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })

    await startupFileSuite.expect(
      mainWindow.locator('[data-testid="prompt-collection-screen"]')
    ).toBeVisible()
    await startupFileSuite.expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Development Tools'
    )
    await startupFileSuite.expect
      .poll(async () => (await readUserPersistence(electronApp)).lastWorkspaceInfoPath)
      .toBe(fileWorkspaceInfoPath)
  })
})
