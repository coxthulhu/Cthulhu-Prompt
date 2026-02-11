import { ipcMain } from 'electron'
import type {
  LoadPromptFolderInitialResult,
  LoadPromptFolderInitialWireRequest
} from '@shared/PromptFolder'
import {
  readPromptFolder,
  readPrompts
} from '../DataAccess/WorkspaceReads'
import { parseLoadPromptFolderInitialRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'
import {
  getPromptFolderLocation,
  registerPrompts
} from '../Registries/WorkspaceRegistry'

export const setupPromptFolderQueryHandlers = (): void => {
  ipcMain.handle(
    'load-prompt-folder-initial',
    async (
      _,
      request: unknown
    ): Promise<LoadPromptFolderInitialResult> => {
      return await runQueryIpcRequest<
        LoadPromptFolderInitialWireRequest,
        LoadPromptFolderInitialResult
      >(request, parseLoadPromptFolderInitialRequest, async (validatedRequest) => {
        const payload = validatedRequest.payload
        const location = getPromptFolderLocation(payload.promptFolderId)

        if (!location || location.workspaceId !== payload.workspaceId) {
          return { success: false, error: 'Prompt folder not registered' }
        }

        try {
          const promptFolder = readPromptFolder(location.workspacePath, location.folderName)
          const prompts = readPrompts(location.workspacePath, location.folderName)
          registerPrompts(
            location.workspaceId,
            location.workspacePath,
            promptFolder.id,
            promptFolder.folderName,
            prompts.map((prompt) => prompt.id)
          )

          return {
            success: true,
            promptFolder: {
              id: promptFolder.id,
              revision: revisions.promptFolder.get(promptFolder.id),
              data: promptFolder
            },
            prompts: prompts.map((prompt) => ({
              id: prompt.id,
              revision: revisions.prompt.get(prompt.id),
              data: prompt
            }))
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to load prompt folder initial data' }
        }
      })
    }
  )
}
