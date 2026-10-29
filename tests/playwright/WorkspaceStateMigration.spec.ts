import { join } from 'node:path'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/domain/settings/SystemSettings'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createLegacyStateDatabase } from '../fixtures/LegacyStateDatabase'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { setNewPromptFocus } from '../helpers/SettingsHelpers'
import {
  migrateSqliteDatabase, readSystemSettings, readWorkspaceState, runSqlQuery,
  runSqlStatement, seedWorkspaceState, toSqlText
} from '../helpers/UserPersistenceHelpers'

/** Real Electron SQLite and startup paths verify migration and storage boundaries. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Unified workspace state', () => {
  test('migrates every legacy table, splits mixed records, and retains workspace isolation', async ({ electronApp }) => {
    await createLegacyStateDatabase(electronApp)
    for (const sql of [
      `UPDATE app_persistence SET last_workspace_info_path = 'C:/Work/Example.cthulhuprompt',
        app_sidebar_width_px = 312, has_shown_welcome = 1, workspace_dialog_directory = 'C:/Work',
        window_x_px = 45, window_y_px = 67, window_width_px = 1100, window_height_px = 800,
        window_is_maximized = 0, window_is_fullscreen = 1 WHERE id = 1`,
      `INSERT INTO workspace_ui_state VALUES ('one', 'settings', NULL, 'tasks', 'templates')`,
      `INSERT INTO prompt_collection_view_state VALUES
        ('one', 'owner', 'prompt', 0, 1, '{"active":123,"backlog":456}', 'backlog', '{"archived":true}'),
        ('two', 'owner', 'other-prompt', 1, 0, '{"active":789}', 'active', '{}')`,
      `INSERT INTO accordion_view_state VALUES ('one', 'sidebar',
        '[{"id":"closed","isExpanded":false,"configuredExpandedHeightPx":222},{"id":"open","isExpanded":true,"configuredExpandedHeightPx":333}]')`,
      `INSERT INTO markdown_content_ui_state VALUES ('one', 'prompt', '{"cursorState":[],"viewState":{"scrollTop":101}}')`
    ]) await runSqlStatement(electronApp, sql)
    await migrateSqliteDatabase(electronApp)
    expect(await readWorkspaceState(electronApp, null, 'application-user', null)).toEqual({ hasShownWelcome: true })
    expect(await readWorkspaceState(electronApp, null, 'application-machine', null)).toEqual({
      lastWorkspaceInfoPath: 'C:/Work/Example.cthulhuprompt', appSidebarWidthPx: 312
    })
    expect(await readWorkspaceState(electronApp, null, 'workspace-dialog', null)).toEqual({ directory: 'C:/Work' })
    expect(await readWorkspaceState(electronApp, null, 'window', null)).toEqual({
      x: 45, y: 67, width: 1100, height: 800, isMaximized: false, isFullScreen: true
    })
    expect(await readWorkspaceState(electronApp, 'one', 'workspace-navigation', null)).toEqual({
      selectedScreen: 'settings', selectedScreenData: null,
      lastPromptTaskCollectionId: 'tasks', lastPromptTemplateCollectionId: 'templates'
    })
    expect(await readWorkspaceState(electronApp, 'one', 'collection-user', 'owner')).toEqual({
      selectedEntryId: 'prompt', treeIsExpanded: false, contentSectionIsExpanded: true,
      selectedMode: 'backlog', shownFinalStatusGroups: { archived: true }
    })
    expect(await readWorkspaceState(electronApp, 'one', 'collection-machine', 'owner')).toEqual({ scrollTopByMode: { active: 123, backlog: 456 } })
    expect(await readWorkspaceState(electronApp, 'two', 'collection-user', 'owner')).toEqual({
      selectedEntryId: 'other-prompt', treeIsExpanded: true, contentSectionIsExpanded: false,
      selectedMode: 'active', shownFinalStatusGroups: {}
    })
    expect(await readWorkspaceState(electronApp, 'two', 'collection-machine', 'owner')).toEqual({ scrollTopByMode: { active: 789 } })
    expect(await readWorkspaceState(electronApp, 'one', 'accordion-user', 'sidebar')).toEqual({
      sections: [{ id: 'closed', isExpanded: false }, { id: 'open', isExpanded: true }]
    })
    expect(await readWorkspaceState(electronApp, 'one', 'accordion-machine', 'sidebar')).toEqual({ heights: { closed: 222, open: 333 } })
    expect(await readWorkspaceState(electronApp, 'one', 'markdown-editor', 'prompt')).toEqual({ editorViewStateJson: '{"cursorState":[],"viewState":{"scrollTop":101}}' })
    /** Classification assertions are independent of the production registry. */
    const classifications = await runSqlQuery(electronApp, 'SELECT DISTINCT state_type, storage_scope FROM workspace_state ORDER BY state_type')
    expect(classifications.rows).toEqual([
      { state_type: 'accordion-machine', storage_scope: 'machine-specific' },
      { state_type: 'accordion-user', storage_scope: 'user-specific' },
      { state_type: 'application-machine', storage_scope: 'machine-specific' },
      { state_type: 'application-user', storage_scope: 'user-specific' },
      { state_type: 'collection-machine', storage_scope: 'machine-specific' },
      { state_type: 'collection-user', storage_scope: 'user-specific' },
      { state_type: 'markdown-editor', storage_scope: 'machine-specific' },
      { state_type: 'window', storage_scope: 'machine-specific' },
      { state_type: 'workspace-dialog', storage_scope: 'machine-specific' },
      { state_type: 'workspace-navigation', storage_scope: 'user-specific' }
    ])
    expect((await runSqlQuery(electronApp, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).rows).toEqual([
      { name: 'schema_version' }, { name: 'workspace_state' }
    ])
    /** Re-running startup migrations cannot duplicate nullable application keys. */
    const before = await runSqlQuery(electronApp, 'SELECT * FROM workspace_state ORDER BY workspace_id, state_type, entity_id')
    await migrateSqliteDatabase(electronApp)
    expect((await runSqlQuery(electronApp, 'SELECT * FROM workspace_state ORDER BY workspace_id, state_type, entity_id')).rows).toEqual(before.rows)
  })

  test('rolls back the schema and copied records when a legacy payload cannot be migrated', async ({ electronApp }) => {
    await createLegacyStateDatabase(electronApp)
    await runSqlStatement(electronApp, `INSERT INTO prompt_collection_view_state
      (workspace_id, content_owner_id, selected_entry_id, scroll_top_by_mode_json) VALUES ('one', 'owner', 'prompt', '{broken')`)
    await expect(migrateSqliteDatabase(electronApp)).rejects.toThrow('malformed JSON')
    expect((await runSqlQuery(electronApp, 'SELECT version FROM schema_version')).rows).toEqual([{ version: 26 }])
    expect((await runSqlQuery(electronApp, "SELECT name FROM sqlite_master WHERE name = 'workspace_state'")).rows).toEqual([])
    expect((await runSqlQuery(electronApp, 'SELECT scroll_top_by_mode_json FROM prompt_collection_view_state')).rows).toEqual([{ scroll_top_by_mode_json: '{broken' }])
    await runSqlStatement(electronApp, "UPDATE prompt_collection_view_state SET scroll_top_by_mode_json = '{}'")
    await migrateSqliteDatabase(electronApp)
    expect(await readWorkspaceState(electronApp, 'one', 'collection-machine', 'owner')).toEqual({ scrollTopByMode: {} })
  })

  test('enforces nullable identities and distinguishes null from empty IDs', async ({ electronApp }) => {
    for (const workspaceId of [null, '', 'workspace']) {
      for (const entityId of [null, '', 'entity']) {
        await seedWorkspaceState(electronApp, workspaceId, 'identity-test', entityId, { value: 1 })
        await seedWorkspaceState(electronApp, workspaceId, 'identity-test', entityId, { value: 2 })
        expect(await readWorkspaceState(electronApp, workspaceId, 'identity-test', entityId)).toEqual({ value: 2 })
      }
    }
    expect((await runSqlQuery(electronApp, "SELECT COUNT(*) AS count FROM workspace_state WHERE state_type = 'identity-test'")).rows).toEqual([{ count: 9 }])
    /** Raw duplicate inserts must fail even when both key components are null. */
    const duplicate = await runSqlQuery(electronApp, `INSERT INTO workspace_state VALUES (NULL, 'identity-test', NULL, 'user-specific', '{}')`)
    expect(duplicate.success).toBe(false)
    expect(duplicate.error).toContain('UNIQUE constraint failed')
  })

  test('imports normalized settings, deletes the file, and persists subsequent UI edits in SQLite', async ({ electronApp, testSetup }) => {
    /** Legacy file deliberately omits fields and exceeds the supported font size. */
    const settingsPath = join(await electronApp.evaluate(({ app }) => app.getPath('userData')), 'SystemSettings.json')
    await testSetup.setupFilesystem({ [settingsPath]: JSON.stringify({ promptFontSize: 99, newPromptFocus: 'title', automaticUpdates: false }) })
    /** Startup imports before settings and updater hydration. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    expect(await checkFileExists(electronApp, settingsPath)).toBe(false)
    expect(await readSystemSettings(electronApp)).toEqual({ ...DEFAULT_SYSTEM_SETTINGS, promptFontSize: 32, newPromptFocus: 'title', automaticUpdates: false })
    expect((await runSqlQuery(electronApp, "SELECT storage_scope FROM workspace_state WHERE state_type = 'system-settings'")).rows).toEqual([{ storage_scope: 'user-specific' }])
    await testHelpers.navigateToSettingsScreen()
    await expect(mainWindow.getByTestId('new-prompt-focus-selector')).toHaveText('Title')
    await setNewPromptFocus(mainWindow, testHelpers, 'editor')
    expect((await readSystemSettings(electronApp)).newPromptFocus).toBe('editor')
    expect(await checkFileExists(electronApp, settingsPath)).toBe(false)
  })

  test('retains the settings file when the database write fails and imports it on retry', async ({ electronApp, testSetup }) => {
    /** Valid settings must remain recoverable if SQLite rejects their import. */
    const settingsPath = join(await electronApp.evaluate(({ app }) => app.getPath('userData')), 'SystemSettings.json')
    /** Original bytes are compared after the forced failure. */
    const original = JSON.stringify({ promptFontSize: 22, newPromptFocus: 'title' })
    await testSetup.setupFilesystem({ [settingsPath]: original })
    await runSqlStatement(electronApp, `CREATE TRIGGER reject_settings BEFORE INSERT ON workspace_state
      WHEN NEW.state_type = 'system-settings' BEGIN SELECT RAISE(ABORT, 'settings import rejected'); END`)
    await expect(migrateSqliteDatabase(electronApp)).rejects.toThrow('settings import rejected')
    expect(await readTextFile(electronApp, settingsPath)).toBe(original)
    expect(await readWorkspaceState(electronApp, null, 'system-settings', null)).toBeNull()
    await runSqlStatement(electronApp, 'DROP TRIGGER reject_settings')
    await migrateSqliteDatabase(electronApp)
    expect(await checkFileExists(electronApp, settingsPath)).toBe(false)
    expect(await readSystemSettings(electronApp)).toEqual({ ...DEFAULT_SYSTEM_SETTINGS, promptFontSize: 22, newPromptFocus: 'title' })
  })

  test('rejects non-object payloads and unknown storage scopes', async ({ electronApp }) => {
    for (const payload of ['[]', '1', 'null', '{broken']) {
      /** Invalid payloads must never enter the unified JSON object storage. */
      const result = await runSqlQuery(electronApp, `INSERT INTO workspace_state VALUES (NULL, 'constraint-test', NULL, 'user-specific', ${toSqlText(payload)})`)
      expect(result.success).toBe(false)
    }
    /** Classification is restricted to the two supported storage scopes. */
    const scopeResult = await runSqlQuery(electronApp, `INSERT INTO workspace_state VALUES (NULL, 'constraint-test', NULL, 'unknown', '{}')`)
    expect(scopeResult.success).toBe(false)
    expect((await runSqlQuery(electronApp, "SELECT * FROM workspace_state WHERE state_type = 'constraint-test'")).rows).toEqual([])
  })

  test('keeps existing SQLite settings when an imported file remains on disk', async ({ electronApp, testSetup }) => {
    /** A leftover valid file simulates an interrupted post-import deletion. */
    const settingsPath = join(await electronApp.evaluate(({ app }) => app.getPath('userData')), 'SystemSettings.json')
    await testSetup.setupFilesystem({ [settingsPath]: JSON.stringify({ newPromptFocus: 'title', promptFontSize: 30 }) })
    await seedWorkspaceState(electronApp, null, 'system-settings', null, { ...DEFAULT_SYSTEM_SETTINGS, promptFontSize: 20 })
    await testSetup.setupAndStart()
    expect(await readSystemSettings(electronApp)).toEqual({ ...DEFAULT_SYSTEM_SETTINGS, promptFontSize: 20 })
    expect(await checkFileExists(electronApp, settingsPath)).toBe(false)
  })

  for (const invalid of ['{malformed', '[]', 'null']) {
    test(`retains invalid settings ${invalid} and starts with defaults`, async ({ electronApp, testSetup }) => {
      /** Invalid legacy bytes must survive startup exactly as supplied. */
      const settingsPath = join(await electronApp.evaluate(({ app }) => app.getPath('userData')), 'SystemSettings.json')
      await testSetup.setupFilesystem({ [settingsPath]: invalid })
      await testSetup.setupAndStart()
      expect(await readTextFile(electronApp, settingsPath)).toBe(invalid)
      expect(await readSystemSettings(electronApp)).toEqual(DEFAULT_SYSTEM_SETTINGS)
    })
  }
})
