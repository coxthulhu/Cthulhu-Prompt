import { join } from 'node:path'
import { setupWorkspaceScenario } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()

describe('User Persistence', () => {
  test('reopens the persisted workspace on startup', async ({ electronApp, testSetup }) => {
    const persistedWorkspacePath = '/ws/persisted-workspace'
    const userDataPath = await electronApp.evaluate(({ app }) => {
      return app.getPath('userData')
    })

    await testSetup.setupFilesystem({
      ...setupWorkspaceScenario(persistedWorkspacePath, 'minimal'),
      [join(userDataPath, 'UserPersistence.json')]: JSON.stringify(
        { lastWorkspacePath: persistedWorkspacePath },
        null,
        2
      )
    })

    // Startup should restore the workspace directly from user persistence.
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="sidebar-workspace-name"]')).toHaveText(
      'persisted-workspace'
    )
  })
})
