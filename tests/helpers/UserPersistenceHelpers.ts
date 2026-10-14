import type { ElectronApplication } from 'playwright'
import type { EventEmitter } from 'node:events'
import { createTestRequestId } from './TestRequestId'

/** Seed values for one collection or category view-state entry. */
export type WorkspacePromptCollectionUiStateSeedEntry = {
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded?: boolean
  contentSectionIsExpanded?: boolean
  /** Saved collection viewport offsets seeded for startup restoration tests. */
  scrollTopByMode?: Partial<Record<'active' | 'backlog' | 'completed' | 'archived', number>>
  /** Collection mode selected before startup. */
  selectedMode?: 'active' | 'backlog' | 'completed' | 'archived'
  /** Collection-specific optional sections visible before startup. */
  shownFinalStatusGroups?: Partial<Record<'completed' | 'archived', boolean>>
}

/** Seed values for one workspace-scoped accordion instance. */
export type AccordionUiStateSeedEntry = {
  persistenceId: string
  sections: Array<{
    id: string
    isExpanded: boolean
    configuredExpandedHeightPx: number
  }>
}

/** Persisted workspace state read directly from the test SQLite database. */
export type WorkspaceUiStateSnapshot = {
  workspaceId: string
  selectedScreen:
    | 'home'
    | 'settings'
    | 'mockups'
    | 'test-screen'
    | 'prompt-task-collections'
    | 'prompt-template-collections'
  selectedScreenData:
    | null
    | { mockupId: string | null }
    | {
        promptCollectionId: string | null
        /** collection or category owner containing the selected row. */
        contentOwnerId?: string | null
      }
  lastPromptTaskCollectionId: string | null
  lastPromptTemplateCollectionId: string | null
  promptCollectionViewEntries: Array<{
    contentOwnerId: string
    selectedEntryId: string
    treeIsExpanded: boolean
    contentSectionIsExpanded: boolean
  }>
  accordionViewEntries: AccordionUiStateSeedEntry[]
}

export const toSqlText = (value: string): string => {
  return `'${value.replace(/'/g, "''")}'`
}

const toSqlNullableText = (value: string | null | undefined): string => {
  return value === null || value === undefined ? 'NULL' : toSqlText(value)
}

export const runSqlQuery = async (
  electronApp: ElectronApplication,
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
        ;(app as EventEmitter).once(`test-run-sql-query-ready:${requestId}`, (nextPayload) => {
          resolve(nextPayload)
        })
        app.emit('test-run-sql-query', { requestId, sql: query })
      })
    },
    { query: sql, requestId }
  )
}

export const runSqlStatement = async (electronApp: ElectronApplication, sql: string): Promise<void> => {
  const result = await runSqlQuery(electronApp, sql)

  if (!result.success) {
    throw new Error(result.error ?? 'SQL query failed')
  }
}

/** Runs production startup migrations on the seeded in-memory SQLite database. */
export const migrateSqliteDatabase = async (electronApp: ElectronApplication): Promise<void> => {
  /** Correlation ID isolates this migration request from other test events. */
  const requestId = createTestRequestId('migrate-database')
  /** Main-process response reports migration failures to the test immediately. */
  const result = await electronApp.evaluate(async ({ app }, id) => {
    return await new Promise<{ success: boolean; error?: string }>((resolve) => {
      ;(app as EventEmitter).once(`test-migrate-database-ready:${id}`, resolve)
      app.emit('test-migrate-database', { requestId: id })
    })
  }, requestId)
  if (!result.success) throw new Error(result.error)
}

/** Seeds a JSON state record directly, independently of the production adapters. */
export const seedWorkspaceState = async (
  electronApp: ElectronApplication,
  workspaceId: string | null,
  stateType: string,
  entityId: string | null,
  data: object,
  storageScope: 'user-specific' | 'machine-specific' = 'user-specific'
): Promise<void> => {
  await runSqlStatement(electronApp, `INSERT INTO workspace_state
    (workspace_id, state_type, entity_id, storage_scope, data_json)
    VALUES (${toSqlNullableText(workspaceId)}, ${toSqlText(stateType)}, ${toSqlNullableText(entityId)},
      ${toSqlText(storageScope)}, ${toSqlText(JSON.stringify(data))})
    ON CONFLICT DO UPDATE SET data_json = excluded.data_json, storage_scope = excluded.storage_scope`)
}

