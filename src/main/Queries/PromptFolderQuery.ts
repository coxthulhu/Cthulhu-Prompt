import { ipcMain } from 'electron'
import type { LoadPromptFolderInitialResult } from '@shared/PromptFolder'
import {
  createPromptUiStateRevisionKey,
  PromptUiStateDataAccess
} from '../DataAccess/PromptUiStateDataAccess'
import { data } from '../Data/Data'
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
          const promptFolderEntry = data.promptFolder.committedStore.getEntry(payload.promptFolderId)

          if (!promptFolderEntry) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          if (promptFolderEntry.persistenceFields.workspaceId !== payload.workspaceId) {
            return { success: false, error: 'Prompt folder does not belong to the workspace' }
          }

          try {
            const promptIds = promptFolderEntry.committed.promptIds.filter((promptId) => {
              return data.prompt.committedStore.getEntry(promptId) !== null
            })
            const promptUiStates = PromptUiStateDataAccess.readPromptUiStates(
              payload.workspaceId,
              promptIds
            )

            return {
              success: true,
              promptFolder: {
                id: promptFolderEntry.committed.id,
                revision: promptFolderEntry.revision,
                data: {
                  ...promptFolderEntry.committed,
                  promptIds
                }
              },
              prompts: promptIds
                .map((promptId) => {
                  const promptEntry = data.prompt.committedStore.getEntry(promptId)

                  if (!promptEntry) {
                    return null
                  }

                  return {
                    id: promptId,
                    revision: promptEntry.revision,
                    data: promptEntry.committed
                  }
                })
                .filter((prompt): prompt is NonNullable<typeof prompt> => prompt !== null),
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
