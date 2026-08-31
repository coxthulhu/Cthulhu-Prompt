import { createTestRequestId } from './PlaywrightTestFramework'

/** Seed values for one root-folder or category view-state entry. */
export type WorkspacePersistenceSeedEntry = {
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded?: boolean
  detailsSectionIsExpanded?: boolean
  contentSectionIsExpanded?: boolean
  categoryDescriptionEditorViewStateJson?: string | null
}

/** Seed values for one workspace-scoped accordion instance. */
export type WorkspaceAccordionPersistenceSeedEntry = {
  persistenceId: string
  sections: Array<{
    id: string
    isExpanded: boolean
    configuredExpandedHeightPx: number
  }>
}

/** Persisted workspace state read directly from the test SQLite database. */
export type WorkspacePersistenceSnapshot = {
  workspaceId: string
  selectedScreen: 'home' | 'settings' | 'mockups' | 'test-screen' | 'prompt-folders'
  selectedScreenData:
    | null
    | { mockupId: string | null }
    | {
        promptFolderId: string | null
        /** Root-folder or category owner containing the selected row. */
        contentOwnerId?: string | null
      }
  lastPromptFolderId: string | null
  promptFolderViewEntries: Array<{
    contentOwnerId: string
    selectedEntryId: string
    treeIsExpanded: boolean
    detailsSectionIsExpanded: boolean
    contentSectionIsExpanded: boolean
    categoryDescriptionEditorViewStateJson: string | null
  }>
  accordionViewEntries: WorkspaceAccordionPersistenceSeedEntry[]
}

export const toSqlText = (value: string): string => {
  return `'${value.replace(/'/g, "''")}'`
}

const toSqlNullableText = (value: string | null | undefined): string => {
  return value === null || value === undefined ? 'NULL' : toSqlText(value)
}

const toSqlJson = (value: unknown): string => {
  return value === null ? 'NULL' : toSqlText(JSON.stringify(value))
}

const toSqlNullableInteger = (value: number | null): string => {
  return value === null ? 'NULL' : `${Math.round(value)}`
}

const toSqlNullableBoolean = (value: boolean | null): string => {
  if (value === null) {
    return 'NULL'
  }

  return value ? '1' : '0'
}

export const runSqlQuery = async (
  electronApp: any,
  sql: string
): Promise<{ success: boolean; rows?: Array<Record<string, unknown>>; error?: string }> => {
  const requestId = createTestRequestId('sql')
  return await electronApp.evaluate(
    async ({ app }, payload) => {
      const { query, requestId } = payload
      return await new Promise<{
        success: boolean
        rows?: Array<Record<string, unknown>>
        error?: string
      }>((resolve) => {
        app.once(`test-run-sql-query-ready:${requestId}`, (nextPayload) => {
          resolve(nextPayload)
        })
        app.emit('test-run-sql-query', { requestId, sql: query })
      })
    },
    { query: sql, requestId }
  )
}

export const runSqlStatement = async (electronApp: any, sql: string): Promise<void> => {
  const result = await runSqlQuery(electronApp, sql)

  if (!result.success) {
    throw new Error(result.error ?? 'SQL query failed')
  }
}

export const seedUserPersistence = async (
  electronApp: any,
  data: {
    lastWorkspaceInfoPath: string | null
    appSidebarWidthPx?: number
  }
): Promise<void> => {
  const lastWorkspaceInfoPathSql =
    data.lastWorkspaceInfoPath === null ? 'NULL' : toSqlText(data.lastWorkspaceInfoPath)

  await runSqlStatement(
    electronApp,
    `
    INSERT INTO app_persistence (
      id,
      last_workspace_info_path,
      app_sidebar_width_px
    )
    VALUES (
      1,
      ${lastWorkspaceInfoPathSql},
      ${data.appSidebarWidthPx ?? 275}
    )
    ON CONFLICT(id) DO UPDATE SET
      last_workspace_info_path = excluded.last_workspace_info_path,
      app_sidebar_width_px = excluded.app_sidebar_width_px
    `
  )
}