/** Reads actual persisted JSON without invoking production reconstruction code. */
export const readWorkspaceState = async <T = Record<string, unknown>>(
  electronApp: ElectronApplication, workspaceId: string | null, stateType: string, entityId: string | null
): Promise<T | null> => {
  /** Full logical key includes nullable application and workspace scopes. */
  const result = await runSqlQuery(electronApp, `SELECT data_json FROM workspace_state
    WHERE workspace_id IS ${toSqlNullableText(workspaceId)} AND state_type = ${toSqlText(stateType)}
      AND entity_id IS ${toSqlNullableText(entityId)}`)
  if (!result.success) throw new Error(result.error)
  return result.rows?.[0] ? JSON.parse(String(result.rows[0].data_json)) : null
}

/** Reads settings from their application-wide user record. */
export const readSystemSettings = async (electronApp: ElectronApplication) =>
  (await readWorkspaceState<import('@shared/domain/settings/SystemSettings').SystemSettings>(electronApp, null, 'system-settings', null))!

/** Seeds the renderer's machine-local preferences without changing Welcome. */
export const seedUserPersistence = async (
  electronApp: ElectronApplication,
  data: { lastWorkspaceInfoPath: string | null; appSidebarWidthPx?: number }
): Promise<void> => {
  await seedWorkspaceState(electronApp, null, 'application-machine', null, {
    lastWorkspaceInfoPath: data.lastWorkspaceInfoPath,
    appSidebarWidthPx: data.appSidebarWidthPx ?? 275
  }, 'machine-specific')
}

/** Seeds machine-local window geometry and display modes. */
export const seedWindowPersistence = async (
  electronApp: ElectronApplication,
  data: { x: number | null; y: number | null; width: number | null; height: number | null; isMaximized: boolean | null; isFullScreen: boolean | null }
): Promise<void> => {
  await seedWorkspaceState(electronApp, null, 'window', null, data, 'machine-specific')
}

/** Seeds both halves of collection view state. */
export const seedCollectionUiState = async (electronApp: ElectronApplication, workspaceId: string, entry: WorkspacePromptCollectionUiStateSeedEntry): Promise<void> => {
  await seedWorkspaceState(electronApp, workspaceId, 'collection-user', entry.contentOwnerId, {
    selectedEntryId: entry.selectedEntryId,
    treeIsExpanded: entry.treeIsExpanded ?? true,
    contentSectionIsExpanded: entry.contentSectionIsExpanded ?? true,
    selectedMode: entry.selectedMode ?? 'active',
    shownFinalStatusGroups: entry.shownFinalStatusGroups ?? {}
  })
  await seedWorkspaceState(electronApp, workspaceId, 'collection-machine', entry.contentOwnerId, {
    scrollTopByMode: entry.scrollTopByMode ?? {}
  }, 'machine-specific')
}

