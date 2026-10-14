import { ipcMain } from 'electron'
import {
  createAccordionUiStateKey,
  createDefaultWorkspaceUiState,
  createWorkspacePromptCollectionUiStateKey,
  LOAD_WORKSPACE_UI_STATE_CHANNEL,
  type LoadWorkspaceUiStateResult
} from '@shared/domain/ui-state/UiState'
import { data } from '../Data/Data'
import { WorkspaceStateDataAccess } from '../Persistence/sqlite/WorkspaceStateDataAccess'
import { parseLoadWorkspaceUiStateRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'

/** Loads one prompt-collection UI-state record into its committed store. */
const loadWorkspacePromptCollectionUiStateEntry = async (id: string) => {
  await data.workspacePromptCollectionUiState.loadDataFromPersistence(id, {})
  return data.workspacePromptCollectionUiState.committedStore.getEntry(id)
}

/** Loads one accordion UI-state record into its committed store. */
const loadAccordionUiStateEntry = async (id: string) => {
  await data.accordionUiState.loadDataFromPersistence(id, {})
  return data.accordionUiState.committedStore.getEntry(id)
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
            await data.workspaceUiState.loadDataFromPersistence(workspaceId, {})
            if (!data.workspaceUiState.committedStore.getEntry(workspaceId)) {
              data.workspaceUiState.committedStore.setFromDisk(
                workspaceId,
                createDefaultWorkspaceUiState(workspaceId),
                {}
              )
            }

            /** Portable records enumerate the owners hydrated by the adapters. */
            const promptCollectionIds = WorkspaceStateDataAccess.listEntityIds(workspaceId, 'collection-user')
            /** Portable accordion records retain their local heights when available. */
            const accordionIds = WorkspaceStateDataAccess.listEntityIds(workspaceId, 'accordion-user')

            /** Loaded prompt-collection UI-state committed entries. */
            const promptCollectionEntries = await Promise.all(
              promptCollectionIds.map((localId) =>
                loadWorkspacePromptCollectionUiStateEntry(
                  createWorkspacePromptCollectionUiStateKey(workspaceId, localId)
                )
              )
            )
            /** Loaded accordion UI-state committed entries. */
            const accordionEntries = await Promise.all(
              accordionIds.map((localId) =>
                loadAccordionUiStateEntry(
                  createAccordionUiStateKey(workspaceId, localId)
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
              workspacePromptCollectionUiStates: promptCollectionEntries.flatMap((entry) =>
                entry
                  ? [
                      {
                        id: createWorkspacePromptCollectionUiStateKey(
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
