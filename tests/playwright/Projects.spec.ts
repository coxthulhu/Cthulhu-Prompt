import type { ElectronApplication, Page } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createLegacyWorkspaceFilesystem, createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { readWorkspaceState, runSqlStatement, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'
import { promptCollectionSelectorDropdownItemSelector, promptCollectionSelectorTriggerSelector, selectedQuickCollectionSelector } from '../helpers/PromptCollectionSelectors'
import { focusMonacoEditor } from '../helpers/MonacoHelpers'
import { dragGhostSelector, finishActiveDrag, moveActiveDragToTarget } from '../helpers/PromptDragDropHelpers'
import { resolvePaletteColor } from '../helpers/PaletteHelpers'

/** Real Electron coverage drives Manage Projects and project reordering; controls remain for invalid commands and read-only workspace snapshots. */
const { test, describe, expect } = createPlaywrightTestSuite()

/** Selector rows in the Manage Projects dialog, one per retained draft. */
const projectSelectorItems = '[data-testid^="manage-project-selector-"]'

/** Manage Projects dialog shared by the sidebar gear and the activity bar's + button. */
const projectDialog = (page: Page) => page.getByRole('dialog', { name: 'Manage Projects' })

/** Replaces the selected draft's required name and abbreviation. */
const fillProject = async (page: Page, name: string, abbreviation: string): Promise<void> => {
  await projectDialog(page).getByTestId('manage-project-name-input').fill(name)
  await projectDialog(page).getByTestId('manage-project-abbreviation-input').fill(abbreviation)
}

/** Stages deletion of one saved project through the required acknowledgement. */
const deleteProject = async (page: Page, projectId: string): Promise<void> => {
  await projectDialog(page).getByTestId(`manage-project-selector-${projectId}`).click()
  await projectDialog(page).getByTestId('manage-projects-delete-button').click()
  /** Destructive confirmation shown above Manage Projects. */
  const confirmation = page.getByRole('dialog', { name: 'Delete Project' })
  await confirmation.getByRole('checkbox').check()
  await confirmation.getByTestId('manage-projects-confirm-delete-button').click()
  await expect(confirmation).toHaveCount(0)
}

/** Simulates Windows launching a second instance for a double-clicked workspace file. */
const openWorkspaceFile = async (electronApp: ElectronApplication, workspaceInfoPath: string): Promise<void> => {
  await electronApp.evaluate(({ app }, path) => {
    app.emit('second-instance', {}, ['cthulhuprompt.exe', path], 'C:\\')
  }, workspaceInfoPath)
}

/** Locates one activity bar project button, since every project button shares one test ID. */
const projectButtonSelector = (name: string): string => `[data-testid="nav-button-project"][aria-label="${name}"]`

/** Flags any later press that starts a native text selection, which a reorder drag must never do. */
const watchTextSelectionStarts = async (page: Page): Promise<void> => {
  await page.evaluate(() => document.addEventListener('selectstart', () => {
    document.body.dataset.textSelectionStarted = 'true'
  }, true))
}

/** Reads whether a watched press started a native text selection. */
const didStartTextSelection = async (page: Page): Promise<boolean> =>
  (await page.locator('body').getAttribute('data-text-selection-started')) === 'true'

/** Starts a real pointer drag on a Show All collection row, Manage Projects row, or project button. */
const beginPointerDrag = async (page: Page, selector: string): Promise<void> => {
  /** Source row scrolled into view before measuring its geometry. */
  const row = page.locator(selector)
  await row.scrollIntoViewIfNeeded()
  /** Pointer motion from the row center crosses the production drag threshold. */
  const box = (await row.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2 + 8, { steps: 4 })
  await expect(page.locator('body')).toHaveCSS('cursor', 'grabbing')
}

/** Both content kinds and a stable task identity expose ownership and migration mistakes. */
const workspaceFiles = (path: string) => ({
  ...createWorkspaceWithCollections(path, [{ folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'tasks',
    prompts: [{ id: 'task', title: 'Keep Me', promptText: 'Preserved task body.' }] }]),
  ...createWorkspaceWithTemplateCollections(path, [{ folderName: 'Templates', displayName: 'Templates', collectionId: 'templates',
    templates: [{ id: 'wrapper', title: 'Shared Wrapper', templateText: 'Before [[PROMPT_TEXT]] After' }] }])
})

/** Three projects expose directory swaps and deletion followed by reuse of the same path. */
const batchWorkspaceFiles = (path: string) => ({
  ...workspaceFiles(path),
  ...Object.fromEntries(Object.entries(createWorkspaceWithCollections(path, [{
    folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'second-tasks',
    prompts: [{ id: 'second-task', title: 'Keep Me', promptText: 'Second project content.' }]
  }])).filter(([file]) => file.startsWith(`${path}/DefaultProject/`))
    .map(([file, bytes]) => [file.replace('/DefaultProject/', '/Second/'), bytes])),
  [`${path}/Second/ProjectInfo.json`]: JSON.stringify({ id: 'second', name: 'Second', abbreviation: 'S2' }),
  ...Object.fromEntries(Object.entries(createWorkspaceWithCollections(path, [{
    folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'removed-tasks',
    prompts: [{ id: 'removed-task', title: 'Removed Content', promptText: 'Restore this deleted content.' }]
  }])).filter(([file]) => file.startsWith(`${path}/DefaultProject/`))
    .map(([file, bytes]) => [file.replace('/DefaultProject/', '/Removed/'), bytes])),
  [`${path}/Removed/ProjectInfo.json`]: JSON.stringify({ id: 'removed', name: 'Removed', abbreviation: 'RM' }),
  [`${path}/Removed/Templates`]: null
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

  test('creates a project from the activity bar, isolates collection names and favorites, and restores each selection', async ({ testSetup, electronApp }) => {
    /** Existing content supplies a cross-project template and verifies new projects have no examples. */
    const path = '/ws/project-isolation'
    /** Fixture identities own the private preference rows. */
    const workspaceId = createDeterministicId(path)
    /** Default project identity whose preferences must stay unchanged. */
    const originalId = createDeterministicId(`${path}:DefaultProject`)
    /** A second workspace lets reopening pass through another workspace's Home screen. */
    const otherPath = `${path}-other`
    await testSetup.setupFilesystem({ ...workspaceFiles(path), ...workspaceFiles(otherPath) })
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Existing activity buttons remain the real switching UI. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Templates')
    // The + button opens Manage Projects with a focused draft appended after the existing project.
    await mainWindow.getByTestId('new-project-button').click()
    /** Manage Projects dialog opened by the + button. */
    const dialog = projectDialog(mainWindow)
    await expect(dialog.getByTestId('dialog-subtitle')).toHaveText('project-isolation')
    await expect(dialog.getByTestId('manage-project-name-input')).toBeFocused()
    await expect(dialog.locator(projectSelectorItems)).toHaveText([/Default Project\s*2 collections/, /New Project\s*2 collections/])
    await dialog.getByTestId('manage-project-name-input').fill('Second Project')
    await dialog.getByTestId('manage-project-abbreviation-input').pressSequentially('s2x')
    await expect(dialog.getByTestId('manage-project-abbreviation-input')).toHaveValue('S2')
    await dialog.getByTestId('manage-project-short-description-input').fill(' Short ')
    await focusMonacoEditor(mainWindow, '[data-testid="manage-project-full-description-input"]')
    await mainWindow.keyboard.insertText('Full')
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    // Saving the + draft opens the new project at its first starter collection.
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Second Project')
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['DE', 'S2'])
    await expect(mainWindow.getByTestId('prompt-collection-header-collection')).toHaveText('My Prompts')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveCount(0)
    /** Metadata written for the new project, including its generated identity. */
    const info = JSON.parse(await readTextFile(electronApp, `${path}/SecondProject/ProjectInfo.json`))
    expect(info).toEqual({ id: expect.stringMatching(/^[a-f0-9]{32}$/i), name: 'Second Project', abbreviation: 'S2', shortDescription: 'Short', description: 'Full' })
    // Both starter collections exist, are task-first, and contain no examples.
    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    /** All Collections rows in project order. */
    const rows = mainWindow.locator('[data-dropdown-section="all"] [role="menuitem"]')
    await expect(rows).toHaveText([/My Prompts\s*0 prompts/, /My Templates\s*0 templates/])
    await expect(rows.nth(0).locator('svg.lucide-file-text')).toHaveCount(1)
    await expect(rows.nth(1).locator('svg.lucide-layers')).toHaveCount(1)
    // The same collection name as another project is valid here and gets its own favorite and position.
    await mainWindow.getByTestId('sidebar-prompt-collection-dropdown-add-task-item').click()
    await mainWindow.getByTestId('create-prompt-collection-name-input').fill('Tasks')
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Tasks')
    /** New collection identity read from its selected quick row. */
    const tasksId = (await mainWindow.locator(selectedQuickCollectionSelector).getAttribute('data-testid'))!.replace('sidebar-quick-collection-', '')
    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    await mainWindow.getByTestId(`sidebar-collection-favorite-all-${tasksId}`).click()
    await expect(rows).toHaveText([/Tasks/, /My Prompts/, /My Templates/])
    /** Starter template row currently holds the final position. */
    const lastRowTestId = (await rows.nth(2).getAttribute('data-testid'))!
    await beginPointerDrag(mainWindow, promptCollectionSelectorDropdownItemSelector(tasksId))
    await moveActiveDragToTarget(mainWindow, `[data-testid="${lastRowTestId}"]`)
    await finishActiveDrag(mainWindow)
    // Reordering persists independently of the original project's task-first order.
    await expect.poll(async () => (await readWorkspaceState<{ entries: { id: string }[] }>(electronApp, workspaceId, 'collection-order', info.id))?.entries.map((entry) => entry.id).at(-1)).toBe(tasksId)
    /** Complete reordered entries compared again after reopening. */
    const savedOrder = await readWorkspaceState(electronApp, workspaceId, 'collection-order', info.id)
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-order', originalId)).toEqual({ entries: [{ kind: 'collection', id: 'tasks' }, { kind: 'collection', id: 'templates' }] })
    await mainWindow.keyboard.press('Escape')
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Templates')
    await mainWindow.getByRole('button', { name: 'Second Project', exact: true }).click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Tasks')
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-favorites', info.id)).toEqual({ ids: [tasksId] })
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-favorites', originalId)).toEqual({ ids: [] })
    // Reopening restores the active project and its last collection, then each project's own collection.
    await openWorkspaceFile(electronApp, getWorkspaceInfoPath(otherPath))
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await openWorkspaceFile(electronApp, getWorkspaceInfoPath(path))
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Second Project')
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Tasks')
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-order', info.id)).toEqual(savedOrder)
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Templates')
  })

  test('renames a project from the sidebar gear and deletes the final project after confirmation', async ({ testSetup, electronApp }) => {
    /** Content bytes and filenames must survive the parent-directory rename. */
    const path = '/ws/project-lifecycle'
    /** Fixture identities own the private preference rows. */
    const workspaceId = createDeterministicId(path)
    /** Stable identity preserved by renaming and removed by deletion. */
    const projectId = createDeterministicId(`${path}:DefaultProject`)
    await testSetup.setupFilesystem(workspaceFiles(path))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Real selected editors are mounted while the parent project changes. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Tasks')
    /** Original bytes include identity and timestamps in front matter. */
    const original = await readTextFile(electronApp, `${path}/DefaultProject/Prompts/Tasks/Active/Keep Me.prompt.md`)
    // The gear immediately follows the title and opens settings to the shown project.
    await expect(mainWindow.locator('[data-testid="sidebar-title"] + [data-testid="sidebar-manage-projects-button"]')).toBeVisible()
    await mainWindow.getByTestId('sidebar-manage-projects-button').click()
    /** Manage Projects dialog opened by the sidebar gear. */
    const dialog = projectDialog(mainWindow)
    await expect(dialog.getByTestId(`manage-project-selector-${projectId}`)).toHaveAttribute('aria-pressed', 'true')
    await fillProject(mainWindow, 'Renamed Project', 'rp')
    await expect(dialog.getByTestId('manage-project-abbreviation-input')).toHaveValue('RP')
    await focusMonacoEditor(mainWindow, '[data-testid="manage-project-full-description-input"]')
    await mainWindow.keyboard.insertText('New description')
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Renamed Project')
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText('RP')
    expect(JSON.parse(await readTextFile(electronApp, `${path}/RenamedProject/ProjectInfo.json`))).toEqual({ id: projectId, name: 'Renamed Project', abbreviation: 'RP', description: 'New description' })
    expect(await readTextFile(electronApp, `${path}/RenamedProject/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(original)
    expect(await checkFileExists(electronApp, `${path}/DefaultProject`)).toBe(false)
    // A subsequent editor command must use the relocated persistence path.
    await mainWindow.evaluate(() => window.playwrightTestControls!.notes.renameOwner('prompt', 'task', 'After Rename'))
    expect(await checkFileExists(electronApp, `${path}/RenamedProject/Prompts/Tasks/Active/After Rename.prompt.md`)).toBe(true)
    // Deleting a saved project requires the acknowledgement and waits for Save.
    await mainWindow.getByTestId('sidebar-manage-projects-button').click()
    await dialog.getByTestId('manage-projects-delete-button').click()
    /** Destructive confirmation shown above Manage Projects. */
    const confirmation = mainWindow.getByRole('dialog', { name: 'Delete Project' })
    await expect(confirmation.getByTestId('manage-projects-confirm-delete-button')).toBeDisabled()
    await confirmation.getByRole('checkbox').check()
    await confirmation.getByTestId('manage-projects-confirm-delete-button').click()
    await expect(confirmation).toHaveCount(0)
    await expect(dialog.locator(projectSelectorItems)).toHaveCount(0)
    expect(await checkFileExists(electronApp, `${path}/RenamedProject`)).toBe(true)
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveCount(0)
    expect(await checkFileExists(electronApp, `${path}/RenamedProject`)).toBe(false)
    expect(await checkFileExists(electronApp, getWorkspaceInfoPath(path))).toBe(true)
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-order', projectId)).toBeNull()
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-favorites', projectId)).toBeNull()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await testHelpers.setupWorkspaceViaUI()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveCount(0)
    expect(await checkFileExists(electronApp, `${path}/DefaultProject`)).toBe(false)
  })

  test('validates project fields in the dialog and retries a draft after a failed SQLite write', async ({ testSetup, electronApp }) => {
    /** The original project remains selectable after each rejected operation. */
    const path = '/ws/project-validation'
    /** Minimal fixture starts with a persisted but empty default project. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal', path } })
    await mainWindow.getByTestId('new-project-button').click()
    /** Manage Projects dialog holding one new draft. */
    const dialog = projectDialog(mainWindow)
    /** Required name field validated against collection naming rules and sibling projects. */
    const name = dialog.getByTestId('manage-project-name-input')
    /** Required abbreviation field uppercased while typing. */
    const abbreviation = dialog.getByTestId('manage-project-abbreviation-input')
    /** Batched save disabled while any draft is invalid. */
    const save = dialog.getByTestId('manage-projects-save-button')
    await expect(save).toBeDisabled()
    for (const [field, value, error] of [
      ['name', 'default project', 'A project with this name already exists'],
      ['name', 'Bad/Name', 'Project name contains illegal characters: < > : " / \\ | ? *'],
      ['name', '   ', 'Project name cannot be empty'],
      ['abbreviation', 'de', 'A project with this abbreviation already exists'],
      ['abbreviation', 'A', 'Project abbreviation must contain exactly two letters or digits'],
      ['abbreviation', 'XY', null],
      ['abbreviation', 'A!', 'Project abbreviation must contain exactly two letters or digits']
    ] as const) {
      await (field === 'name' ? name : abbreviation).fill(value)
      if (error) await expect(dialog.getByTestId(`manage-project-${field}-error`)).toHaveText(error)
      else await expect(dialog.getByTestId(`manage-project-${field}-error`)).toHaveCount(0)
      await expect(save).toBeDisabled()
    }
    await abbreviation.fill('')
    await abbreviation.pressSequentially('rtx')
    await expect(abbreviation).toHaveValue('RT')
    await expect(dialog.getByTestId('manage-project-abbreviation-error')).toHaveCount(0)
    await name.fill('Retry Project')
    await expect(dialog.getByTestId('manage-project-name-error')).toHaveCount(0)
    await runSqlStatement(electronApp, `CREATE TRIGGER reject_project_create BEFORE INSERT ON workspace_state WHEN NEW.state_type = 'project-order' BEGIN SELECT RAISE(ABORT, 'Project create failure'); END`)
    // Main failure exercises the production optimistic rollback and staged filesystem cleanup.
    await save.click()
    await expect(dialog.getByTestId('management-dialog-error')).toHaveText('Failed to save project changes. Please try again.')
    await expect.poll(() => testSetup.getRendererErrors().some((error) => error.message.includes('Project create failure'))).toBe(true)
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveCount(1)
    expect(await checkFileExists(electronApp, `${path}/RetryProject`)).toBe(false)
    await runSqlStatement(electronApp, 'DROP TRIGGER reject_project_create')
    testSetup.removeRendererErrorsContaining('Project create failure')
    // The dialog keeps the stable draft, so saving again creates its starter collections.
    await save.click()
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['DE', 'RT'])
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
    // New projects append without disturbing existing or discovered positions.
    await mainWindow.getByTestId('new-project-button').click()
    await fillProject(mainWindow, 'Fresh Project', 'FP')
    await projectDialog(mainWindow).getByTestId('manage-projects-save-button').click()
    await expect(projectDialog(mainWindow)).toHaveCount(0)
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['DE', 'AL', 'ZE', 'FP'])
    /** Generated identity of the project created through the dialog. */
    const createdId = JSON.parse(await readTextFile(electronApp, `${path}/FreshProject/ProjectInfo.json`)).id
    // Dragging Zeta above the first project button saves the new order on drop.
    await beginPointerDrag(mainWindow, projectButtonSelector('Zeta'))
    await moveActiveDragToTarget(mainWindow, projectButtonSelector('Default Project'))
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readWorkspaceState(electronApp, createDeterministicId(path), 'project-order', null))
      .toEqual({ ids: [zetaId, defaultId, alphaId, createdId] })
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['ZE', 'DE', 'AL', 'FP'])
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await testHelpers.setupWorkspaceViaUI()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['ZE', 'DE', 'AL', 'FP'])
    expect(await readWorkspaceState(electronApp, createDeterministicId(path), 'project-order', null)).toEqual({ ids: [zetaId, defaultId, alphaId, createdId] })
    // Removing the selected project returns Home and removes only its own content.
    await mainWindow.getByRole('button', { name: 'Zeta', exact: true }).click()
    await mainWindow.getByTestId('sidebar-manage-projects-button').click()
    await deleteProject(mainWindow, zetaId)
    await projectDialog(mainWindow).getByTestId('manage-projects-save-button').click()
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['DE', 'AL', 'FP'])
    expect(await checkFileExists(electronApp, `${path}/Zeta`)).toBe(false)
    expect(await checkFileExists(electronApp, `${path}/DefaultProject/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(true)
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Keep Me')
  })

  test('saves mixed project changes, swaps names, and reuses deleted directories without changing selection', async ({ testSetup, electronApp }) => {
    /** Identical relative content paths in different projects expose accidental cross-project deletion. */
    const path = '/ws/project-batch'
    /** Fixture identities own the private preference rows. */
    const workspaceId = createDeterministicId(path)
    /** Selected project whose content moves into the Second directory. */
    const defaultId = createDeterministicId(`${path}:DefaultProject`)
    await testSetup.setupFilesystem(batchWorkspaceFiles(path))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Real selected content stays mounted while its project directory changes. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    /** Byte-for-byte comparisons verify that project renames do not rewrite content. */
    const original = await readTextFile(electronApp, `${path}/DefaultProject/Prompts/Tasks/Active/Keep Me.prompt.md`)
    /** Second project owns a different prompt at the same relative filename. */
    const second = await readTextFile(electronApp, `${path}/Second/Prompts/Tasks/Active/Keep Me.prompt.md`)
    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    await mainWindow.getByTestId('sidebar-collection-favorite-all-tasks').click()
    await mainWindow.keyboard.press('Escape')
    // One save mixes two swaps, one confirmed deletion, two creations, and a discarded draft.
    await mainWindow.getByTestId('sidebar-manage-projects-button').click()
    /** Manage Projects dialog opened to the selected project. */
    const dialog = projectDialog(mainWindow)
    await expect(dialog.getByTestId(`manage-project-selector-${defaultId}`)).toHaveAttribute('aria-pressed', 'true')
    await fillProject(mainWindow, 'Second', 'S2')
    await expect(dialog.getByTestId('manage-project-name-error')).toHaveText('A project with this name already exists')
    await expect(dialog.getByTestId('manage-projects-save-button')).toBeDisabled()
    await dialog.getByTestId('manage-project-selector-second').click()
    await fillProject(mainWindow, 'Default Project', 'DE')
    await deleteProject(mainWindow, 'removed')
    for (const [name, abbreviation] of [['Removed', 'RM'], ['Extra', 'EX']]) {
      await dialog.getByTestId('manage-projects-new-button').click()
      await fillProject(mainWindow, name, abbreviation)
    }
    // New drafts are discarded without a confirmation.
    await dialog.getByTestId('manage-projects-new-button').click()
    await dialog.getByTestId('manage-projects-delete-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Delete Project' })).toHaveCount(0)
    await expect(dialog.locator(projectSelectorItems)).toHaveText([/Second\s*2 collections/, /Default Project\s*1 collection(?!s)/, /Removed\s*2 collections/, /Extra\s*2 collections/])
    /** Stable identity allocated for the draft that reuses the deleted directory. */
    const replacementId = (await dialog.locator(projectSelectorItems).nth(2).getAttribute('data-testid'))!.replace('manage-project-selector-', '')
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Second')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Keep Me')
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['S2', 'DE', 'RM', 'EX'])
    expect(await readTextFile(electronApp, `${path}/Second/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(original)
    expect(await readTextFile(electronApp, `${path}/DefaultProject/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(second)
    expect(JSON.parse(await readTextFile(electronApp, `${path}/Removed/ProjectInfo.json`)).id).toBe(replacementId)
    expect(await checkFileExists(electronApp, `${path}/Removed/Prompts/Tasks`)).toBe(false)
    expect(await checkFileExists(electronApp, `${path}/Removed/Prompts/MyPrompts/_CollectionInfo.json`)).toBe(true)
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-order', 'removed')).toBeNull()
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-favorites', defaultId)).toEqual({ ids: ['tasks'] })
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    await testHelpers.setupWorkspaceViaUI()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['S2', 'DE', 'RM', 'EX'])
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    // Delete the other populated project and rename the selected project into its old directory.
    await mainWindow.getByTestId('sidebar-manage-projects-button').click()
    await deleteProject(mainWindow, defaultId)
    await dialog.getByTestId('manage-project-selector-second').click()
    await fillProject(mainWindow, 'Second', 'S2')
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Second')
    expect(await readTextFile(electronApp, `${path}/Second/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(second)
    await mainWindow.evaluate(() => window.playwrightTestControls!.notes.renameOwner('prompt', 'second-task', 'After Batch'))
    expect(await checkFileExists(electronApp, `${path}/Second/Prompts/Tasks/Active/After Batch.prompt.md`)).toBe(true)
  })

  test('reorders projects with Manage Projects drag handles without changing the selected draft', async ({ testSetup, electronApp }) => {
    /** Three saved projects give the dragged row more than one destination. */
    const path = '/ws/project-dialog-reorder'
    /** Fixture identity owning the private project order. */
    const workspaceId = createDeterministicId(path)
    /** Selected project whose editor must stay open while another row moves. */
    const defaultId = createDeterministicId(`${path}:DefaultProject`)
    await testSetup.setupFilesystem(batchWorkspaceFiles(path))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Real dialog rows are dragged with the mouse. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await mainWindow.getByTestId('sidebar-manage-projects-button').click()
    /** Manage Projects dialog opened to the selected project. */
    const dialog = projectDialog(mainWindow)
    /** Row dragged above the selected project. */
    const secondRow = dialog.getByTestId('manage-project-selector-second')
    await expect(dialog.locator(projectSelectorItems)).toHaveText([/Default Project/, /Removed/, /Second/])
    await expect(dialog.getByTestId('manage-projects-save-button')).toBeDisabled()
    await dialog.getByTestId('manage-projects-drag-handle-second').hover()
    await expect(dialog.getByTestId('manage-projects-drag-handle-second')).toHaveCSS('cursor', 'grab')
    // Dragging previews the new order live with the Show All dragged-row styling and no ghost.
    await watchTextSelectionStarts(mainWindow)
    await beginPointerDrag(mainWindow, '[data-testid="manage-project-selector-second"]')
    await expect(secondRow).toHaveAttribute('data-row-state', 'dragging')
    await expect(secondRow).toHaveCSS('background-color', await resolvePaletteColor(mainWindow.locator('body'), '--ui-info-normal-surface'))
    await expect(secondRow).toHaveCSS('border-top-color', await resolvePaletteColor(mainWindow.locator('body'), '--ui-info-muted-border'))
    await expect(mainWindow.locator(dragGhostSelector)).toHaveCount(0)
    await moveActiveDragToTarget(mainWindow, `[data-testid="manage-project-selector-${defaultId}"]`)
    await expect(dialog.locator(projectSelectorItems)).toHaveText([/Second/, /Default Project/, /Removed/])
    await expect(dialog.getByTestId(`manage-project-selector-${defaultId}`)).toHaveAttribute('data-row-state', 'drag-active')
    await expect(dialog.getByTestId('manage-project-selector-removed')).toHaveAttribute('data-row-state', 'drag-idle')
    await finishActiveDrag(mainWindow)
    // The drop keeps the selected draft, highlights no text, and waits for Save Changes.
    expect(await didStartTextSelection(mainWindow)).toBe(false)
    await expect(secondRow).toHaveAttribute('aria-pressed', 'false')
    await expect(dialog.getByTestId(`manage-project-selector-${defaultId}`)).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByTestId('manage-project-name-input')).toHaveValue('Default Project')
    await expect(dialog.getByTestId('manage-projects-save-button')).toBeEnabled()
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['DE', 'RM', 'S2'])
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['S2', 'DE', 'RM'])
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Default Project')
    await expect.poll(() => readWorkspaceState(electronApp, workspaceId, 'project-order', null))
      .toEqual({ ids: ['second', defaultId, 'removed'] })
    // Dragging from the handle works too, and closing discards the unsaved reorder.
    await mainWindow.getByTestId('sidebar-manage-projects-button').click()
    await beginPointerDrag(mainWindow, '[data-testid="manage-projects-drag-handle-removed"]')
    await moveActiveDragToTarget(mainWindow, '[data-testid="manage-project-selector-second"]')
    await finishActiveDrag(mainWindow)
    await expect(dialog.locator(projectSelectorItems)).toHaveText([/Removed/, /Second/, /Default Project/])
    await dialog.getByTestId('manage-projects-close-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['S2', 'DE', 'RM'])
    await mainWindow.getByTestId('sidebar-manage-projects-button').click()
    await expect(dialog.locator(projectSelectorItems)).toHaveText([/Second/, /Default Project/, /Removed/])
    expect(await readWorkspaceState(electronApp, workspaceId, 'project-order', null)).toEqual({ ids: ['second', defaultId, 'removed'] })
  })

  test('reorders activity bar projects by dragging without selecting the dragged project', async ({ testSetup, electronApp }) => {
    /** Three saved projects give the dragged button more than one destination. */
    const path = '/ws/project-rail-reorder'
    /** Fixture identity owning the private project order. */
    const workspaceId = createDeterministicId(path)
    /** Selected project that must stay active while other buttons move. */
    const defaultId = createDeterministicId(`${path}:DefaultProject`)
    await testSetup.setupFilesystem(batchWorkspaceFiles(path))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** Real rail buttons are dragged with the mouse. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Default Project')
    /** Project buttons in rail order, identified by abbreviation. */
    const rail = mainWindow.getByTestId('nav-button-project')
    /** Button dragged above the selected project. */
    const secondButton = mainWindow.locator(projectButtonSelector('Second'))
    await expect(rail).toHaveText(['DE', 'RM', 'S2'])
    // Dragging previews the new order live with the Show All dragged-row fill and no ghost.
    await watchTextSelectionStarts(mainWindow)
    await beginPointerDrag(mainWindow, projectButtonSelector('Second'))
    await expect(secondButton).toHaveAttribute('data-dragging', 'true')
    await expect(secondButton).toHaveCSS('background-color', await resolvePaletteColor(mainWindow.locator('body'), '--ui-info-normal-surface'))
    await expect(mainWindow.locator(dragGhostSelector)).toHaveCount(0)
    await moveActiveDragToTarget(mainWindow, projectButtonSelector('Default Project'))
    await expect(rail).toHaveText(['S2', 'DE', 'RM'])
    expect(await readWorkspaceState(electronApp, workspaceId, 'project-order', null)).toEqual({ ids: [defaultId, 'removed', 'second'] })
    await finishActiveDrag(mainWindow)
    // The drop saves immediately without highlighting text or switching to the dragged project.
    expect(await didStartTextSelection(mainWindow)).toBe(false)
    await expect.poll(() => readWorkspaceState(electronApp, workspaceId, 'project-order', null))
      .toEqual({ ids: ['second', defaultId, 'removed'] })
    await expect(rail).toHaveText(['S2', 'DE', 'RM'])
    await expect(secondButton).toHaveAttribute('data-dragging', 'false')
    await expect(secondButton).toHaveAttribute('data-active', 'false')
    await expect(mainWindow.locator(projectButtonSelector('Default Project'))).toHaveAttribute('data-active', 'true')
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Default Project')
    // Leaving the project list restores the original order, so the drop saves nothing.
    await beginPointerDrag(mainWindow, projectButtonSelector('Removed'))
    await moveActiveDragToTarget(mainWindow, projectButtonSelector('Second'))
    await expect(rail).toHaveText(['RM', 'S2', 'DE'])
    await moveActiveDragToTarget(mainWindow, '[data-testid="sidebar-title"]')
    await expect(rail).toHaveText(['S2', 'DE', 'RM'])
    await finishActiveDrag(mainWindow)
    await expect(rail).toHaveText(['S2', 'DE', 'RM'])
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Default Project')
    expect(await readWorkspaceState(electronApp, workspaceId, 'project-order', null)).toEqual({ ids: ['second', defaultId, 'removed'] })
  })

  test('rejects malformed batch IPC payloads, invalid metadata, and duplicate retained identities without changing projects', async ({ testSetup }) => {
    /** Direct IPC verifies main validation independently of the renderer wrapper. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal' } })
    /** Original workspace supplies real owned identities for otherwise malformed commands. */
    const before = await mainWindow.evaluate(() => window.playwrightTestControls!.projects.getWorkspace()!)
    /** Exact public fields accepted for an existing project. */
    const project = { id: before.projects[0].id, name: 'Default Project', abbreviation: 'DE' }
    for (const command of [
      { workspaceId: before.id, projects: [], extra: true },
      { workspaceId: before.id, projects: [{ project }] },
      { workspaceId: before.id, projects: [{ project: { ...project, folderName: 'Injected' }, starterCollections: null }] },
      { workspaceId: before.id, projects: [{ project, starterCollections: { promptCollectionId: 'p' } }] },
      { workspaceId: before.id, projects: [{ project, starterCollections: { promptCollectionId: 'p', templateCollectionId: 't', extra: true } }] }
    ]) {
      /** The real handler must reject the entire command before planning or persisting. */
      const result = await mainWindow.evaluate((command) => window.electron.ipcRenderer.invoke('save-projects', {
        requestId: crypto.randomUUID(), clientId: window.ipcClientId, payload: { command, expectations: [] }
      }), command)
      expect(result).toMatchObject({ success: false, error: 'Invalid request payload' })
    }
    // Invalid metadata and duplicate retained IDs must fail in the planner before any optimistic project change.
    for (const [projects, expected] of [
      [[project, { id: 'invalid-project', name: 'default project', abbreviation: 'XY' }], 'A project with this name already exists'],
      [[project, { id: 'invalid-project', name: 'Another', abbreviation: 'de' }], 'A project with this abbreviation already exists'],
      [[project, { id: 'invalid-project', name: 'Another', abbreviation: 'ABC' }], 'Project abbreviation must contain exactly two letters or digits'],
      [[project, { id: 'invalid-project', name: 'Bad/Name', abbreviation: 'XY' }], 'Project name contains illegal characters'],
      [[project, project], 'Duplicate project identity']
    ] as const) {
      /** Wrapper validation uses the same deterministic planner as main. */
      const error = await mainWindow.evaluate(async (projects) => {
        /** Production command API reached only by Playwright for data the dialog cannot submit. */
        const api = window.playwrightTestControls!.projects
        try { await api.saveProjects(api.getWorkspace()!.id, [...projects]); return null }
        catch (error) { return String(error) }
      }, projects)
      expect(error).toContain(expected)
    }
    expect(await mainWindow.evaluate(() => window.playwrightTestControls!.projects.getWorkspace()!)).toEqual(before)
  })

  test('restores every project after a mixed dialog save fails during final directory publication and can retry', async ({ testSetup, electronApp }) => {
    /** Late failure occurs after existing projects have been renamed and another deleted. */
    const path = '/ws/project-batch-rollback'
    await testSetup.setupFilesystem(batchWorkspaceFiles(path))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
    /** A selected project verifies optimistic rollback as well as disk restoration. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    /** Complete opening renderer graph must be restored on rejection. */
    const before = await mainWindow.evaluate(() => window.playwrightTestControls!.projects.getWorkspace()!)
    /** Original content remains owned by its original identity after rollback. */
    const original = await readTextFile(electronApp, `${path}/DefaultProject/Prompts/Tasks/Active/Keep Me.prompt.md`)
    /** The other swapped directory must also be restored, with different bytes at the same relative path. */
    const second = await readTextFile(electronApp, `${path}/Second/Prompts/Tasks/Active/Keep Me.prompt.md`)
    /** Deleted child content must be restored alongside its project directory. */
    const removed = await readTextFile(electronApp, `${path}/Removed/Prompts/Tasks/Active/Removed Content.prompt.md`)
    /** Public metadata is written before renames and must also roll back byte-for-byte. */
    const metadata = await Promise.all(['DefaultProject', 'Second', 'Removed'].map((folder) =>
      readTextFile(electronApp, `${path}/${folder}/ProjectInfo.json`)))
    /** Deleted project preferences must survive the failed transaction. */
    const removedOrder = await readWorkspaceState(electronApp, before.id, 'collection-order', 'removed')
    // Two swaps, one confirmed deletion, and a replacement for the deleted directory are staged together.
    await mainWindow.getByTestId('sidebar-manage-projects-button').click()
    /** Manage Projects dialog that keeps its drafts across the failed save. */
    const dialog = projectDialog(mainWindow)
    await fillProject(mainWindow, 'Second', 'S2')
    await dialog.getByTestId('manage-project-selector-second').click()
    await fillProject(mainWindow, 'Default Project', 'DE')
    await deleteProject(mainWindow, 'removed')
    await dialog.getByTestId('manage-projects-new-button').click()
    await fillProject(mainWindow, 'Removed', 'RM')
    /** Stable identity allocated for the replacement draft. */
    const replacementId = (await dialog.locator(projectSelectorItems).last().getAttribute('data-testid'))!.replace('manage-project-selector-', '')
    await electronApp.evaluate(({ app }, target) => app.emit('test-fail-file-commit', target), `${path}/Removed`)
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog.getByTestId('management-dialog-error')).toHaveText('Failed to save project changes. Please try again.')
    await expect.poll(() => testSetup.getRendererErrors().some((error) => error.message.includes('Injected file commit failure'))).toBe(true)
    testSetup.removeRendererErrorsContaining('Injected file commit failure')
    expect(await mainWindow.evaluate(() => window.playwrightTestControls!.projects.getWorkspace()!)).toEqual(before)
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Default Project')
    expect(await readTextFile(electronApp, `${path}/DefaultProject/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(original)
    expect(await readTextFile(electronApp, `${path}/Second/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(second)
    expect(JSON.parse(await readTextFile(electronApp, `${path}/Removed/ProjectInfo.json`)).id).toBe('removed')
    expect(await readTextFile(electronApp, `${path}/Removed/Prompts/Tasks/Active/Removed Content.prompt.md`)).toBe(removed)
    expect(await Promise.all(['DefaultProject', 'Second', 'Removed'].map((folder) =>
      readTextFile(electronApp, `${path}/${folder}/ProjectInfo.json`)))).toEqual(metadata)
    expect(await readWorkspaceState(electronApp, before.id, 'collection-order', 'removed')).toEqual(removedOrder)
    expect(await readWorkspaceState(electronApp, before.id, 'project-order', null)).toEqual({ ids: before.projects.map((project) => project.id) })
    expect(await readWorkspaceState(electronApp, before.id, 'collection-order', replacementId)).toBeNull()
    // The dialog keeps every draft, so saving again retries the same batch.
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Second')
    expect(await readTextFile(electronApp, `${path}/Second/Prompts/Tasks/Active/Keep Me.prompt.md`)).toBe(original)
    expect(JSON.parse(await readTextFile(electronApp, `${path}/Removed/ProjectInfo.json`)).id).toBe(replacementId)
  })
})
