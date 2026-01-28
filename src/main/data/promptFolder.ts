import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import { getPromptFolderLocation } from './registry'

export type UpdatedPromptFolder = {
  promptFolderId: string
  folderName: string
  displayName: string
  promptCount: number
  folderDescription: string
}

type UpdatedLoadPromptFolderByIdRequest = {
  promptFolderId: string
}

type UpdatedLoadPromptFolderByIdResult =
  | { success: true; data: UpdatedPromptFolder; revision: number }
  | { success: false; error: string }

export const setupUpdatedPromptFolderHandlers = (): void => {
  ipcMain.handle(
    'updated-load-prompt-folder-by-id',
    async (
      _,
      request: UpdatedLoadPromptFolderByIdRequest
    ): Promise<UpdatedLoadPromptFolderByIdResult> => {
      const location = getPromptFolderLocation(request.promptFolderId)

      if (!location) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const fs = getFs()
        const configPath = path.join(
          location.workspacePath,
          'Prompts',
          location.folderName,
          'PromptFolder.json'
        )
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
          foldername: string
          promptFolderId: string
          promptCount: number
          folderDescription: string
        }

        return {
          success: true,
          data: {
            promptFolderId: parsed.promptFolderId,
            folderName: location.folderName,
            displayName: parsed.foldername,
            promptCount: parsed.promptCount,
            folderDescription: parsed.folderDescription
          },
          revision: revisions.promptFolder.get(request.promptFolderId)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )
}