/** Seeds workspace navigation and independently classified collection and accordion records. */
export const seedWorkspaceUiState = async (
  electronApp: ElectronApplication,
  data: {
    workspaceId: string
    selectedScreen:
      | 'home'
      | 'settings'
      | 'mockups'
      | 'test-screen'
      | 'prompt-task-collections'
      | 'prompt-template-collections'
    selectedScreenData:
      | null
      | { mockupId: string | null }
      | {
          promptCollectionId: string | null
          /** collection or category owner containing the selected row. */
          contentOwnerId?: string | null
        }
    lastPromptTaskCollectionId?: string | null
    lastPromptTemplateCollectionId?: string | null
    promptCollectionViewEntries: WorkspacePromptCollectionUiStateSeedEntry[]
    accordionViewEntries?: AccordionUiStateSeedEntry[]
  }
): Promise<void> => {
  await seedWorkspaceState(electronApp, data.workspaceId, 'workspace-navigation', null, {
    selectedScreen: data.selectedScreen,
    selectedScreenData: data.selectedScreenData,
    lastPromptTaskCollectionId: data.lastPromptTaskCollectionId ?? null,
    lastPromptTemplateCollectionId: data.lastPromptTemplateCollectionId ?? null
  })
  await runSqlStatement(electronApp, `DELETE FROM workspace_state WHERE workspace_id = ${toSqlText(data.workspaceId)}
    AND state_type IN ('collection-user', 'collection-machine', 'accordion-user', 'accordion-machine')`)
  for (const entry of data.promptCollectionViewEntries) await seedCollectionUiState(electronApp, data.workspaceId, entry)
  for (const entry of data.accordionViewEntries ?? []) {
    await seedWorkspaceState(electronApp, data.workspaceId, 'accordion-user', entry.persistenceId, {
      sections: entry.sections.map(({ id, isExpanded }) => ({ id, isExpanded }))
    })
    await seedWorkspaceState(electronApp, data.workspaceId, 'accordion-machine', entry.persistenceId, {
      heights: Object.fromEntries(entry.sections.map((section) => [section.id, section.configuredExpandedHeightPx]))
    }, 'machine-specific')
  }
}

/** Reassembles the two renderer records for existing UI assertions. */
export const readUserPersistence = async (electronApp: ElectronApplication): Promise<{
  lastWorkspaceInfoPath: string | null; appSidebarWidthPx: number; hasShownWelcome: number
}> => {
  /** Local path and sizing state. */
  const machine = await readWorkspaceState<{ lastWorkspaceInfoPath: string | null; appSidebarWidthPx: number }>(electronApp, null, 'application-machine', null)
  /** Portable Welcome state, exposed numerically for existing assertions. */
  const user = await readWorkspaceState<{ hasShownWelcome: boolean }>(electronApp, null, 'application-user', null)
  return { lastWorkspaceInfoPath: machine?.lastWorkspaceInfoPath ?? null, appSidebarWidthPx: machine?.appSidebarWidthPx ?? 275, hasShownWelcome: user?.hasShownWelcome ? 1 : 0 }
}

/** Reassembles persisted workspace state independently of the application adapters. */
export const readWorkspaceUiState = async (electronApp: ElectronApplication, workspaceId: string): Promise<WorkspaceUiStateSnapshot> => {
  /** All rows are inspected together to avoid mixing snapshots during autosave. */
  const result = await runSqlQuery(electronApp, `SELECT state_type, entity_id, data_json FROM workspace_state WHERE workspace_id = ${toSqlText(workspaceId)}`)
  if (!result.success) throw new Error(result.error)
  /** Parsed records used to join accordion heights by their section IDs. */
  const rows = (result.rows ?? []).map((row) => ({ type: row.state_type, id: String(row.entity_id), data: JSON.parse(String(row.data_json)) }))
  /** Workspace navigation can be absent before the first screen selection. */
  const navigation = rows.find((row) => row.type === 'workspace-navigation')?.data
  return {
    workspaceId,
    selectedScreen: navigation?.selectedScreen ?? 'home',
    selectedScreenData: navigation?.selectedScreenData ?? null,
    lastPromptTaskCollectionId: navigation?.lastPromptTaskCollectionId ?? null,
    lastPromptTemplateCollectionId: navigation?.lastPromptTemplateCollectionId ?? null,
    promptCollectionViewEntries: rows.filter((row) => row.type === 'collection-user').map((row) => ({
      contentOwnerId: row.id, selectedEntryId: row.data.selectedEntryId,
      treeIsExpanded: row.data.treeIsExpanded, contentSectionIsExpanded: row.data.contentSectionIsExpanded
    })),
    accordionViewEntries: rows.filter((row) => row.type === 'accordion-user').map((row) => ({
      persistenceId: row.id,
      sections: row.data.sections.map((section: { id: string; isExpanded: boolean }) => ({
        ...section,
        configuredExpandedHeightPx: rows.find((machine) => machine.type === 'accordion-machine' && machine.id === row.id)?.data.heights[section.id] ?? 1
      }))
    }))
  }
}
