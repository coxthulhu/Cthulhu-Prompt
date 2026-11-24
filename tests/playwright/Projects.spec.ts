import { findProject, readRecord, rows, projectPrompt } from '../helpers/WorkspaceDatabaseHelpers'
import { showCollectionBrowser } from '../helpers/PromptCollectionHelpers'
import type { Page } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { readWorkspaceState, runSqlStatement, seedWorkspaceState, toSqlText } from '../helpers/UserPersistenceHelpers'
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

/** Opens project settings from the New Tab project heading. */
const openProjectSettings = async (page: Page, projectId?: string): Promise<void> => {
  if (!await page.getByTestId('new-tab-screen').isVisible()) await page.getByTestId('new-tab-button').click()
  await (projectId ? page.getByTestId(`new-tab-edit-project-${projectId}`) : page.locator('[data-testid^="new-tab-edit-project-"]').first()).click()
}
/** Creates a new project using the workspace browser. */
const openNewProject = async (page: Page): Promise<void> => {
  await showCollectionBrowser(page)
  await page.getByTestId('new-tab-new-project-button').click()
}
/** Project names in the browser's persisted order. */
const projectNames = (page: Page) => page.locator('[data-testid^="new-tab-project-title-"]')

/** Locates one activity bar project button, since every project button shares one test ID. */
const projectButtonSelector = (name: string): string => `[data-testid^="new-tab-project-title-"][aria-label="Reorder ${name}"]`

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
  test('creates a project, isolates collection names, and restores tabs across workspace switches', async ({ testSetup, electronApp }) => {
    /** Two workspaces exercise both double-click transitions. */
    const path = '/ws/project-isolation'
    /** Other workspace must retain its own fresh New Tab. */
    const otherPath = `${path}-other`
    await testSetup.setupFilesystem({ ...workspaceFiles(path), ...workspaceFiles(otherPath) })
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    /** Real New Tab controls manage the new project and collection. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Templates')
    await mainWindow.getByTestId('new-tab-button').click()
    await openNewProject(mainWindow)
    await fillProject(mainWindow, 'Second Project', 's2')
    await projectDialog(mainWindow).getByTestId('manage-project-short-description-input').fill(' Short ')
    await focusMonacoEditor(mainWindow, '[data-testid="manage-project-full-description-input"]')
    await mainWindow.keyboard.insertText('Full')
    await projectDialog(mainWindow).getByTestId('manage-projects-save-button').click()
    await expect(projectDialog(mainWindow)).toHaveCount(0)
    /** Created metadata identifies the correct project-specific create control. */
    const info = (await findProject(electronApp, 'SecondProject'))!
    expect(info).toMatchObject({ id: expect.stringMatching(/^[a-f0-9]{32}$/i), name: 'Second Project', abbreviation: 'S2', shortDescription: 'Short', description: 'Full' })
    await mainWindow.getByTestId(`new-tab-new-collection-${info.id}`).click()
    await mainWindow.getByTestId('create-prompt-collection-name-input').fill('Tasks')
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await mainWindow.getByTestId(`new-tab-project-${info.id}`).locator('[data-testid^="new-tab-collection-"]').filter({ has: mainWindow.getByText('Tasks', { exact: true }) }).click()
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Tasks')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveCount(0)
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveText(['Templates', 'Tasks'])
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(otherPath))
    await testHelpers.setupWorkspaceViaUI()
    await expect(mainWindow.getByTestId('new-tab-workspace-title')).toHaveText('project-isolation-other')
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    await testHelpers.setupWorkspaceViaUI()
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveText(['Templates', 'Tasks'])
    await mainWindow.getByTestId('work-tab').getByRole('tab', { name: 'Tasks' }).click()
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Tasks')
    await mainWindow.getByTestId('work-tab').getByRole('tab').first().click()
    await expect(mainWindow.getByTestId('sidebar-title')).toHaveText('Templates')
  })

  test('renames a project from the sidebar gear and deletes the final project after confirmation', async ({ testSetup, electronApp }) => {
    /** Content bytes and filenames must survive the parent-directory rename. */
    const path = '/ws/project-lifecycle'
    /** Fixture identities own the private preference rows. */
    const workspaceId = createDeterministicId(path)
    /** Stable identity preserved by renaming and removed by deletion. */
    const projectId = createDeterministicId(`${path}:DefaultProject`)
    await testSetup.setupFilesystem(workspaceFiles(path))
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    /** Real selected editors are mounted while the parent project changes. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await showCollectionBrowser(mainWindow)
    await mainWindow.getByTestId('new-tab-collection-tasks').click()
    /** Original bytes include identity and timestamps in front matter. */
    const original = await projectPrompt(electronApp, 'DefaultProject', 'Keep Me')
    // The gear immediately follows the title and opens settings to the shown project.
        await openProjectSettings(mainWindow, projectId)
    /** Manage Projects dialog opened by the sidebar gear. */
    const dialog = projectDialog(mainWindow)
    await expect(dialog.getByTestId(`manage-project-selector-${projectId}`)).toHaveAttribute('aria-pressed', 'true')
    await fillProject(mainWindow, 'Renamed Project', 'rp')
    await expect(dialog.getByTestId('manage-project-abbreviation-input')).toHaveValue('RP')
    await focusMonacoEditor(mainWindow, '[data-testid="manage-project-full-description-input"]')
    await mainWindow.keyboard.insertText('New description')
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(projectNames(mainWindow)).toHaveText('Renamed Project')
    await expect(projectNames(mainWindow)).toHaveText('Renamed Project')
    expect((await findProject(electronApp, 'RenamedProject'))!).toMatchObject({ id: projectId, name: 'Renamed Project', abbreviation: 'RP', description: 'New description' })
    expect(await projectPrompt(electronApp, 'RenamedProject', 'Keep Me')).toEqual(original)
    expect(await findProject(electronApp, 'DefaultProject').then(Boolean)).toBe(false)
    // A subsequent editor command must use the relocated persistence path.
    await mainWindow.evaluate(() => window.playwrightTestControls!.notes.renameOwner('prompt', 'task', 'After Rename'))
    expect(await projectPrompt(electronApp, 'RenamedProject', 'After Rename').then(Boolean)).toBe(true)
    // Deleting a saved project requires the acknowledgement and waits for Save.
    await openProjectSettings(mainWindow, projectId)
    await dialog.getByTestId('manage-projects-delete-button').click()
    /** Destructive confirmation shown above Manage Projects. */
    const confirmation = mainWindow.getByRole('dialog', { name: 'Delete Project' })
    await expect(confirmation.getByTestId('manage-projects-confirm-delete-button')).toBeDisabled()
    await confirmation.getByRole('checkbox').check()
    await confirmation.getByTestId('manage-projects-confirm-delete-button').click()
    await expect(confirmation).toHaveCount(0)
    await expect(dialog.locator(projectSelectorItems)).toHaveCount(0)
    expect(await findProject(electronApp, 'RenamedProject').then(Boolean)).toBe(true)
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(projectNames(mainWindow)).toHaveCount(0)
    expect(await findProject(electronApp, 'RenamedProject').then(Boolean)).toBe(false)
    expect(await rows(electronApp, 'SELECT id FROM content.workspace')).toHaveLength(1)
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-order', projectId)).toBeNull()
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-favorites', projectId)).toBeNull()
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    await testHelpers.setupWorkspaceViaUI()
    await showCollectionBrowser(mainWindow)
    await expect(projectNames(mainWindow)).toHaveCount(0)
    expect(await findProject(electronApp, 'DefaultProject').then(Boolean)).toBe(false)
  })

  test('validates project fields in the dialog and retries a draft after a failed SQLite write', async ({ testSetup, electronApp }) => {
    /** The original project remains selectable after each rejected operation. */
    const path = '/ws/project-validation'
    /** Minimal fixture starts with a persisted but empty default project. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'minimal', path } })
    await openNewProject(mainWindow)
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
    await expect(projectNames(mainWindow)).toHaveCount(1)
    expect(await findProject(electronApp, 'RetryProject').then(Boolean)).toBe(false)
    await runSqlStatement(electronApp, 'DROP TRIGGER reject_project_create')
    testSetup.removeRendererErrorsContaining('Project create failure')
    // The dialog keeps the stable draft, so saving again creates its starter collections.
    await save.click()
    await expect(dialog).toHaveCount(0)
    await expect(projectNames(mainWindow)).toHaveText(['Default Project', 'Retry Project'])
    await expect(projectNames(mainWindow).last()).toHaveText('Retry Project')
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
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    /** Existing rail and template picker provide user-visible evidence of the persisted graph. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await expect(projectNames(mainWindow)).toHaveText(['Default Project', 'Alpha', 'Zeta'])
    await showCollectionBrowser(mainWindow)
    await mainWindow.getByTestId('new-tab-collection-tasks').click()
    await mainWindow.getByTestId('prompt-template-button').click()
    await expect(mainWindow.getByTestId('prompt-tree-template-prompt-wrapper')).toBeVisible()
    await mainWindow.getByTestId('prompt-tree-template-prompt-wrapper').click()
    await mainWindow.getByTestId('prompt-template-confirm-button').click()
    await expect.poll(async () => (await readRecord(electronApp, 'prompt', 'task'))?.templates).toEqual([{ id: 'wrapper' }])
    // New projects append without disturbing existing or discovered positions.
    await openNewProject(mainWindow)
    await fillProject(mainWindow, 'Fresh Project', 'FP')
    await projectDialog(mainWindow).getByTestId('manage-projects-save-button').click()
    await expect(projectDialog(mainWindow)).toHaveCount(0)
    await expect(projectNames(mainWindow)).toHaveText(['Default Project', 'Alpha', 'Zeta', 'Fresh Project'])
    /** Generated identity of the project created through the dialog. */
    const createdId = (await findProject(electronApp, 'FreshProject'))!.id
    // Dragging Zeta above the first project button saves the new order on drop.
    await beginPointerDrag(mainWindow, projectButtonSelector('Zeta'))
    await moveActiveDragToTarget(mainWindow, projectButtonSelector('Default Project'))
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readWorkspaceState(electronApp, createDeterministicId(path), 'project-order', null))
      .toEqual({ ids: [zetaId, defaultId, alphaId, createdId] })
    await expect(projectNames(mainWindow)).toHaveText(['Zeta', 'Default Project', 'Alpha', 'Fresh Project'])
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    await testHelpers.setupWorkspaceViaUI()
    await showCollectionBrowser(mainWindow)
    await expect(projectNames(mainWindow)).toHaveText(['Zeta', 'Default Project', 'Alpha', 'Fresh Project'])
    expect(await readWorkspaceState(electronApp, createDeterministicId(path), 'project-order', null)).toEqual({ ids: [zetaId, defaultId, alphaId, createdId] })
    // Removing the selected project returns Home and removes only its own content.
    await openProjectSettings(mainWindow, zetaId)
    await deleteProject(mainWindow, zetaId)
    await projectDialog(mainWindow).getByTestId('manage-projects-save-button').click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(projectNames(mainWindow)).toHaveText(['Default Project', 'Alpha', 'Fresh Project'])
    expect(await findProject(electronApp, 'Zeta').then(Boolean)).toBe(false)
    expect(await projectPrompt(electronApp, 'DefaultProject', 'Keep Me').then(Boolean)).toBe(true)
    await showCollectionBrowser(mainWindow)
    await mainWindow.getByTestId('new-tab-collection-tasks').click()
    await expect(mainWindow.getByRole('tab', { selected: true })).toHaveText('Tasks')
  })

  test('saves mixed project changes, swaps names, and reuses deleted directories without changing selection', async ({ testSetup, electronApp }) => {
    /** Identical relative content paths in different projects expose accidental cross-project deletion. */
    const path = '/ws/project-batch'
    /** Fixture identities own the private preference rows. */
    const workspaceId = createDeterministicId(path)
    /** Selected project whose content moves into the Second directory. */
    const defaultId = createDeterministicId(`${path}:DefaultProject`)
    await testSetup.setupFilesystem(batchWorkspaceFiles(path))
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    /** Real selected content stays mounted while its project directory changes. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await showCollectionBrowser(mainWindow)
    await mainWindow.getByTestId('new-tab-collection-tasks').click()
    /** Byte-for-byte comparisons verify that project renames do not rewrite content. */
    const original = await projectPrompt(electronApp, 'DefaultProject', 'Keep Me')
    /** Second project owns a different prompt at the same relative filename. */
    const second = await projectPrompt(electronApp, 'Second', 'Keep Me')
    // One save mixes two swaps, one confirmed deletion, two creations, and a discarded draft.
    await openProjectSettings(mainWindow, defaultId)
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
    await expect(dialog.locator(projectSelectorItems)).toHaveText([/Second\s*3 collections/, /Default Project\s*2 collections/, /Removed\s*3 collections/, /Extra\s*3 collections/])
    /** Stable identity allocated for the draft that reuses the deleted directory. */
    const replacementId = (await dialog.locator(projectSelectorItems).nth(2).getAttribute('data-testid'))!.replace('manage-project-selector-', '')
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(projectNames(mainWindow).filter({ hasText: /Second/ })).toBeVisible()
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab').first()).toHaveText('Tasks')
    await expect(projectNames(mainWindow)).toHaveText(['Second', 'Default Project', 'Removed', 'Extra'])
    expect(await projectPrompt(electronApp, 'Second', 'Keep Me')).toEqual(original)
    expect(await projectPrompt(electronApp, 'DefaultProject', 'Keep Me')).toEqual(second)
    expect((await findProject(electronApp, 'Removed'))!.id).toBe(replacementId)
    expect(await readRecord(electronApp, 'promptCollection', 'removed-tasks').then(Boolean)).toBe(false)
    expect(await rows(electronApp, `SELECT json_extract(data, '$.displayName') AS name FROM content.records
      JOIN content.project_collections ON collection_id = id WHERE kind = 'promptCollection' AND project_id = ${toSqlText(replacementId)} ORDER BY name`))
      .toEqual([{ name: 'My Prompts' }, { name: 'My Routines' }, { name: 'My Templates' }])
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-order', 'removed')).toBeNull()
    expect(await readWorkspaceState(electronApp, workspaceId, 'collection-favorites', defaultId)).toBeNull()
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    await testHelpers.setupWorkspaceViaUI()
    await showCollectionBrowser(mainWindow)
    await expect(projectNames(mainWindow)).toHaveText(['Second', 'Default Project', 'Removed', 'Extra'])
    await showCollectionBrowser(mainWindow)
    await mainWindow.getByTestId('new-tab-collection-second-tasks').click()
    // Delete the other populated project and rename the selected project into its old directory.
    await openProjectSettings(mainWindow, 'second')
    await deleteProject(mainWindow, defaultId)
    await dialog.getByTestId('manage-project-selector-second').click()
    await fillProject(mainWindow, 'Second', 'S2')
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(projectNames(mainWindow).filter({ hasText: /Second/ })).toBeVisible()
    expect(await projectPrompt(electronApp, 'Second', 'Keep Me')).toEqual(second)
    await mainWindow.evaluate(() => window.playwrightTestControls!.notes.renameOwner('prompt', 'second-task', 'After Batch'))
    expect(await projectPrompt(electronApp, 'Second', 'After Batch').then(Boolean)).toBe(true)
  })

  test('reorders projects with Manage Projects drag handles without changing the selected draft', async ({ testSetup, electronApp }) => {
    /** Three saved projects give the dragged row more than one destination. */
    const path = '/ws/project-dialog-reorder'
    /** Fixture identity owning the private project order. */
    const workspaceId = createDeterministicId(path)
    /** Selected project whose editor must stay open while another row moves. */
    const defaultId = createDeterministicId(`${path}:DefaultProject`)
    await testSetup.setupFilesystem(batchWorkspaceFiles(path))
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    /** Real dialog rows are dragged with the mouse. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await showCollectionBrowser(mainWindow)
    await mainWindow.getByTestId('new-tab-collection-tasks').click()
    await openProjectSettings(mainWindow, defaultId)
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
    await expect(projectNames(mainWindow)).toHaveText(['Default Project', 'Removed', 'Second'])
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(projectNames(mainWindow)).toHaveText(['Second', 'Default Project', 'Removed'])
    await expect(projectNames(mainWindow).filter({ hasText: /Default Project/ })).toBeVisible()
    await expect.poll(() => readWorkspaceState(electronApp, workspaceId, 'project-order', null))
      .toEqual({ ids: ['second', defaultId, 'removed'] })
    // Dragging from the handle works too, and closing discards the unsaved reorder.
    await openProjectSettings(mainWindow, defaultId)
    await beginPointerDrag(mainWindow, '[data-testid="manage-projects-drag-handle-removed"]')
    await moveActiveDragToTarget(mainWindow, '[data-testid="manage-project-selector-second"]')
    await finishActiveDrag(mainWindow)
    await expect(dialog.locator(projectSelectorItems)).toHaveText([/Removed/, /Second/, /Default Project/])
    await dialog.getByTestId('manage-projects-close-button').click()
    await mainWindow.getByTestId('management-dialog-discard-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(projectNames(mainWindow)).toHaveText(['Second', 'Default Project', 'Removed'])
    await openProjectSettings(mainWindow, defaultId)
    await expect(dialog.locator(projectSelectorItems)).toHaveText([/Second/, /Default Project/, /Removed/])
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

  test('restores every project after a mixed dialog save fails during a database write and can retry', async ({ testSetup, electronApp }) => {
    /** Late failure occurs after existing projects have been renamed and another deleted. */
    const path = '/ws/project-batch-rollback'
    await testSetup.setupFilesystem(batchWorkspaceFiles(path))
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    /** A selected project verifies optimistic rollback as well as disk restoration. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await showCollectionBrowser(mainWindow)
    await mainWindow.getByTestId('new-tab-collection-tasks').click()
    /** Complete opening renderer graph must be restored on rejection. */
    const before = await mainWindow.evaluate(() => window.playwrightTestControls!.projects.getWorkspace()!)
    /** Original content remains owned by its original identity after rollback. */
    const original = await projectPrompt(electronApp, 'DefaultProject', 'Keep Me')
    /** The other swapped directory must also be restored, with different bytes at the same relative path. */
    const second = await projectPrompt(electronApp, 'Second', 'Keep Me')
    /** Deleted child content must be restored alongside its project directory. */
    const removed = await projectPrompt(electronApp, 'Removed', 'Removed Content')
    /** Public metadata is written before renames and must also roll back byte-for-byte. */
    const metadata = await Promise.all(['DefaultProject', 'Second', 'Removed'].map((folder) =>
      findProject(electronApp, folder)))
    /** Deleted project preferences must survive the failed transaction. */
    const removedOrder = await readWorkspaceState(electronApp, before.id, 'collection-order', 'removed')
    // Two swaps, one confirmed deletion, and a replacement for the deleted directory are staged together.
    await openProjectSettings(mainWindow, createDeterministicId(`${path}:DefaultProject`))
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
    await runSqlStatement(electronApp, "CREATE TRIGGER content.reject_project BEFORE INSERT ON projects BEGIN SELECT RAISE(ABORT, 'Injected project write failure'); END")
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog.getByTestId('management-dialog-error')).toHaveText('Failed to save project changes. Please try again.')
    await expect.poll(() => testSetup.getRendererErrors().some((error) => error.message.includes('Injected project write failure'))).toBe(true)
    testSetup.removeRendererErrorsContaining('Injected project write failure')
    expect(await mainWindow.evaluate(() => window.playwrightTestControls!.projects.getWorkspace()!)).toEqual(before)
    await expect(projectNames(mainWindow).filter({ hasText: /Default Project/ })).toBeVisible()
    expect(await projectPrompt(electronApp, 'DefaultProject', 'Keep Me')).toEqual(original)
    expect(await projectPrompt(electronApp, 'Second', 'Keep Me')).toEqual(second)
    expect((await findProject(electronApp, 'Removed'))!.id).toBe('removed')
    expect(await projectPrompt(electronApp, 'Removed', 'Removed Content')).toEqual(removed)
    expect(await Promise.all(['DefaultProject', 'Second', 'Removed'].map((folder) =>
      findProject(electronApp, folder)))).toEqual(metadata)
    expect(await readWorkspaceState(electronApp, before.id, 'collection-order', 'removed')).toEqual(removedOrder)
    expect(await readWorkspaceState(electronApp, before.id, 'project-order', null)).toEqual({ ids: before.projects.map((project) => project.id) })
    expect(await readWorkspaceState(electronApp, before.id, 'collection-order', replacementId)).toBeNull()
    await runSqlStatement(electronApp, 'DROP TRIGGER content.reject_project')
    // The dialog keeps every draft, so saving again retries the same batch.
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(projectNames(mainWindow).filter({ hasText: /Second/ })).toBeVisible()
    expect(await projectPrompt(electronApp, 'Second', 'Keep Me')).toEqual(original)
    expect((await findProject(electronApp, 'Removed'))!.id).toBe(replacementId)
  })
})
