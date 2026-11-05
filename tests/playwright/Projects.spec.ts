import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createLegacyWorkspaceFilesystem, createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { readWorkspaceState, runSqlStatement, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'
import { selectedQuickCollectionSelector } from '../helpers/PromptCollectionSelectors'

/** Real Electron coverage uses production project commands until management UI is available. */
const { test, describe, expect } = createPlaywrightTestSuite()

/** Both content kinds and a stable task identity expose ownership and migration mistakes. */
const workspaceFiles = (path: string) => ({
  ...createWorkspaceWithCollections(path, [{ folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'tasks',
    prompts: [{ id: 'task', title: 'Keep Me', promptText: 'Preserved task body.' }] }]),
  ...createWorkspaceWithTemplateCollections(path, [{ folderName: 'Templates', displayName: 'Templates', collectionId: 'templates',
    templates: [{ id: 'wrapper', title: 'Shared Wrapper', templateText: 'Before [[PROMPT_TEXT]] After' }] }])
})

describe('Persisted projects', () => {
  test('migrates content and private preferences into a stable default project and reopens', async ({ testSetup, electronApp }) => {
    /** Schema seven represents the complete pre-project workspace layout. */
    const path = '/ws/project-migration'
    /** Original bytes are compared at their relocated paths after migration. */
    const legacy = createLegacyWorkspaceFilesystem(workspaceFiles(path), 7)
    /** User state predates persisted project identities. */
    const workspaceId = createDeterministicId(path)
    await seedWorkspaceState(electronApp, workspaceId, 'collection-order', null, { entries: ['templates', 'tasks'].map((id) => ({ kind: 'collection', id })) })
    await seedWorkspaceState(electronApp, workspaceId, 'collection-favorites', null, { ids: ['templates', 'tasks'] })
    await seedWorkspaceState(electronApp, workspaceId, 'workspace-navigation', null, {
      selectedScreen: 'project', selectedScreenData: { promptCollectionId: 'templates', contentOwnerId: 'templates', openPromptId: null }, lastCollectionId: 'templates'
    })
    await testSetup.setupFilesystem(legacy)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Opening follows the actual migrations, loaders, and screen restoration. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    /** Stable metadata is generated once during migration. */
    const info = JSON.parse(await readTextFile(electronApp, `${path}/DefaultProject/ProjectInfo.json`))
    expect(info).toEqual({ id: expect.stringMatching(/^[a-f0-9]{32}$/i), name: 'Default Project', abbreviation: 'DE' })
    for (const [file, bytes] of Object.entries(legacy)) {
      if (bytes === null || file.endsWith('.cthulhuprompt')) continue
      expect(await readTextFile(electronApp, file.replace(`${path}/`, `${path}/DefaultProject/`))).toBe(bytes)
    }
    expect(await checkFileExists(electronApp, `${path}/Prompts`)).toBe(false)
    expect(await checkFileExists(electronApp, `${path}/Templates`)).toBe(false)
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-favorites', info.id)).toEqual({ ids: ['templates', 'tasks'] })
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-order', info.id)).toEqual({ entries: ['templates', 'tasks'].map((id) => ({ kind: 'collection', id })) })
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-order', null)).toBeNull()
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Templates')
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await testHelpers.setupWorkspaceViaUI()
    expect(JSON.parse(await readTextFile(electronApp, `${path}/DefaultProject/ProjectInfo.json`))).toEqual(info)
    expect(JSON.parse(await readTextFile(electronApp, getWorkspaceInfoPath(path))).schemaVersion).toBe(8)
  })

  test('retries a partially moved workspace and a failed private-state import without losing identity', async ({ testSetup, electronApp }) => {
    /** Failure after the first library move must preserve the generated project ID. */
    const path = '/ws/project-retry'
    /** Old favorites remain until the replacement transaction commits. */
    const workspaceId = createDeterministicId(path)
    await testSetup.setupFilesystem(createLegacyWorkspaceFilesystem(workspaceFiles(path), 7))
    await seedWorkspaceState(electronApp, workspaceId, 'collection-favorites', null, { ids: ['tasks'] })
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** One window retries the exact same open operation. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await electronApp.evaluate(({ app }, target) => app.emit('test-fail-file-commit', target), `${path}/DefaultProject/Templates`)
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' })).toContainText('Injected file commit failure')
    /** Metadata was already committed and must be reused by both retries. */
    const info = await readTextFile(electronApp, `${path}/DefaultProject/ProjectInfo.json`)
    expect(JSON.parse(await readTextFile(electronApp, getWorkspaceInfoPath(path))).schemaVersion).toBe(7)
    expect(await checkFileExists(electronApp, `${path}/DefaultProject/Prompts/Tasks`)).toBe(true)
    expect(await checkFileExists(electronApp, `${path}/Templates/Templates`)).toBe(true)
    await mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' }).locator('button.cthulhuUiButton').click()
    await runSqlStatement(electronApp, `CREATE TRIGGER reject_project_import BEFORE INSERT ON workspace_state WHEN NEW.state_type = 'collection-favorites' AND NEW.entity_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Project import failure'); END`)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' })).toContainText('Project import failure')
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-favorites', null)).toEqual({ ids: ['tasks'] })
    await runSqlStatement(electronApp, 'DROP TRIGGER reject_project_import')
    await mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' }).locator('button.cthulhuUiButton').click()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await testHelpers.setupWorkspaceViaUI()
    expect(await readTextFile(electronApp, `${path}/DefaultProject/ProjectInfo.json`)).toBe(info)
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-favorites', JSON.parse(info).id)).toEqual({ ids: ['tasks'] })
  })

  test('creates blank projects, isolates collection names and favorites, and restores each selection', async ({ testSetup, electronApp }) => {
    /** Existing content supplies a cross-project template and verifies new projects have no examples. */
    const path = '/ws/project-isolation'
    await testSetup.setupFilesystem(workspaceFiles(path))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Existing activity buttons remain the real switching UI. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Templates')
    /** Creation uses the same exported wrapper future management UI will invoke. */
    const created = await mainWindow.evaluate(async () => {
      /** Production command API is exposed only in the Playwright environment. */
      const api = window.playwrightTestControls!.projects
      /** Loaded workspace is the command's stable owner. */
      const workspace = api.getWorkspace()!
      /** New project becomes the first project and opens after commit. */
      const id = await api.createProject(workspace.id, { name: 'Second Project', abbreviation: ' s2 ', shortDescription: 'Short', description: 'Full' })
      return { id, workspaceId: workspace.id, originalId: workspace.projects[0].id }
    })
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Second Project')
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('My Prompts')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveCount(0)
    // Both starter collections exist, are task-first, and contain no examples.
    expect(await mainWindow.evaluate(() => window.playwrightTestControls!.projects.getWorkspace()!.projects[0].collectionEntries.map((entry) => {
      /** Existing collection reader exposes the production empty layouts. */
      const collection = window.playwrightTestControls!.notes.getCollection(entry.id)!
      return { name: collection.displayName, kind: collection.kind, entries: collection.statusFolders.active.categoryOrder.categories[0].entries }
    }))).toEqual([{ name: 'My Prompts', kind: 'prompt', entries: [] }, { name: 'My Templates', kind: 'template', entries: [] }])
    expect(JSON.parse(await readTextFile(electronApp, `${path}/SecondProject/ProjectInfo.json`))).toEqual({ id: created.id, name: 'Second Project', abbreviation: 'S2', shortDescription: 'Short', description: 'Full' })
    /** Same collection name as another project is valid and cannot alter its favorites. */
    const secondCollectionId = await mainWindow.evaluate(async ({ id, workspaceId }) => {
      /** Shared collection wrappers enforce project-local names and orders. */
      const api = window.playwrightTestControls!.projects
      /** A third collection makes reordering observable. */
      const collectionId = await api.createCollection(workspaceId, id, 'Tasks')
      await api.setCollectionFavorite(workspaceId, collectionId, true)
      await api.moveCollection(workspaceId, collectionId, api.getWorkspace()!.projects[0].collectionEntries.at(-1)!.id)
      return collectionId
    }, created)
    /** Reordering must persist independently of the original project's task-first order. */
    const savedOrder = await readWorkspaceState(electronApp, created.workspaceId, 'collection-order', created.id)
    expect(savedOrder).toMatchObject({ entries: [{ id: expect.any(String) }, { id: expect.any(String) }, { id: secondCollectionId }] })
    expect(await readWorkspaceState(electronApp, created.workspaceId, 'collection-order', created.originalId)).toEqual({ entries: [{ kind: 'collection', id: 'tasks' }, { kind: 'collection', id: 'templates' }] })
    await mainWindow.getByTestId('sidebar-prompt-collection-selector-trigger').click()
    await mainWindow.getByTestId(`sidebar-prompt-collection-dropdown-item-${secondCollectionId}`).click()
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Templates')
    await mainWindow.getByRole('button', { name: 'Second Project', exact: true }).click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Tasks')
    expect(await readWorkspaceState(electronApp, created.workspaceId, 'collection-favorites', created.id)).toEqual({ ids: [secondCollectionId] })
    expect(await readWorkspaceState(electronApp, created.workspaceId, 'collection-favorites', created.originalId)).toEqual({ ids: [] })
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await testHelpers.setupWorkspaceViaUI()
    await mainWindow.getByRole('button', { name: 'Second Project', exact: true }).click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Tasks')
    expect(await readWorkspaceState(electronApp, created.workspaceId, 'collection-order', created.id)).toEqual(savedOrder)
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Templates')
  })

  test('renames a project without rewriting its content and deletes the final project permanently', async ({ testSetup, electronApp }) => {
    /** Content bytes and filenames must survive the parent-directory rename. */
    const path = '/ws/project-lifecycle'
    await testSetup.setupFilesystem(workspaceFiles(path))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Real selected editors are mounted while the parent project changes. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Tasks')
    /** Original bytes include identity and timestamps in front matter. */
    const original = await readTextFile(electronApp, `${path}/DefaultProject/Prompts/Tasks/Active/Keep Me.prompt.md`)
    /** Project editing preserves the stable ID used by navigation and private preferences. */
    const ids = await mainWindow.evaluate(async () => {
      /** Production command API supplies both metadata and the persisted update. */
      const api = window.playwrightTestControls!.projects
      /** Current workspace and first project are the rename targets. */
      const workspace = api.getWorkspace()!
      /** Metadata update also changes the activity label and abbreviation. */
      const project = workspace.projects[0]
      await api.updateProject(workspace.id, { id: project.id, name: 'Renamed Project', abbreviation: 'rp', description: 'New description' })
      return { workspaceId: workspace.id, projectId: project.id }
    })
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Renamed Project')
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText('RP')
    expect(await readTextFile(electronApp, `${path}/RenamedProject/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(original)
    expect(await checkFileExists(electronApp, `${path}/DefaultProject`)).toBe(false)
    // A subsequent editor command must use the relocated persistence path.
    await mainWindow.evaluate(() => window.playwrightTestControls!.notes.renameOwner('prompt', 'task', 'After Rename'))
    expect(await checkFileExists(electronApp, `${path}/RenamedProject/Prompts/Tasks/Active/After Rename.prompt.md`)).toBe(true)
    await mainWindow.evaluate(({ workspaceId, projectId }) => window.playwrightTestControls!.projects.deleteProject(workspaceId, projectId), ids)
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveCount(0)
    expect(await checkFileExists(electronApp, `${path}/RenamedProject`)).toBe(false)
    expect(await checkFileExists(electronApp, getWorkspaceInfoPath(path))).toBe(true)
    expect(await readWorkspaceState(electronApp, ids.workspaceId, 'collection-order', ids.projectId)).toBeNull()
    expect(await readWorkspaceState(electronApp, ids.workspaceId, 'collection-favorites', ids.projectId)).toBeNull()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await testHelpers.setupWorkspaceViaUI()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveCount(0)
    expect(await checkFileExists(electronApp, `${path}/DefaultProject`)).toBe(false)
    expect(await mainWindow.evaluate(() => window.playwrightTestControls!.projects.getWorkspace()!.projects)).toEqual([])
  })

  test('rejects invalid and duplicate metadata and rolls back project creation on a failed SQLite write', async ({ testSetup, electronApp }) => {
    /** The original project remains selectable after each rejected operation. */
    const path = '/ws/project-validation'
    /** Minimal fixture starts with a persisted but empty default project. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal', path } })
    for (const info of [
      { name: 'default project', abbreviation: 'XY' }, { name: 'Another', abbreviation: 'de' },
      { name: 'Another', abbreviation: 'A' }, { name: 'Another', abbreviation: 'ABC' },
      { name: 'Another', abbreviation: 'A!' }, { name: 'Bad/Name', abbreviation: 'XY' }
    ]) {
      /** Rejections must not leave optimistic projects or newly allocated folders. */
      const error = await mainWindow.evaluate(async (info) => {
        try { await window.playwrightTestControls!.projects.createProject(window.playwrightTestControls!.projects.getWorkspace()!.id, info); return null }
        catch (error) { return String(error) }
      }, info)
      expect(error).not.toBeNull()
      await expect(mainWindow.getByTestId('nav-button-project')).toHaveCount(1)
    }
    await runSqlStatement(electronApp, `CREATE TRIGGER reject_project_create BEFORE INSERT ON workspace_state WHEN NEW.state_type = 'project-order' BEGIN SELECT RAISE(ABORT, 'Project create failure'); END`)
    /** Main failure exercises the production optimistic rollback and staged filesystem cleanup. */
    const error = await mainWindow.evaluate(async () => {
      try { await window.playwrightTestControls!.projects.createProject(window.playwrightTestControls!.projects.getWorkspace()!.id, { name: 'Retry Project', abbreviation: 'RT' }); return null }
      catch (error) { return String(error) }
    })
    expect(error).toContain('Project create failure')
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveCount(1)
    expect(await checkFileExists(electronApp, `${path}/RetryProject`)).toBe(false)
    await runSqlStatement(electronApp, 'DROP TRIGGER reject_project_create')
    testSetup.removeRendererErrorsContaining('Project create failure')
    await mainWindow.evaluate(() => window.playwrightTestControls!.projects.createProject(window.playwrightTestControls!.projects.getWorkspace()!.id, { name: 'Retry Project', abbreviation: 'RT' }))
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Retry Project')
  })

  test('keeps templates workspace-wide and repairs, reorders, and deletes projects independently', async ({ testSetup, electronApp }) => {
    /** A template-only project makes cross-project availability observable through the real picker. */
    const path = '/ws/project-order'
    /** Existing order is preserved before alphabetically appended discoveries. */
    const defaultId = createDeterministicId(`${path}:DefaultProject`)
    /** Disk project identities remain stable across reopening. */
    const alphaId = createDeterministicId(`${path}:Alpha`)
    /** Zeta owns the template library used by the default project's task. */
    const zetaId = createDeterministicId(`${path}:Zeta`)
    /** Relocate only the template collection; its IDs and content remain unchanged. */
    const filesystem = Object.fromEntries(Object.entries(workspaceFiles(path)).map(([file, bytes]) => [
      file.replace(`${path}/DefaultProject/Templates/Templates`, `${path}/Zeta/Templates/Templates`), bytes
    ]))
    filesystem[`${path}/Zeta/Prompts`] = null
    filesystem[`${path}/Zeta/ProjectInfo.json`] = JSON.stringify({ id: zetaId, name: 'Zeta', abbreviation: 'ZE' })
    filesystem[`${path}/Alpha/Prompts`] = null
    filesystem[`${path}/Alpha/Templates`] = null
    filesystem[`${path}/Alpha/ProjectInfo.json`] = JSON.stringify({ id: alphaId, name: 'Alpha', abbreviation: 'AL' })
    await seedWorkspaceState(electronApp, createDeterministicId(path), 'project-order', null, { ids: ['missing', defaultId, defaultId] })
    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Existing rail and template picker provide user-visible evidence of the persisted graph. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['DE', 'AL', 'ZE'])
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await mainWindow.getByTestId('prompt-template-button').click()
    await expect(mainWindow.getByTestId('prompt-tree-template-prompt-wrapper')).toBeVisible()
    await mainWindow.getByTestId('prompt-tree-template-prompt-wrapper').click()
    await mainWindow.getByTestId('prompt-template-confirm-button').click()
    await expect.poll(() => readTextFile(electronApp, `${path}/DefaultProject/Prompts/Tasks/Active/Keep Me.prompt.md`)).toContain('wrapper')
    /** Newly created projects prepend without disturbing existing or discovered positions. */
    const createdId = await mainWindow.evaluate(async () => {
      /** Production API writes both metadata and private order. */
      const api = window.playwrightTestControls!.projects
      return api.createProject(api.getWorkspace()!.id, { name: 'New Project', abbreviation: 'NP' })
    })
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['NP', 'DE', 'AL', 'ZE'])
    await mainWindow.evaluate(async (id) => {
      /** Zeta moves first by the same null-predecessor convention used by collections. */
      const api = window.playwrightTestControls!.projects
      await api.moveProject(api.getWorkspace()!.id, id, null)
    }, zetaId)
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['ZE', 'NP', 'DE', 'AL'])
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await testHelpers.setupWorkspaceViaUI()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['ZE', 'NP', 'DE', 'AL'])
    expect(await readWorkspaceState(electronApp, createDeterministicId(path), 'project-order', null)).toEqual({ ids: [zetaId, createdId, defaultId, alphaId] })
    await mainWindow.getByRole('button', { name: 'Zeta', exact: true }).click()
    await mainWindow.evaluate(async (id) => {
      /** Deleting a non-final project still returns Home and removes only its own content. */
      const api = window.playwrightTestControls!.projects
      await api.deleteProject(api.getWorkspace()!.id, id)
    }, zetaId)
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['NP', 'DE', 'AL'])
    expect(await checkFileExists(electronApp, `${path}/Zeta`)).toBe(false)
    expect(await checkFileExists(electronApp, `${path}/DefaultProject/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(true)
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Keep Me')
  })

})
