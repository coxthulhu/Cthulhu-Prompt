import { ipcMain } from 'electron'
import {
  createAccordionUiStateKey,
  createCategoryDescriptionEditorUiStateKey,
  createDefaultWorkspaceUiState,
  createWorkspacePromptFolderUiStateKey,
  LOAD_WORKSPACE_UI_STATE_CHANNEL,
  type LoadWorkspaceUiStateResult
} from '@shared/UiState'
import { data } from '../Data/Data'
import { SqliteDataAccess } from '../DataAccess/SqliteDataAccess'
import { parseLoadWorkspaceUiStateRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'

/** SQLite row containing one local ID within a workspace-scoped UI-state table. */
type WorkspaceLocalIdRow = {
  localId: string
}

/** Loads one prompt-folder UI-state record into its committed store. */
const loadWorkspacePromptFolderUiStateEntry = async (id: string) => {
  await data.workspacePromptFolderUiState.loadDataFromPersistence(id, {})
  return data.workspacePromptFolderUiState.committedStore.getEntry(id)
}

/** Loads one accordion UI-state record into its committed store. */
const loadAccordionUiStateEntry = async (id: string) => {
  await data.accordionUiState.loadDataFromPersistence(id, {})
  return data.accordionUiState.committedStore.getEntry(id)
}

/** Loads one category-editor UI-state record into its committed store. */
const loadCategoryDescriptionEditorUiStateEntry = async (id: string) => {
  await data.categoryDescriptionEditorUiState.loadDataFromPersistence(id, {})
  return data.categoryDescriptionEditorUiState.committedStore.getEntry(id)
}

/** Registers the workspace-scoped split UI-state startup query. */
export const setupUiStateQueryHandlers = (): void => {
  ipcMain.handle(
    LOAD_WORKSPACE_UI_STATE_CHANNEL,
    async (_, request: unknown): Promise<LoadWorkspaceUiStateResult> =>
      await runQueryIpcRequest(
        request,
        parseLoadWorkspaceUiStateRequest,
        async (validatedRequest) => {
          try {
            /** Workspace whose split UI-state tables are being hydrated. */
            const workspaceId = validatedRequest.payload.workspaceId
            /** SQLite database queried for every workspace-scoped row key. */
            const db = SqliteDataAccess.getDatabase()
            await data.workspaceUiState.loadDataFromPersistence(workspaceId, {})
            if (!data.workspaceUiState.committedStore.getEntry(workspaceId)) {
              data.workspaceUiState.committedStore.setFromDisk(
                workspaceId,
                createDefaultWorkspaceUiState(workspaceId),
                {}
              )
            }

            /** Prompt-folder view row IDs owned by the selected workspace. */
            const promptFolderRows = db
              .prepare(
                `SELECT content_owner_id AS localId
                 FROM prompt_folder_view_state WHERE workspace_id = ?`
              )
              .all(workspaceId) as WorkspaceLocalIdRow[]
            /** Accordion row IDs owned by the selected workspace. */
            const accordionRows = db
              .prepare(
                `SELECT persistence_id AS localId
                 FROM accordion_view_state WHERE workspace_id = ?`
              )
              .all(workspaceId) as WorkspaceLocalIdRow[]
            /** Category-description editor row IDs owned by the selected workspace. */
            const categoryEditorRows = db
              .prepare(
                `SELECT category_id AS localId
                 FROM category_description_editor_view_state WHERE workspace_id = ?`
              )
              .all(workspaceId) as WorkspaceLocalIdRow[]

            /** Loaded prompt-folder UI-state committed entries. */
            const promptFolderEntries = await Promise.all(
              promptFolderRows.map((row) =>
                loadWorkspacePromptFolderUiStateEntry(
                  createWorkspacePromptFolderUiStateKey(workspaceId, row.localId)
                )
              )
            )
            /** Loaded accordion UI-state committed entries. */
            const accordionEntries = await Promise.all(
              accordionRows.map((row) =>
                loadAccordionUiStateEntry(
                  createAccordionUiStateKey(workspaceId, row.localId)
                )
              )
            )
            /** Loaded category-editor UI-state committed entries. */
            const categoryEditorEntries = await Promise.all(
              categoryEditorRows.map((row) =>
                loadCategoryDescriptionEditorUiStateEntry(
                  createCategoryDescriptionEditorUiStateKey(workspaceId, row.localId)
                )
              )
            )
            /** Required workspace-level committed entry after default hydration. */
            const workspaceEntry = data.workspaceUiState.committedStore.getEntry(workspaceId)!

            return {
              success: true,
              workspaceUiState: {
                id: workspaceId,
                revision: workspaceEntry.revision,
                data: workspaceEntry.committed
              },
              workspacePromptFolderUiStates: promptFolderEntries.flatMap((entry) =>
                entry
                  ? [
                      {
                        id: createWorkspacePromptFolderUiStateKey(
                          entry.committed.workspaceId,
                          entry.committed.contentOwnerId
                        ),
                        revision: entry.revision,
                        data: entry.committed
                      }
                    ]
                  : []
              ),
              accordionUiStates: accordionEntries.flatMap((entry) =>
                entry
                  ? [
                      {
                        id: createAccordionUiStateKey(
                          entry.committed.workspaceId,
                          entry.committed.persistenceId
                        ),
                        revision: entry.revision,
                        data: entry.committed
                      }
                    ]
                  : []
              ),
              categoryDescriptionEditorUiStates: categoryEditorEntries.flatMap((entry) =>
                entry
                  ? [
                      {
                        id: createCategoryDescriptionEditorUiStateKey(
                          entry.committed.workspaceId,
                          entry.committed.categoryId
                        ),
                        revision: entry.revision,
                        data: entry.committed
                      }
                    ]
                  : []
              )
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }
          }
        }
      )
  )
}
