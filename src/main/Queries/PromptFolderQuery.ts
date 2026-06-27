import { ipcMain } from 'electron'
import type { LoadPromptFolderInitialResult } from '@shared/PromptFolder'
import {
  createPromptUiStateRevisionKey,
  PromptUiStateDataAccess
} from '../DataAccess/PromptUiStateDataAccess'
import { data } from '../Data/Data'
import {
  buildPromptFolderSnapshot,
  getLoadedPromptEntries,
  buildPromptSnapshot,
  collectLoadedPromptFolderDescendantIds,
  filterLoadedPromptIds,
  type PromptFolderCommittedEntry
} from '../Data/DataSnapshotHelpers'
import { parseLoadPromptFolderInitialRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'

export const setupPromptFolderQueryHandlers = (): void => {
  ipcMain.handle(
    'load-prompt-folder-initial',
    async (_, request: unknown): Promise<LoadPromptFolderInitialResult> => {
      return await runQueryIpcRequest(
        request,
        parseLoadPromptFolderInitialRequest,
        async (validatedRequest) => {
          const payload = validatedRequest.payload
          const promptFolderEntry = data.promptFolder.committedStore.getEntry(
            payload.promptFolderId
          )

          if (!promptFolderEntry) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          if (promptFolderEntry.persistenceFields.workspaceId !== payload.workspaceId) {
            return { success: false, error: 'Prompt folder does not belong to the workspace' }
          }

          try {
            const promptFolderIds = [
              payload.promptFolderId,
              ...collectLoadedPromptFolderDescendantIds(payload.promptFolderId)
            ]
            const promptFolderEntries: PromptFolderCommittedEntry[] = []
            for (const promptFolderId of promptFolderIds) {
              const entry = data.promptFolder.committedStore.getEntry(promptFolderId)
              if (entry) {
                promptFolderEntries.push(entry)
              }
            }
            const promptFolders = promptFolderEntries.map((entry) =>
              buildPromptFolderSnapshot(entry)
            )
            const promptIds = promptFolders.flatMap((folder) =>
              folder.data.entryIds.filter((entryId) => data.prompt.committedStore.getEntry(entryId))
            )
            const completedPromptIds = promptFolders.flatMap((folder) =>
              filterLoadedPromptIds(folder.data.completedPromptIds)
            )
            const promptUiStates = PromptUiStateDataAccess.readPromptUiStates(
              payload.workspaceId,
              promptIds
            )
            const prompts = getLoadedPromptEntries([...promptIds, ...completedPromptIds]).map(
              (promptEntry) => buildPromptSnapshot(promptEntry)
            )

            return {
              success: true,
              promptFolders,
              prompts,
              promptUiStates: promptUiStates.map((promptUiState) => ({
                id: promptUiState.promptId,
                revision: revisions.promptUiState.get(
                  createPromptUiStateRevisionKey(promptUiState.workspaceId, promptUiState.promptId)
                ),
                data: promptUiState
              }))
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            return { success: false, error: message || 'Failed to load prompt folder initial data' }
          }
        }
      )
    }
  )
}
