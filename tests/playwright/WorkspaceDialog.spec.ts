import { basename, join } from 'node:path'
import { readFile, readdir } from 'node:fs/promises'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { readRecord } from '../helpers/WorkspaceDatabaseHelpers'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { readUserPersistence, runSqlQuery, runSqlStatement, seedUserPersistence } from '../helpers/UserPersistenceHelpers'

/** Managed-workspace lifecycle across the real renderer, main connection and profile filesystem. */
const { test, describe, expect } = createPlaywrightTestSuite()

/** Builds a v8 source whose filename, display name, and stable identity can vary independently. */
const fixture = (path: string, name: string, id: string) => createWorkspaceWithCollections(path, [{
  folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'tasks',
  prompts: [{ id: 'task', title: 'Plan', promptText: 'Preserve this text' }]
}], { settings: { workspaceId: id, workspaceName: name } })

describe('Managed workspace databases', () => {
  test('renames the default workspace file and restores its content and tabs at the new path', async ({ testSetup, electronApp }) => {
    /** The real first-launch database is also the source of the example to edit. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ firstLaunch: true })
    await mainWindow.getByRole('button', { name: 'Open My Prompts' }).click()
    /** Workspace identity also owns the user's saved tab session. */
    const workspaceIdentity = async () => (await runSqlQuery(electronApp, 'SELECT id FROM content.workspace')).rows![0].id
    /** Renaming must retain the same file contents and private session owner. */
    const originalId = await workspaceIdentity()
    await mainWindow.getByTestId('prompt-title').first().fill('Keep this edit')
    await mainWindow.getByTestId('new-tab-button').click()
    await testHelpers.navigateToHomeScreen()
    /** A second managed file exercises the same collision rules as Create. */
    const other = '/ws/other'
    await testSetup.setupFilesystem(fixture(other, 'Other Workspace', 'other'))
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(other))
    await testSetup.prepareWorkspaceFixture()
    await mainWindow.getByTestId('rename-workspace-button').click()
    /** Name is prefilled and remains editable after a validation error. */
    const name = mainWindow.getByTestId('rename-workspace-name-input')
    /** Rename submits the current workspace without recreating its contents. */
    const submit = mainWindow.getByTestId('rename-workspace-submit-button')
    await expect(name).toHaveValue('Default Workspace')
    await name.fill('otherworkspace')
    await expect(submit).toBeDisabled()
    await name.press('Enter')
    await expect(mainWindow.getByTestId('rename-workspace-name-error')).toContainText('already exists')
    await expect(mainWindow.getByTestId('rename-workspace-submit-error')).toHaveCount(0)
    await name.fill('Writing Desk')
    await name.press('Enter')
    /** The managed filename, SQLite identity, and remembered path must agree after rename. */
    const profile = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    /** Windows startup and Explorer both use this managed path. */
    const renamed = join(profile, 'Workspaces', 'WritingDesk.cthulhuprompt')
    await expect(mainWindow.getByTestId('workspace-ready-path')).toHaveText(renamed)
    await expect(mainWindow.getByTestId('home-primary-card')).toContainText('Writing Desk')
    await expect.poll(async () => (await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBe(renamed)
    expect((await readdir(join(profile, 'Workspaces'))).filter((file) => file.endsWith('.cthulhuprompt')).sort())
      .toEqual(['OtherWorkspace.cthulhuprompt', 'WritingDesk.cthulhuprompt'])
    await mainWindow.reload()
    await expect(mainWindow.getByTestId('workspace-ready-path')).toHaveText(renamed)
    expect(await workspaceIdentity()).toBe(originalId)
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveText(['My Prompts', 'My Templates', 'New Tab'])
    await mainWindow.getByRole('tab', { name: 'My Prompts', exact: true }).click()
    await expect(mainWindow.getByTestId('prompt-title').first()).toHaveValue('Keep this edit')
  })

  test('imports silently beside the active workspace, opens from the list, and reveals its SQLite file', async ({ testSetup, electronApp }) => {
    /** The mocked v8 workspace lives outside the managed directory. */
    const path = '/ws/legacy'
    /** Include both libraries and a note to verify cross-record identities survive import. */
    const source = {
      ...createWorkspaceWithTemplateCollections(path, [{
        folderName: 'Library', displayName: 'Library', templates: [{ id: 'wrapper', title: 'Wrapper', templateText: '[[PROMPT_TEXT]]' }]
      }]),
      ...fixture(path, 'Imported Work', 'import-id')
    }
    /** The current source format keeps the note and the template references in front matter. */
    const promptFile = Object.keys(source).find((file) => file.endsWith('Plan.prompt.md'))!
    source[promptFile] = source[promptFile]!.replace('id: task', 'id: task\nattachedNoteId: attachment\ntemplates:\n  - id: wrapper')
    source[promptFile.replace('Plan.prompt.md', 'Attached.note.md')] = '---\nid: attachment\n---\nAttached instructions'
    /** Legacy metadata selected by the picker or remembered at startup. */
    const info = getWorkspaceInfoPath(path)
    await testSetup.setupFilesystem(source)
    /** Exercise opening and importing through the real Electron renderer. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.createWorkspaceViaUI()
    await testHelpers.navigateToHomeScreen()
    /** The active database must remain selected after importing another workspace. */
    const first = (await readUserPersistence(electronApp)).lastWorkspaceInfoPath
    await testSetup.setupFileDialog([info])
    await mainWindow.getByTestId('import-workspace-button').click()
    await expect(mainWindow.getByTestId('open-workspace-button')).toBeEnabled()
    await expect(mainWindow.getByRole('dialog')).toHaveCount(0)
    expect((await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBe(first)
    await mainWindow.getByTestId('open-workspace-button').click()
    /** The managed Open dialog lists both newly created and imported workspaces. */
    const dialog = mainWindow.getByRole('dialog', { name: 'Open Workspace' })
    /** Match just the two workspace choices in catalog order. */
    const names = dialog.getByRole('button', { name: /^(Imported Work|Test Workspace)$/ })
    await expect(names).toHaveText(['Imported Work', 'Test Workspace'])
    await names.first().click()
    await testHelpers.navigateToPromptCollections('Tasks')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Plan')
    expect(await readRecord(electronApp, 'prompt', 'task')).toMatchObject({
      status: 'Todo', promptText: 'Preserve this text', templates: [{ id: 'wrapper' }], attachedNoteId: 'attachment'
    })
    expect(await readRecord(electronApp, 'note', 'attachment')).toMatchObject({ kind: 'attached', noteText: 'Attached instructions' })
    expect(await readRecord(electronApp, 'promptTemplate', 'wrapper')).toMatchObject({ title: 'Wrapper', templateText: '[[PROMPT_TEXT]]' })
    await testHelpers.navigateToHomeScreen()
    /** The remembered path is the file that Windows Explorer should reveal. */
    const database = (await readUserPersistence(electronApp)).lastWorkspaceInfoPath!
    expect(basename(database)).toBe('ImportedWork.cthulhuprompt')
    /** Each Electron fixture has its own real profile on disk. */
    const directory = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    expect(database).toBe(join(directory, 'Workspaces', 'ImportedWork.cthulhuprompt'))
    expect((await readFile(database)).subarray(0, 16).toString()).toBe('SQLite format 3\0')
    expect(await readTextFile(electronApp, info)).toBe(source[info])
    await electronApp.evaluate(({ app, shell }) => { shell.showItemInFolder = (file) => { (app as any).revealedWorkspace = file } })
    await mainWindow.getByTestId('home-open-workspace-folder-button').click()
    await expect.poll(() => electronApp.evaluate(({ app }) => (app as any).revealedWorkspace)).toBe(database)
    await mainWindow.getByTestId('create-workspace-button').click()
    await mainWindow.getByTestId('create-workspace-name-input').fill('importedwork')
    await expect(mainWindow.getByTestId('create-workspace-submit-button')).toBeDisabled()
    await expect(mainWindow.getByTestId('create-workspace-name-error')).toContainText('already exists')
  })

  test('keeps the original workspace open if remembering the renamed file fails', async ({ testSetup, electronApp }) => {
    /** Simulate a disk write failure after Windows has moved the managed file. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ firstLaunch: true })
    await mainWindow.getByRole('button', { name: 'Open My Prompts' }).click()
    await testHelpers.navigateToHomeScreen()
    /** Original path must remain usable after the transaction rolls back. */
    const original = (await readUserPersistence(electronApp)).lastWorkspaceInfoPath
    await runSqlStatement(electronApp, `CREATE TRIGGER fail_rename BEFORE INSERT ON workspace_state
      WHEN NEW.state_type = 'application-machine' AND json_extract(NEW.data_json, '$.lastWorkspaceInfoPath') LIKE '%RenameRetry.cthulhuprompt'
      BEGIN SELECT RAISE(ABORT, 'Rename write failed'); END`)
    await mainWindow.getByTestId('rename-workspace-button').click()
    await mainWindow.getByTestId('rename-workspace-name-input').fill('Rename Retry')
    await mainWindow.getByTestId('rename-workspace-submit-button').click()
    await expect(mainWindow.getByTestId('rename-workspace-submit-error')).toContainText('Rename write failed')
    testSetup.removeRendererErrorsContaining('IPC invocation error')
    expect((await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBe(original)
    expect((await runSqlQuery(electronApp, 'SELECT name FROM content.workspace')).rows).toEqual([{ name: 'Default Workspace' }])
    await runSqlStatement(electronApp, 'DROP TRIGGER fail_rename')
    await mainWindow.getByTestId('rename-workspace-submit-button').click()
    await expect(mainWindow.getByTestId('workspace-ready-path')).toContainText('RenameRetry.cthulhuprompt')
  })

  test('migrates the remembered workspace once, retains its source, and opens the database on reload', async ({ testSetup, electronApp }) => {
    /** The mocked v8 workspace lives outside the managed directory. */
    const path = '/ws/remembered'
    /** Legacy metadata selected by the picker or remembered at startup. */
    const info = getWorkspaceInfoPath(path)
    /** Keep the original bytes available for comparison after migration. */
    const source = fixture(path, 'Remember Me', 'my-id')
    /** A missing v8 order should be reconstructed only inside the managed database. */
    const orderPath = `${path}/DefaultProject/Prompts/Tasks/Active/_CategoryOrder.json`
    delete source[orderPath]
    await testSetup.setupFilesystem(source)
    await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: info })
    /** Exercise opening and importing through the real Electron renderer. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.navigateToPromptCollections('Tasks')
    await mainWindow.getByTestId('prompt-title').fill('Edited in SQLite')
    await testHelpers.navigateToHomeScreen()
    /** The remembered path is the file that Windows Explorer should reveal. */
    const database = (await readUserPersistence(electronApp)).lastWorkspaceInfoPath!
    expect(basename(database)).toBe('RememberMe.cthulhuprompt')
    /** Read the stored title independently of the renderer to confirm persistence. */
    const readTitle = async () => (await runSqlQuery(electronApp, "SELECT json_extract(data, '$.title') AS title FROM content.records WHERE kind='prompt' AND id='task'")).rows?.[0]?.title
    await expect.poll(readTitle).toBe('Edited in SQLite')
    expect((await readRecord(electronApp, 'promptCollection', 'tasks'))?.statusFolders.active.categoryOrder.categories)
      .toEqual([{ categoryId: null, entries: [{ kind: 'prompt', id: 'task' }] }])
    expect(await checkFileExists(electronApp, orderPath)).toBe(false)
    for (const [file, original] of Object.entries(source)) {
      if (original !== null) expect(await readTextFile(electronApp, file)).toBe(original)
    }
    // Simulate the user deleting the original files after confirming the import.
    await testSetup.setupFilesystem({})
    await mainWindow.reload()
    await expect(mainWindow.getByTestId('new-tab-button')).toBeEnabled()
    await testHelpers.navigateToPromptCollections('Tasks')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Edited in SQLite')
  })

  for (const failure of ['duplicate name', 'duplicate ID', 'duplicate prompt', 'wrong version', 'invalid Markdown', 'missing order reference'] as const) {
    test('rejects ' + failure + ' without publishing partial data', async ({ testSetup, electronApp }) => {
      /** Existing managed workspace used to check that failure leaves its session intact. */
      const original = '/ws/original'
      /** Separate legacy root for the workspace that should fail to import. */
      const other = '/ws/other'
      /** Change just the input needed for this failure case. */
      const second = fixture(other, failure === 'duplicate name' ? 'MyWork' : 'Other', failure === 'duplicate ID' ? 'one' : 'two')
      /** Legacy metadata selected by the picker or remembered at startup. */
      const info = getWorkspaceInfoPath(other)
      if (failure === 'duplicate prompt') {
        /** Two different files claim the same stable ID during the publication transaction. */
        const file = Object.keys(second).find((key) => key.endsWith('.prompt.md'))!
        second[file.replace('Plan.prompt.md', 'Duplicate.prompt.md')] = second[file]
      }
      if (failure === 'wrong version') second[info] = JSON.stringify({ ...JSON.parse(second[info]!), schemaVersion: 7 })
      if (failure === 'invalid Markdown') second[Object.keys(second).find((key) => key.endsWith('.prompt.md'))!] = 'malformed'
      if (failure === 'missing order reference') second[Object.keys(second).find((key) => key.endsWith('Active/_CategoryOrder.json'))!] =
        JSON.stringify({ categories: [{ categoryId: null, entries: [{ kind: 'prompt', id: 'missing' }] }] })
      await testSetup.setupFilesystem({ ...fixture(original, 'My Work', 'one'), ...second })
      await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: getWorkspaceInfoPath(original) })
      /** Exercise opening and importing through the real Electron renderer. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart()
      await testHelpers.navigateToHomeScreen()
      await testSetup.setupFileDialog([info])
      await mainWindow.getByTestId('import-workspace-button').click()
      await expect(mainWindow.getByRole('dialog', { name: 'Failed to Import Workspace' })).toContainText({
        'duplicate name': 'name already exists', 'duplicate ID': 'ID already exists', 'wrong version': 'Expected 8',
        'invalid Markdown': '.prompt.md', 'missing order reference': '_CategoryOrder.json', 'duplicate prompt': 'UNIQUE'
      }[failure])
      /** Each Electron fixture has its own real profile on disk. */
      const directory = await electronApp.evaluate(({ app }) => app.getPath('userData'))
      expect(await readdir(join(directory, 'Workspaces'))).toEqual(['MyWork.cthulhuprompt'])
      expect(await readTextFile(electronApp, info)).toBe(second[info])
      expect((await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBe(join(directory, 'Workspaces', 'MyWork.cthulhuprompt'))
      expect(await readRecord(electronApp, 'prompt', 'task')).toMatchObject({ title: 'Plan' })
      testSetup.removeRendererErrorsContaining('IPC invocation error')
    })
  }

  test('retries automatic migration after saving the workspace order fails', async ({ testSetup, electronApp }) => {
    /** The file is published before startup saves the private order on the main connection. */
    const path = '/ws/interrupted'
    /** Legacy metadata selected by the picker or remembered at startup. */
    const info = getWorkspaceInfoPath(path)
    await testSetup.setupFilesystem(fixture(path, 'Interrupted', 'interrupted-id'))
    await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: info })
    await runSqlStatement(electronApp, `CREATE TRIGGER fail_order BEFORE INSERT ON workspace_state
      WHEN NEW.state_type = 'collection-order' BEGIN SELECT RAISE(ABORT, 'Order save failed'); END`)
    /** Startup automatically attempts to restore the remembered workspace. */
    const { mainWindow } = await testSetup.setupAndStart()
    await expect(mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' })).toContainText('Order save failed')
    /** Each Electron fixture has its own real profile on disk. */
    const directory = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    expect(await readdir(join(directory, 'Workspaces'))).toEqual([])
    expect((await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBe(info)
    await runSqlStatement(electronApp, 'DROP TRIGGER fail_order')
    await mainWindow.reload()
    await expect.poll(async () => (await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBe(join(directory, 'Workspaces', 'Interrupted.cthulhuprompt'))
    testSetup.removeRendererErrorsContaining('IPC invocation error')
    testSetup.removeRendererErrorsContaining('Failed to restore last workspace')
  })

  test('retains a failed automatic migration for retry after the source is corrected', async ({ testSetup, electronApp }) => {
    /** The mocked v8 workspace lives outside the managed directory. */
    const path = '/ws/retry'
    /** Keep the original bytes available for comparison after migration. */
    const source = fixture(path, 'Retry', 'retry-id')
    /** Legacy metadata selected by the picker or remembered at startup. */
    const info = getWorkspaceInfoPath(path)
    await testSetup.setupFilesystem({ ...source, [info]: '{invalid' })
    await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: info })
    /** Startup automatically attempts to restore the remembered workspace. */
    const { mainWindow } = await testSetup.setupAndStart()
    await expect(mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' })).toContainText('retry.cthulhuprompt')
    expect((await readUserPersistence(electronApp)).lastWorkspaceInfoPath).toBe(info)
    await testSetup.setupFilesystem(source)
    await mainWindow.reload()
    await expect(mainWindow.getByTestId('new-tab-button')).toBeEnabled()
    expect(basename((await readUserPersistence(electronApp)).lastWorkspaceInfoPath!)).toBe('Retry.cthulhuprompt')
    testSetup.removeRendererErrorsContaining('IPC invocation error')
    testSetup.removeRendererErrorsContaining('Failed to restore last workspace')
  })
})
