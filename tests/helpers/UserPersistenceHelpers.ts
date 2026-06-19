import { createTestRequestId } from './PlaywrightTestFramework'

export type WorkspacePersistenceSeedEntry = {
  promptFolderId: string
  promptTreeEntryId: string
  folderSettingsSectionIsExpanded?: boolean
  promptsSectionIsExpanded?: boolean
}

export type WorkspacePersistenceSnapshot = {
  workspaceId: string
  selectedScreen: 'home' | 'settings' | 'mockups' | 'test-screen' | 'prompt-folders'
  selectedScreenData: null | { mockupId: string | null } | { promptFolderId: string | null }
  lastPromptFolderId: string | null
  promptFolderPromptTreeEntries: Array<{
    promptFolderId: string
    promptTreeEntryId: string
    folderSettingsSectionIsExpanded: boolean
    promptsSectionIsExpanded: boolean
  }>
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
    selectedScreenData: null | { mockupId: string | null } | { promptFolderId: string | null }
    lastPromptFolderId?: string | null
    promptFolderPromptTreeEntries: WorkspacePersistenceSeedEntry[]
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
    `DELETE FROM prompt_folder_ui_state WHERE workspace_id = ${toSqlText(data.workspaceId)}`
  )
  await runSqlStatement(
    electronApp,
    `DELETE FROM prompt_folder_settings_editor_view_state WHERE workspace_id = ${toSqlText(data.workspaceId)}`
  )

  for (const entry of data.promptFolderPromptTreeEntries) {
    await runSqlStatement(
      electronApp,
      `
      INSERT INTO prompt_folder_ui_state (
        workspace_id,
        prompt_folder_id,
        prompt_tree_entry_id,
        folder_settings_section_is_expanded,
        prompts_section_is_expanded
      )
      VALUES (
        ${toSqlText(data.workspaceId)},
        ${toSqlText(entry.promptFolderId)},
        ${toSqlText(entry.promptTreeEntryId)},
        ${entry.folderSettingsSectionIsExpanded === true ? 1 : 0},
        ${entry.promptsSectionIsExpanded === false ? 0 : 1}
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

  const promptFolderStateResult = await runSqlQuery(
    electronApp,
    `
    SELECT
      prompt_folder_id AS promptFolderId,
      prompt_tree_entry_id AS promptTreeEntryId,
      folder_settings_section_is_expanded AS folderSettingsSectionIsExpanded,
      prompts_section_is_expanded AS promptsSectionIsExpanded
    FROM prompt_folder_ui_state
    WHERE workspace_id = ${toSqlText(workspaceId)}
    `
  )

  if (!promptFolderStateResult.success) {
    throw new Error(promptFolderStateResult.error ?? 'Failed to read prompt folder state')
  }

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
    promptFolderPromptTreeEntries: (promptFolderStateResult.rows ?? []).map((entry) => ({
      promptFolderId: String(entry.promptFolderId),
      promptTreeEntryId: String(entry.promptTreeEntryId),
      folderSettingsSectionIsExpanded: entry.folderSettingsSectionIsExpanded !== 0,
      promptsSectionIsExpanded: entry.promptsSectionIsExpanded !== 0
    }))
  }
}
