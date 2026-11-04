import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createLegacyWorkspaceFilesystem, createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'

/** Production startup exercises migration before collection discovery and order repair. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** One workspace owns both task and template metadata. */
const WORKSPACE_PATH = '/ws/flat-metadata'
/** Schema version remains six until all moves and cleanup succeed. */
const INFO_PATH = getWorkspaceInfoPath(WORKSPACE_PATH)
/** Task metadata includes independent Active and Backlog orders. */
const TASK_PATH = `${WORKSPACE_PATH}/Prompts/Tasks`
/** A metadata-like collection name must remain a real collection directory. */
const TEMPLATE_PATH = `${WORKSPACE_PATH}/Templates/_CollectionInfo`

/** Builds authentic schema-six metadata with deliberately nonalphabetical ordering. */
const createNestedWorkspace = (): Record<string, string | null> => {
  /** Current task and template fixtures are converted back to their nested schema-six paths. */
  const current = {
    ...createWorkspaceWithCollections(WORKSPACE_PATH, [{
      folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'tasks',
      collectionSettings: { collectionDescription: 'Keep task description.\n' },
      prompts: [
        { id: 'zulu', title: 'Zulu', promptText: 'First prompt.' },
        { id: 'alpha', title: 'Alpha', promptText: 'Second prompt.' }
      ]
    }]),
    ...createWorkspaceWithTemplateCollections(WORKSPACE_PATH, [{
      folderName: '_CollectionInfo', displayName: 'Templates', collectionId: 'templates',
      templates: [{ id: 'wrapper', title: 'Wrapper', templateText: '[[PROMPT_TEXT]]' }]
    }]),
    [`${TASK_PATH}/Backlog/_CategoryOrder.json`]: JSON.stringify({ categories: [{ categoryId: null, entries: [] }] }, null, 2),
    [`${TASK_PATH}/Archived/_CollectionInfo`]: null,
    [`${TASK_PATH}/Backlog/_CollectionInfo/Keep.txt`]: 'Keep unrelated metadata.',
    [`${TASK_PATH}/Attachments/_CollectionInfo/CategoryOrder.json`]: 'Unrelated ordering file.',
    [`${WORKSPACE_PATH}/Prompts/Unowned/_CollectionInfo/CategoryOrder.json`]: 'Not a collection.'
  }
  /** Schema six already retired the shared library orders. */
  const nested = createLegacyWorkspaceFilesystem(current, 6)
  delete nested[`${WORKSPACE_PATH}/Prompts/CollectionOrder.json`]
  delete nested[`${WORKSPACE_PATH}/Templates/CollectionOrder.json`]
  return nested
}

