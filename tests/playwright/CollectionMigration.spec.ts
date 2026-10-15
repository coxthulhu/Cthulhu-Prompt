import { createLegacyStateDatabase } from '../fixtures/LegacyStateDatabase'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createLegacyWorkspaceFilesystem, createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { readWorkspaceCollectionOrder, migrateSqliteDatabase, readWorkspaceUiState, runSqlQuery, runSqlStatement, readWorkspaceState, toSqlText } from '../helpers/UserPersistenceHelpers'

/** Production Electron suite verifies both persisted formats through workspace startup. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Stable workspace identity shared by file and SQLite migration scenarios. */
const WORKSPACE_PATH = '/ws/collection-migration'
/** Explicit identity lets legacy SQLite records reference the file-backed workspace. */
const WORKSPACE_ID = 'collection-migration-workspace'

/** Creates ordered task and template collections with content and collection descriptions. */
const createMigrationWorkspace = (): Record<string, string | null> => {
  /** Task order deliberately differs from alphabetical order. */
  const tasks = createWorkspaceWithCollections(WORKSPACE_PATH, [
    { folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'tasks', collectionSettings: { collectionDescription: 'Task description' }, prompts: [
      { id: 'task', title: 'Task', promptText: 'Preserve task bytes.' }
    ] },
    { folderName: 'Another', displayName: 'Another', promptCollectionId: 'another' }
  ])
  /** Templates use the same collection metadata schema with independent ordering. */
  const templates = createWorkspaceWithTemplateCollections(WORKSPACE_PATH, [
    { folderName: 'Library', displayName: 'Library', collectionId: 'library', description: 'Template description', categories: [
      { categoryName: 'Code', displayName: 'Code', categoryId: 'code', templates: [
        { id: 'template', title: 'Wrapper', templateText: 'Preserve [[PROMPT_TEXT]] bytes.' }
      ] }
    ] }
  ])
  return {
    ...tasks,
    ...templates,
    [`${WORKSPACE_PATH}/Prompts/Tasks/Archived/_CollectionInfo`]: null,
    [`${WORKSPACE_PATH}/Prompts/CollectionOrder.json`]: tasks[`${WORKSPACE_PATH}/Prompts/CollectionOrder.json`],
    [getWorkspaceInfoPath(WORKSPACE_PATH)]: JSON.stringify({ schemaVersion: 5, workspaceId: WORKSPACE_ID, workspaceName: 'Migration' })
  }
}

