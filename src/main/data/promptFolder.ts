import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  Prompt,
  UpdatedLoadPromptFolderByIdRequest,
  UpdatedLoadPromptFolderByIdResult,
  UpdatedLoadPromptFolderInitialRequest,
  UpdatedLoadPromptFolderInitialResult,
  UpdatedPromptFolderData
} from '@shared/ipc'
import type { PromptFolderConfig } from '@shared/promptFolderConfig'
import { getPromptFolderLocation } from './registry'

const readPromptFolderConfig = (configPath: string): PromptFolderConfig => {
  const fs = getFs()
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as PromptFolderConfig
}

const readPromptFolderData = (
  workspacePath: string,
  folderName: string
): UpdatedPromptFolderData => {
  const configPath = path.join(workspacePath, 'Prompts', folderName, 'PromptFolder.json')
  const parsed = readPromptFolderConfig(configPath)

  return {
    promptFolderId: parsed.promptFolderId,
    folderName,
    displayName: parsed.foldername,
    promptCount: parsed.promptCount,
    folderDescription: parsed.folderDescription
  }
}

const readPromptFolderPrompts = (workspacePath: string, folderName: string): Prompt[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts', folderName, 'Prompts.json')
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as {
    prompts?: Prompt[]
  }
  return parsed.prompts ?? []
}

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
        const data = readPromptFolderData(location.workspacePath, location.folderName)

        return {
          success: true,
          data,
          revision: revisions.promptFolder.get(request.promptFolderId)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'updated-load-prompt-folder-initial',
    async (
      _,
      request: UpdatedLoadPromptFolderInitialRequest
    ): Promise<UpdatedLoadPromptFolderInitialResult> => {
      const location = getPromptFolderLocation(request.promptFolderId)

      if (!location) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const data = readPromptFolderData(location.workspacePath, location.folderName)
        const prompts = readPromptFolderPrompts(location.workspacePath, location.folderName)

        return {
          success: true,
          promptFolder: {
            data,
            revision: revisions.promptFolder.get(request.promptFolderId)
          },
          prompts: prompts.map((prompt) => ({
            data: prompt,
            revision: revisions.prompt.get(prompt.id)
          }))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )
}
