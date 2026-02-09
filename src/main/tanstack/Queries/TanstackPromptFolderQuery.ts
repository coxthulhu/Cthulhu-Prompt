import { ipcMain } from 'electron'
import type {
  TanstackLoadPromptFolderInitialResult,
  TanstackLoadPromptFolderInitialWireRequest
} from '@shared/tanstack/TanstackPromptFolderLoad'
import {
  readTanstackPromptFolder,
  readTanstackPrompts
} from '../DataAccess/TanstackWorkspaceReads'
import { tanstackRevisions } from '../Registries/TanstackRevisions'
import {
  getTanstackPromptFolderLocation,
  registerTanstackPrompts
} from '../Registries/TanstackWorkspaceRegistry'

export const setupTanstackPromptFolderQueryHandlers = (): void => {
  ipcMain.handle(
    'tanstack-load-prompt-folder-initial',
    async (
      _,
      request: TanstackLoadPromptFolderInitialWireRequest
    ): Promise<TanstackLoadPromptFolderInitialResult> => {
      if (!request?.payload?.workspaceId || !request.payload.promptFolderId) {
        return { success: false, error: 'Invalid request payload' }
      }

      const location = getTanstackPromptFolderLocation(request.payload.promptFolderId)

      if (!location || location.workspaceId !== request.payload.workspaceId) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const promptFolder = readTanstackPromptFolder(location.workspacePath, location.folderName)
        const prompts = readTanstackPrompts(location.workspacePath, location.folderName)
        registerTanstackPrompts(
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
            revision: tanstackRevisions.promptFolder.get(promptFolder.id),
            data: promptFolder
          },
          prompts: prompts.map((prompt) => ({
            id: prompt.id,
            revision: tanstackRevisions.prompt.get(prompt.id),
            data: prompt
          }))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message || 'Failed to load prompt folder initial data' }
      }
    }
  )
}