describe('Collection terminology migrations', () => {
  test('upgrades schema four metadata and preserves content and ordering after reopening', async ({ electronApp, testSetup }) => {
    /** Current expected bytes compared against the upgraded legacy workspace. */
    const current = createMigrationWorkspace()
    /** Authentic folder-era metadata activates the production four-to-five migration. */
    const legacy = createLegacyWorkspaceFilesystem(current, 4)
    await testSetup.setupFilesystem(legacy)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** UI startup runs migrations before loading collection identities. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await expect(mainWindow.getByTestId('home-prompt-collection-count-stat')).toContainText('3')
    await expect(mainWindow.getByTestId('home-prompt-collection-count-stat')).toContainText('Prompt Collections')
    for (const [filePath, contents] of Object.entries(current)) {
      if (contents === null || filePath.endsWith('.cthulhuprompt.json') || filePath.endsWith('/CollectionOrder.json')) continue
      expect(await checkFileExists(electronApp, filePath)).toBe(true)
      if (filePath.endsWith('CollectionInfo.json') || filePath.endsWith('CollectionOrder.json')) {
        expect(JSON.parse(await readTextFile(electronApp, filePath))).toEqual(JSON.parse(contents))
      } else {
        expect(await readTextFile(electronApp, filePath)).toBe(contents)
      }
    }
    for (const filePath of Object.keys(legacy).filter((filePath) => filePath.includes('_FolderInfo') || filePath.endsWith('/FolderOrder.json'))) {
      expect(await checkFileExists(electronApp, filePath)).toBe(false)
    }
    expect(JSON.parse(await readTextFile(electronApp, getWorkspaceInfoPath(WORKSPACE_PATH))).schemaVersion).toBe(6)
    expect(await checkFileExists(electronApp, `${WORKSPACE_PATH}/Prompts/Tasks/Archived/_CollectionInfo`)).toBe(true)
    await testHelpers.navigateToPromptCollections('Tasks')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Task')
    await testHelpers.navigateToPromptTemplateCollections('Library')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Wrapper')
    await testHelpers.navigateToHomeScreen()
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    await testHelpers.setupWorkspaceViaUI()
    expect(await checkFileExists(electronApp, `${WORKSPACE_PATH}/Prompts/CollectionOrder.json`)).toBe(false)
    expect(await readWorkspaceCollectionOrder(electronApp, WORKSPACE_PATH)).toEqual({ entries: [
      { kind: 'collection', id: 'another' }, { kind: 'collection', id: 'tasks' }
    ] })
    await testHelpers.navigateToPromptTemplateCollections('Library')
    await expect(mainWindow.getByTestId('prompt-title')).toHaveValue('Wrapper')
  })

  test('keeps schema four and original files when metadata is malformed', async ({ electronApp, testSetup }) => {
    /** Invalid metadata must be detected before renaming any valid metadata files. */
    const legacy = createLegacyWorkspaceFilesystem(createMigrationWorkspace(), 4)
    /** Late-sorted template metadata fails after valid task metadata has been examined. */
    const brokenPath = `${WORKSPACE_PATH}/Templates/Library/_FolderInfo/FolderInfo.json`
    legacy[brokenPath] = '{ malformed'
    await testSetup.setupFilesystem(legacy)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** Normal open flow exposes migration errors without hydrating a partial workspace. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' })).toBeVisible()
    expect(JSON.parse(await readTextFile(electronApp, getWorkspaceInfoPath(WORKSPACE_PATH))).schemaVersion).toBe(4)
    expect(await readTextFile(electronApp, `${WORKSPACE_PATH}/Prompts/Tasks/_FolderInfo/FolderInfo.json`)).toBe(legacy[`${WORKSPACE_PATH}/Prompts/Tasks/_FolderInfo/FolderInfo.json`])
    expect(await checkFileExists(electronApp, `${WORKSPACE_PATH}/Prompts/CollectionOrder.json`)).toBe(false)
  })

  for (const kind of ['task', 'template'] as const) {
    test(`migrates SQLite ${kind} selection and retains collection view state`, async ({ electronApp, testSetup }) => {
      await testSetup.setupFilesystem(createMigrationWorkspace())
      await createLegacyStateDatabase(electronApp, 24, getWorkspaceInfoPath(WORKSPACE_PATH))
      /** Selected collection and prompt must survive the schema rename unchanged. */
      const collectionId = kind === 'task' ? 'tasks' : 'library'
      /** Serialized version-24 screen payload contains the retired field name. */
      const selectedData = JSON.stringify({ promptFolderId: collectionId, contentOwnerId: collectionId })
      await runSqlStatement(electronApp, `INSERT INTO workspace_ui_state VALUES (${toSqlText(WORKSPACE_ID)}, 'prompt-${kind}-folders', ${toSqlText(selectedData)}, 'tasks', 'library')`)
      await runSqlStatement(electronApp, `INSERT INTO prompt_folder_view_state (workspace_id, content_owner_id, selected_entry_id, tree_is_expanded, content_section_is_expanded, scroll_top_by_mode_json, selected_mode, shown_final_status_groups_json) VALUES (${toSqlText(WORKSPACE_ID)}, '${collectionId}', 'root-header', 0, 0, '{"active":123}', 'active', '{"archived":true}')`)
      await runSqlStatement(electronApp, `INSERT INTO workspace_ui_state VALUES ('malformed', 'prompt-task-folders', '{malformed', NULL, NULL)`)
      await migrateSqliteDatabase(electronApp)
      /** Direct read verifies preservation before rendering can change viewport state. */
      const migrated = await readWorkspaceUiState(electronApp, WORKSPACE_ID)
      expect(migrated).toMatchObject({
        selectedScreen: `prompt-${kind}-collections`,
        selectedScreenData: { promptCollectionId: collectionId, contentOwnerId: collectionId },
        lastPromptTaskCollectionId: 'tasks', lastPromptTemplateCollectionId: 'library'
      })
      expect(migrated.selectedScreenData).not.toHaveProperty('promptFolderId')
      expect(await readWorkspaceState(electronApp, WORKSPACE_ID, 'collection-user', collectionId)).toEqual({
        selectedEntryId: 'collection-header', treeIsExpanded: false, contentSectionIsExpanded: false,
        selectedMode: 'active', shownFinalStatusGroups: { archived: true }
      })
      expect(await readWorkspaceState(electronApp, WORKSPACE_ID, 'collection-machine', collectionId)).toEqual({ scrollTopByMode: { active: 123 } })
      expect((await runSqlQuery(electronApp, 'SELECT version FROM schema_version')).rows).toEqual([{ version: 27 }])
      await migrateSqliteDatabase(electronApp)
      expect(await readWorkspaceUiState(electronApp, WORKSPACE_ID)).toEqual(migrated)
      /** Startup restores the selected activity and collection through the production reader. */
      const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await expect(mainWindow.getByTestId('prompt-collection-screen')).toBeVisible()
      await expect(mainWindow.getByTestId('sidebar-prompt-collection-selector-trigger')).toContainText(kind === 'task' ? 'Tasks' : 'Library')
    })
  }

  test('migrates saved collection headers without changing prompt or category selections', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(createMigrationWorkspace())
    await createLegacyStateDatabase(electronApp, 25, getWorkspaceInfoPath(WORKSPACE_PATH))
    await runSqlStatement(electronApp, `INSERT INTO workspace_ui_state VALUES (
      '${WORKSPACE_ID}', 'prompt-task-collections', '{"promptCollectionId":"tasks","contentOwnerId":"tasks"}', 'tasks', 'library')`)
    await runSqlStatement(electronApp, `INSERT INTO prompt_collection_view_state VALUES
      ('${WORKSPACE_ID}', 'tasks', 'root-header', 0, 1, '{"active":0,"backlog":123}', 'active', '{"archived":true}'),
      ('${WORKSPACE_ID}', 'library', 'template', 1, 0, '{}', 'active', '{}'),
      ('${WORKSPACE_ID}', 'code', 'category-details', 1, 1, '{}', 'active', '{}')`)
    /** Compare all stored view fields before rendering can update viewport settings. */
    const before = await runSqlQuery(electronApp, 'SELECT * FROM prompt_collection_view_state ORDER BY content_owner_id')
    await migrateSqliteDatabase(electronApp)
    expect((await runSqlQuery(electronApp, 'SELECT version FROM schema_version')).rows).toEqual([{ version: 27 }])
    for (const row of before.rows!) {
      expect(await readWorkspaceState(electronApp, WORKSPACE_ID, 'collection-user', String(row.content_owner_id))).toEqual({
        selectedEntryId: row.selected_entry_id === 'root-header' ? 'collection-header' : row.selected_entry_id,
        treeIsExpanded: Boolean(row.tree_is_expanded), contentSectionIsExpanded: Boolean(row.content_section_is_expanded),
        selectedMode: row.selected_mode, shownFinalStatusGroups: JSON.parse(String(row.shown_final_status_groups_json))
      })
      expect(await readWorkspaceState(electronApp, WORKSPACE_ID, 'collection-machine', String(row.content_owner_id))).toEqual({
        scrollTopByMode: JSON.parse(String(row.scroll_top_by_mode_json))
      })
    }
    /** A second migration run must leave all imported rows byte-for-byte unchanged. */
    const migratedRows = await runSqlQuery(electronApp, 'SELECT * FROM workspace_state ORDER BY state_type, entity_id')
    await migrateSqliteDatabase(electronApp)
    expect((await runSqlQuery(electronApp, 'SELECT * FROM workspace_state ORDER BY state_type, entity_id')).rows).toEqual(migratedRows.rows)
    /** Startup and reload must restore the migrated collection overview through the real UI. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await expect(mainWindow.getByTestId('prompt-collection-header')).toBeVisible()
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Tasks')
    await mainWindow.getByTestId('sidebar-collection-overview-button').click()
    await mainWindow.reload()
    await expect(mainWindow.getByTestId('prompt-collection-header')).toBeVisible()
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Tasks')
  })
})