describe('Flattened collection metadata', () => {
  test('moves task and template JSON, preserves ordering and other files, and reopens', async ({ electronApp, testSetup }) => {
    /** Original bytes expose any accidental reserialization or content changes. */
    const original = createNestedWorkspace()
    await testSetup.setupFilesystem(original)
    await testSetup.setupFileDialog([INFO_PATH])
    /** Opening through Home runs the production migration and readers. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    /** Exact source/destination pairs cover both kinds and both ordered task statuses. */
    const moves = [
      [`${TASK_PATH}/_CollectionInfo/CollectionInfo.json`, `${TASK_PATH}/_CollectionInfo.json`],
      [`${TASK_PATH}/Active/_CollectionInfo/CategoryOrder.json`, `${TASK_PATH}/Active/_CategoryOrder.json`],
      [`${TASK_PATH}/Backlog/_CollectionInfo/CategoryOrder.json`, `${TASK_PATH}/Backlog/_CategoryOrder.json`],
      [`${TEMPLATE_PATH}/_CollectionInfo/CollectionInfo.json`, `${TEMPLATE_PATH}/_CollectionInfo.json`],
      [`${TEMPLATE_PATH}/Active/_CollectionInfo/CategoryOrder.json`, `${TEMPLATE_PATH}/Active/_CategoryOrder.json`]
    ]
    for (const [source, target] of moves) {
      expect(await checkFileExists(electronApp, source)).toBe(false)
      expect(await readTextFile(electronApp, target)).toBe(original[source])
    }
    /** Every file outside the move list retains its original bytes and location. */
    for (const [filePath, contents] of Object.entries(original)) {
      if (contents === null || filePath === INFO_PATH || moves.some(([source]) => source === filePath)) continue
      expect(await readTextFile(electronApp, filePath)).toBe(contents)
    }
    /** Empty metadata directories disappear, while settings and unrelated files keep theirs. */
    for (const directory of [`${TASK_PATH}/Active/_CollectionInfo`, `${TASK_PATH}/Archived/_CollectionInfo`, `${TEMPLATE_PATH}/_CollectionInfo`, `${TEMPLATE_PATH}/Active/_CollectionInfo`]) {
      expect(await checkFileExists(electronApp, directory)).toBe(false)
    }
    expect(JSON.parse(await readTextFile(electronApp, INFO_PATH)).schemaVersion).toBe(7)
    await testHelpers.navigateToPromptCollections('Tasks')
    await expect(mainWindow.getByTestId('prompt-title').nth(0)).toHaveValue('Zulu')
    await expect(mainWindow.getByTestId('prompt-title').nth(1)).toHaveValue('Alpha')
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([INFO_PATH])
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Templates')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Wrapper')
    for (const [source, target] of moves) {
      expect(await checkFileExists(electronApp, source)).toBe(false)
      expect(await readTextFile(electronApp, target)).toBe(original[source])
    }
  })

  test('rejects a destination collision before moving any source files', async ({ electronApp, testSetup }) => {
    /** A late template collision proves the entire plan is checked before task files move. */
    const original = createNestedWorkspace()
    /** Existing destination represents user content that must never be overwritten. */
    const target = `${TEMPLATE_PATH}/Active/_CategoryOrder.json`
    original[target] = 'Keep existing destination.'
    await testSetup.setupFilesystem(original)
    await testSetup.setupFileDialog([INFO_PATH])
    /** The normal open failure dialog reports the conflicting destination. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' })).toContainText('Collection metadata already exists')
    for (const [filePath, contents] of Object.entries(original)) {
      if (contents !== null) expect(await readTextFile(electronApp, filePath)).toBe(contents)
    }
    expect(await checkFileExists(electronApp, `${TASK_PATH}/_CollectionInfo.json`)).toBe(false)
  })

  test('resumes after a failed rename without losing moved identities or ordering', async ({ electronApp, testSetup }) => {
    /** The failure occurs after task identity and Active order have already moved. */
    const original = createNestedWorkspace()
    await testSetup.setupFilesystem(original)
    await testSetup.setupFileDialog([INFO_PATH])
    /** The one-shot filesystem fault restores rename before the user retries. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await electronApp.evaluate(({ app }, target) => { app.emit('test-fail-file-commit', target) }, `${TASK_PATH}/Backlog/_CategoryOrder.json`)
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' })).toContainText('Injected file commit failure')
    expect(JSON.parse(await readTextFile(electronApp, INFO_PATH)).schemaVersion).toBe(6)
    expect(await readTextFile(electronApp, `${TASK_PATH}/_CollectionInfo.json`)).toBe(original[`${TASK_PATH}/_CollectionInfo/CollectionInfo.json`])
    expect(await readTextFile(electronApp, `${TASK_PATH}/Active/_CategoryOrder.json`)).toBe(original[`${TASK_PATH}/Active/_CollectionInfo/CategoryOrder.json`])
    expect(await readTextFile(electronApp, `${TASK_PATH}/Backlog/_CollectionInfo/CategoryOrder.json`)).toBe(original[`${TASK_PATH}/Backlog/_CollectionInfo/CategoryOrder.json`])
    await mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' }).locator('button.cthulhuUiButton').click()
    await testSetup.setupFileDialog([INFO_PATH])
    await testHelpers.setupWorkspaceViaUI()
    expect(JSON.parse(await readTextFile(electronApp, INFO_PATH)).schemaVersion).toBe(7)
    expect(await readTextFile(electronApp, `${TASK_PATH}/Backlog/_CategoryOrder.json`)).toBe(original[`${TASK_PATH}/Backlog/_CollectionInfo/CategoryOrder.json`])
    expect(await checkFileExists(electronApp, `${TASK_PATH}/Active/_CollectionInfo`)).toBe(false)
    await testHelpers.navigateToPromptCollections('Tasks')
    await expect(mainWindow.getByTestId('prompt-title').nth(0)).toHaveValue('Zulu')
    await expect(mainWindow.getByTestId('prompt-title').nth(1)).toHaveValue('Alpha')
    await testHelpers.navigateToPromptCollections('Templates')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Wrapper')
  })
})