export const seedWindowPersistence = async (
  electronApp: any,
  data: {
    x: number | null
    y: number | null
    width: number | null
    height: number | null
    isMaximized: boolean | null
    isFullScreen: boolean | null
  }
): Promise<void> => {
  await runSqlStatement(
    electronApp,
    `
    UPDATE app_persistence
    SET
      window_x_px = ${toSqlNullableInteger(data.x)},
      window_y_px = ${toSqlNullableInteger(data.y)},
      window_width_px = ${toSqlNullableInteger(data.width)},
      window_height_px = ${toSqlNullableInteger(data.height)},
      window_is_maximized = ${toSqlNullableBoolean(data.isMaximized)},
      window_is_fullscreen = ${toSqlNullableBoolean(data.isFullScreen)}
    WHERE id = 1
    `
  )
}

export const seedWorkspacePersistence = async (
  electronApp: any,
  data: {
    workspaceId: string
    selectedScreen: 'home' | 'settings' | 'mockups' | 'test-screen' | 'prompt-folders'
    selectedScreenData:
      | null
      | { mockupId: string | null }
      | {
          promptFolderId: string | null
          /** Root-folder or category owner containing the selected row. */
          contentOwnerId?: string | null
        }
    lastPromptFolderId?: string | null
    promptFolderViewEntries: WorkspacePersistenceSeedEntry[]
    accordionViewEntries?: WorkspaceAccordionPersistenceSeedEntry[]
  }
): Promise<void> => {
  await runSqlStatement(
    electronApp,
    `
    INSERT INTO workspace_ui_state (
      workspace_id,
      selected_screen,
      selected_screen_data_json,
      last_prompt_folder_id
    )
    VALUES (
      ${toSqlText(data.workspaceId)},
      ${toSqlText(data.selectedScreen)},
      ${toSqlJson(data.selectedScreenData)},
      ${toSqlNullableText(data.lastPromptFolderId)}
    )
    ON CONFLICT(workspace_id) DO UPDATE SET
      selected_screen = excluded.selected_screen,
      selected_screen_data_json = excluded.selected_screen_data_json,
      last_prompt_folder_id = excluded.last_prompt_folder_id
    `
  )

  await runSqlStatement(
    electronApp,
    `DELETE FROM prompt_folder_view_state WHERE workspace_id = ${toSqlText(data.workspaceId)}`
  )
  await runSqlStatement(
    electronApp,
    `DELETE FROM category_description_editor_view_state WHERE workspace_id = ${toSqlText(data.workspaceId)}`
  )
  await runSqlStatement(
    electronApp,
    `DELETE FROM accordion_view_state WHERE workspace_id = ${toSqlText(data.workspaceId)}`
  )

  for (const entry of data.promptFolderViewEntries) {
    await runSqlStatement(
      electronApp,
      `
      INSERT INTO prompt_folder_view_state (
        workspace_id,
        content_owner_id,
        selected_entry_id,
        tree_is_expanded,
        details_section_is_expanded,
        content_section_is_expanded
      )
      VALUES (
        ${toSqlText(data.workspaceId)},
        ${toSqlText(entry.contentOwnerId)},
        ${toSqlText(entry.selectedEntryId)},
        ${entry.treeIsExpanded === false ? 0 : 1},
        ${entry.detailsSectionIsExpanded === true ? 1 : 0},
        ${entry.contentSectionIsExpanded === false ? 0 : 1}
      )
      `
    )

    if (entry.categoryDescriptionEditorViewStateJson !== null &&
        entry.categoryDescriptionEditorViewStateJson !== undefined) {
      await runSqlStatement(
        electronApp,
        `
        INSERT INTO category_description_editor_view_state (
          workspace_id,
          category_id,
          editor_view_state_json
        )
        VALUES (
          ${toSqlText(data.workspaceId)},
          ${toSqlText(entry.contentOwnerId)},
          ${toSqlText(entry.categoryDescriptionEditorViewStateJson)}
        )
        `
      )
    }
  }

  for (const entry of data.accordionViewEntries ?? []) {
    await runSqlStatement(
      electronApp,
      `
      INSERT INTO accordion_view_state (
        workspace_id,
        persistence_id,
        sections_json
      )
      VALUES (
        ${toSqlText(data.workspaceId)},
        ${toSqlText(entry.persistenceId)},
        ${toSqlText(JSON.stringify(entry.sections))}
      )
      `
    )
  }
}

export const readUserPersistence = async (
  electronApp: any
): Promise<{
  lastWorkspaceInfoPath: string | null
  appSidebarWidthPx: number
}> => {
  const queryResult = await runSqlQuery(
    electronApp,
    `
    SELECT
      last_workspace_info_path AS lastWorkspaceInfoPath,
      app_sidebar_width_px AS appSidebarWidthPx
    FROM app_persistence
    WHERE id = 1
    `
  )

  if (!queryResult.success || !queryResult.rows?.[0]) {
    throw new Error(queryResult.error ?? 'Failed to read app persistence')
  }

  return queryResult.rows[0] as {
    lastWorkspaceInfoPath: string | null
    appSidebarWidthPx: number
  }
}

