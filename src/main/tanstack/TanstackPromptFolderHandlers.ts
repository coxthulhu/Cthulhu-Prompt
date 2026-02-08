import { ipcMain } from 'electron'
import type {
  TanstackLoadPromptFolderInitialResult,
  TanstackLoadPromptFolderInitialWireRequest
} from '@shared/tanstack/TanstackPromptFolderLoad'
import { tanstackRevisions } from './TanstackRevisions'
import { getTanstackPromptFolderLocation } from './TanstackWorkspaceRegistry'
import { readTanstackPromptFolder, readTanstackPrompts } from './TanstackWorkspaceReads'

export const setupTanstackPromptFolderHandlers = (): void => {
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
