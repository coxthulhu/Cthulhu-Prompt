import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { readClipboardText, stubClipboard } from '../helpers/ClipboardHelpers'
import { findCollection, findRecord, readOrder, readRecord, rows } from '../helpers/WorkspaceDatabaseHelpers'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { runSqlStatement } from '../helpers/UserPersistenceHelpers'
import { promptEditorSelector } from '../helpers/PromptCollectionSelectors'
import { beginPromptTreeRowDrag, finishActiveDrag, moveActiveDragToTarget } from '../helpers/PromptDragDropHelpers'
import { waitForRendererPersistence } from '../helpers/RendererCompletionHelpers'

/** Real editor and SQLite coverage for repeatable prompts. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Routine collections', () => {
  test('copies active and archived routines with templates and restores them after fullscreen archiving', async ({ testSetup, electronApp }) => {
    /** First launch supplies the bundled routine and workspace-wide template library. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    await mainWindow.getByRole('button', { name: 'Open My Prompts' }).click()
    await mainWindow.getByRole('tab', { name: 'My Routines' }).click()
    await stubClipboard(mainWindow)
    /** Persisted example supplies the expected plain clipboard text and stable editor identity. */
    const routine = (await findRecord(electronApp, 'prompt', 'title', 'Update the Changelog'))!
    /** The ordinary prompt editor renders routine-specific toolbar actions. */
    const editor = mainWindow.locator(promptEditorSelector(routine.id))
    await expect(editor.getByTestId('prompt-title')).toHaveValue('Update the Changelog')
    await expect(editor.getByTestId('prompt-status-pill')).toHaveCount(0)
    await expect(mainWindow.getByTestId('prompt-collection-backlog-filter')).toHaveCount(0)
    await expect(mainWindow.getByTestId('prompt-collection-completed-filter')).toHaveCount(0)
    await expect(editor.locator('.prompt-editor-metadata-template')).toHaveText('No template')
    for (let copy = 0; copy < 2; copy++) {
      await mainWindow.evaluate(() => navigator.clipboard.writeText(''))
      await editor.getByRole('button', { name: 'Copy routine', exact: true }).click()
      await expect.poll(() => readClipboardText(mainWindow)).toBe(routine.promptText)
    }
    await waitForRendererPersistence(mainWindow)
    expect(await readRecord(electronApp, 'prompt', routine.id)).toEqual(routine)
    await editor.getByTestId('prompt-open-button').click()
    /** Archiving from fullscreen returns to the collection after the note has been created. */
    const screen = mainWindow.getByTestId('single-prompt-screen')
    await screen.getByTestId('attached-note-button').click()
    await expect.poll(async () => (await readRecord(electronApp, 'prompt', routine.id))?.attachedNoteId).toBeTruthy()
    await screen.getByRole('button', { name: 'Archive routine', exact: true }).click()
    await expect(screen).toHaveCount(0)
    await mainWindow.getByTestId('prompt-collection-archived-filter').click()
    await expect(editor.getByTestId('prompt-title-status-indicator')).toHaveAttribute('data-status', 'Archived')
    /** Select-and-copy must apply the template without reopening the archived routine. */
    const template = (await findRecord(electronApp, 'promptTemplate', 'title', 'Example: Simple Template'))!
    await editor.getByTestId('prompt-template-button').click()
    await mainWindow.getByTestId(`prompt-tree-template-prompt-${template.id}`).dblclick()
    /** Both copy paths should yield the same wrapped text. */
    const wrapped = template.templateText.replace('[[PROMPT_TEXT]]', routine.promptText)
    await expect.poll(() => readClipboardText(mainWindow)).toBe(wrapped)
    await waitForRendererPersistence(mainWindow)
    /** Copying again must preserve even the archive timestamp and saved template choice. */
    const archived = await readRecord(electronApp, 'prompt', routine.id)
    expect(archived).toMatchObject({ status: 'Archived', templates: [{ id: template.id }], finalizedAt: expect.any(String) })
    await mainWindow.evaluate(() => navigator.clipboard.writeText(''))
    await editor.getByRole('button', { name: 'Copy routine', exact: true }).click()
    await expect.poll(() => readClipboardText(mainWindow)).toBe(wrapped)
    await waitForRendererPersistence(mainWindow)
    expect(await readRecord(electronApp, 'prompt', routine.id)).toEqual(archived)
    await editor.getByRole('button', { name: 'Restore to Active' }).click()
    await mainWindow.getByTestId('prompt-collection-active-filter').click()
    await expect(editor.getByTestId('prompt-title-status-indicator')).toHaveAttribute('data-status', 'Active')
    await mainWindow.getByTestId('prompt-divider-add-initial').click()
    /** A newly inserted blank routine is immediately copy-ready and uses immediate deletion. */
    const blank = mainWindow.locator('[data-testid^="prompt-editor-"]').filter({ has: mainWindow.getByPlaceholder('New Routine...', { exact: true }) }).last()
    await expect(blank.locator('.prompt-editor-metadata-template')).toHaveText('No template')
    await blank.getByRole('button', { name: 'Delete routine', exact: true }).click()
    await expect(mainWindow.getByPlaceholder('New Routine...', { exact: true })).toHaveCount(0)
    // Exercise the routine drag payload and the Archived header's drop target together.
    await beginPromptTreeRowDrag(mainWindow, routine.id, 'active')
    await moveActiveDragToTarget(mainWindow, '[data-testid="sidebar-prompt-status-accordion-header-archived"]')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readRecord(electronApp, 'prompt', routine.id)).toMatchObject({ status: 'Archived' })
    await mainWindow.getByTestId('prompt-collection-archived-filter').click()
    await editor.getByRole('button', { name: 'Delete routine', exact: true }).click()
    await mainWindow.getByRole('dialog', { name: 'Delete Routine' }).getByTestId('prompt-confirm-delete-button').click()
    await expect.poll(() => readRecord(electronApp, 'prompt', routine.id)).toBeNull()
  })

  test('accepts routine-to-routine moves and rejects moves to task and template libraries', async ({ testSetup, electronApp }) => {
    /** Exercise the main move command with the same current revisions a renderer sends. */
    const { mainWindow } = await testSetup.setupAndStart({ firstLaunch: true })
    await mainWindow.getByRole('button', { name: 'Open My Prompts' }).click()
    await mainWindow.getByTestId('new-tab-button').click()
    await mainWindow.locator('button[data-testid^="new-tab-new-collection-"]').first().click()
    await mainWindow.getByTestId('create-prompt-collection-type-routine').click()
    await mainWindow.getByTestId('create-prompt-collection-name-input').fill('Other Routines')
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Create Collection' })).toHaveCount(0)
    /** Stable record IDs and revisions come from this fresh workspace. */
    const routine = (await findRecord(electronApp, 'prompt', 'title', 'Update the Changelog'))!
    const source = (await findCollection(electronApp, 'MyRoutines', 'routine'))!
    const workspaceId = String((await rows(electronApp, 'SELECT id FROM content.workspace'))[0].id)
    for (const [folder, kind] of [['MyPrompts', 'prompt'], ['MyTemplates', 'template'], ['OtherRoutines', 'routine']] as const) {
      /** Only the final destination shares the routine workflow. */
      const destination = (await findCollection(electronApp, folder, kind))!
      const result = await mainWindow.evaluate(async ({ workspaceId, from, to, id }) => {
        /** Send each call through the normal validated Electron channel. */
        const invoke = (channel: string, payload: object) => window.electron.ipcRenderer.invoke(channel, {
          requestId: crypto.randomUUID(), clientId: window.ipcClientId, payload
        })
        /** Load both collection revisions and the source prompt revision immediately before moving. */
        const source = await invoke('load-prompt-collection-initial', { workspaceId, promptCollectionId: from })
        const target = await invoke('load-prompt-collection-initial', { workspaceId, promptCollectionId: to })
        return invoke('set-prompt-location', {
          command: { kind: 'routine', sourcePromptCollectionId: from, promptId: id,
            location: { promptCollectionId: to, categoryId: null, previousEntryId: null, status: 'Active' },
            modifiedAt: '2026-11-24T12:00:00Z' },
          expectations: [
            { entityType: 'promptCollection', id: from, expected: 'revision', revision: source.promptCollections[0].revision },
            { entityType: 'promptCollection', id: to, expected: 'revision', revision: target.promptCollections[0].revision },
            { entityType: 'prompt', id, expected: 'revision', revision: source.prompts[0].revision }
          ]
        })
      }, { workspaceId, from: source.id, to: destination.id, id: routine.id })
      expect(result).toMatchObject(kind === 'routine' ? { success: true } : { success: false, conflict: true })
      expect((await readOrder(electronApp, destination.id)).categories[0].entries.some((entry) => entry.id === routine.id)).toBe(kind === 'routine')
      expect((await readOrder(electronApp, source.id)).categories[0].entries.some((entry) => entry.id === routine.id)).toBe(kind !== 'routine')
    }
  })

  test('upgrades colliding collection names once and respects deletion on subsequent opens', async ({ testSetup, electronApp }) => {
    /** Two existing names reserve the base name and first numeric suffix. */
    const path = '/ws/routine-upgrade'
    await testSetup.setupFilesystem(createWorkspaceWithCollections(path, [
      { folderName: 'myroutines', displayName: 'my routines', promptCollectionId: 'tasks' },
      { folderName: 'MyRoutines2', displayName: 'My Routines 2', promptCollectionId: 'other-tasks' }
    ]))
    testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(path))
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    /** Count every routine name in this project's membership to detect duplicates under another suffix. */
    const routineNames = () => rows(electronApp, `SELECT json_extract(r.data, '$.displayName') AS name
      FROM content.records r JOIN content.project_collections pc ON r.id = pc.collection_id
      WHERE r.kind='promptCollection' AND json_extract(r.data, '$.kind')='routine'
      AND pc.project_id=(SELECT project_id FROM content.project_collections WHERE collection_id='tasks')`)
    expect(await routineNames()).toEqual([{ name: 'My Routines 3' }])
    /** Removing the empty starter immediately deletes it through the collection menu. */
    const deleteStarter = async () => {
      await testHelpers.navigateToPromptCollections('My Routines 3')
      await mainWindow.getByTestId('selected-prompt-collection-actions-button').click()
      await mainWindow.getByTestId('delete-selected-prompt-collection-menu-item').click()
      await expect.poll(() => findCollection(electronApp, 'MyRoutines3', 'routine')).toBeNull()
    }
    await deleteStarter()
    // Reopen the managed file with the version and collection graph of an existing pre-routine workspace.
    await runSqlStatement(electronApp, 'PRAGMA content.user_version = 1')
    await waitForRendererPersistence(mainWindow)
    await mainWindow.reload()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect.poll(() => findCollection(electronApp, 'MyRoutines3', 'routine')).toMatchObject({ displayName: 'My Routines 3' })
    expect(await routineNames()).toEqual([{ name: 'My Routines 3' }])
    expect(await rows(electronApp, 'PRAGMA content.user_version')).toEqual([{ user_version: 2 }])
    expect(await readRecord(electronApp, 'promptCollection', 'tasks')).toMatchObject({ kind: 'prompt', displayName: 'my routines' })
    await deleteStarter()
    await waitForRendererPersistence(mainWindow)
    await mainWindow.reload()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    expect(await routineNames()).toEqual([])
    expect(await readRecord(electronApp, 'promptCollection', 'other-tasks')).toMatchObject({ kind: 'prompt', displayName: 'My Routines 2' })
  })
})