export const readWorkspacePersistence = async (
  electronApp: any,
  workspaceId: string
): Promise<WorkspacePersistenceSnapshot> => {
  const workspaceStateResult = await runSqlQuery(
    electronApp,
    `
    SELECT
      selected_screen AS selectedScreen,
      selected_screen_data_json AS selectedScreenDataJson,
      last_prompt_folder_id AS lastPromptFolderId
    FROM workspace_ui_state
    WHERE workspace_id = ${toSqlText(workspaceId)}
    `
  )

  if (!workspaceStateResult.success) {
    throw new Error(workspaceStateResult.error ?? 'Failed to read workspace state')
  }

  const promptFolderViewResult = await runSqlQuery(
    electronApp,
    `
    SELECT
      content_owner_id AS contentOwnerId,
      selected_entry_id AS selectedEntryId,
      tree_is_expanded AS treeIsExpanded,
      details_section_is_expanded AS detailsSectionIsExpanded,
      content_section_is_expanded AS contentSectionIsExpanded
    FROM prompt_folder_view_state
    WHERE workspace_id = ${toSqlText(workspaceId)}
    `
  )

  if (!promptFolderViewResult.success) {
    throw new Error(promptFolderViewResult.error ?? 'Failed to read prompt folder view state')
  }

  /** Category description editor states keyed by category ID. */
  const categoryDescriptionViewStateResult = await runSqlQuery(
    electronApp,
    `
    SELECT
      category_id AS categoryId,
      editor_view_state_json AS editorViewStateJson
    FROM category_description_editor_view_state
    WHERE workspace_id = ${toSqlText(workspaceId)}
    `
  )

  if (!categoryDescriptionViewStateResult.success) {
    throw new Error(
      categoryDescriptionViewStateResult.error ??
        'Failed to read category description editor view state'
    )
  }

  /** Complete accordion section rows persisted for this workspace. */
  const accordionViewStateResult = await runSqlQuery(
    electronApp,
    `
    SELECT
      persistence_id AS persistenceId,
      sections_json AS sectionsJson
    FROM accordion_view_state
    WHERE workspace_id = ${toSqlText(workspaceId)}
    `
  )

  if (!accordionViewStateResult.success) {
    throw new Error(accordionViewStateResult.error ?? 'Failed to read accordion view state')
  }

  /** Category description view-state JSON keyed by category ID. */
  const categoryDescriptionViewStateByCategoryId = new Map(
    (categoryDescriptionViewStateResult.rows ?? []).map((entry) => [
      String(entry.categoryId),
      String(entry.editorViewStateJson)
    ])
  )

  const workspaceRow = workspaceStateResult.rows?.[0] as
    | {
        selectedScreen: WorkspacePersistenceSnapshot['selectedScreen']
        selectedScreenDataJson: string | null
        lastPromptFolderId: string | null
      }
    | undefined

  return {
    workspaceId,
    selectedScreen: workspaceRow?.selectedScreen ?? 'home',
    selectedScreenData: workspaceRow?.selectedScreenDataJson
      ? JSON.parse(workspaceRow.selectedScreenDataJson)
      : null,
    lastPromptFolderId: workspaceRow?.lastPromptFolderId ?? null,
    promptFolderViewEntries: (promptFolderViewResult.rows ?? []).map((entry) => ({
      contentOwnerId: String(entry.contentOwnerId),
      selectedEntryId: String(entry.selectedEntryId),
      treeIsExpanded: entry.treeIsExpanded !== 0,
      detailsSectionIsExpanded: entry.detailsSectionIsExpanded !== 0,
      contentSectionIsExpanded: entry.contentSectionIsExpanded !== 0,
      categoryDescriptionEditorViewStateJson:
        categoryDescriptionViewStateByCategoryId.get(String(entry.contentOwnerId)) ?? null
    })),
    accordionViewEntries: (accordionViewStateResult.rows ?? []).map((entry) => ({
      persistenceId: String(entry.persistenceId),
      sections: JSON.parse(
        String(entry.sectionsJson)
      ) as WorkspaceAccordionPersistenceSeedEntry['sections']
    }))
  }
}
