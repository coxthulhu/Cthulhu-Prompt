import { getWorkspaceInfoPath, setupWorkspaceScenario } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { checkFileExists } from '../helpers/PromptPersistenceTestHelpers'
import { readUserPersistence, seedUserPersistence } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

/** Workspace whose info file still uses the pre-rename suffix. */
const legacyWorkspacePath = '/ws/legacy-info'
/** Info path the workspace must be renamed to. */
const currentInfoPath = getWorkspaceInfoPath(legacyWorkspacePath)
/** Info path written before the .cthulhuprompt file association. */
const legacyInfoPath = `${currentInfoPath}.json`

/** Sample workspace with its info file moved back to the legacy suffix. */
const createLegacyWorkspaceFilesystem = (): Record<string, string | null> => {
  const filesystem = setupWorkspaceScenario(legacyWorkspacePath, 'sample')
  filesystem[legacyInfoPath] = filesystem[currentInfoPath]
  delete filesystem[currentInfoPath]
  return filesystem
}

describe('Legacy workspace info migration', () => {
  test('renames the remembered legacy workspace file on startup', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(createLegacyWorkspaceFilesystem())
    await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: legacyInfoPath })

    const { testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })

    await expect.poll(() => testHelpers.isWorkspaceReady()).toBe(true)
    expect(await checkFileExists(electronApp, currentInfoPath)).toBe(true)
    expect(await checkFileExists(electronApp, legacyInfoPath)).toBe(false)
    await expect
      .poll(async () => (await readUserPersistence(electronApp)).lastWorkspaceInfoPath)
      .toBe(currentInfoPath)
  })

  test('renames a legacy workspace file opened from the Open dialog', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(createLegacyWorkspaceFilesystem())
    await testSetup.setupFileDialog([legacyInfoPath])

    const { testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()

    expect(await testHelpers.isWorkspaceReady()).toBe(true)
    expect(await checkFileExists(electronApp, currentInfoPath)).toBe(true)
    expect(await checkFileExists(electronApp, legacyInfoPath)).toBe(false)
    await expect
      .poll(async () => (await readUserPersistence(electronApp)).lastWorkspaceInfoPath)
      .toBe(currentInfoPath)
  })
})
