import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  UpdatedLoadPromptFolderByIdRequest,
  UpdatedLoadPromptFolderByIdResult,
  UpdatedLoadPromptFolderInitialRequest,
  UpdatedLoadPromptFolderInitialResult,
  UpdatedPromptData,
  UpdatedPromptFolderData
} from '@shared/ipc/updatedTypes'
import type { PromptFolderConfigFile, PromptFromFile } from './diskTypes'
import { getPromptFolderLocation } from './registry'
import { buildResponseData } from './updatedResponse'

const readPromptFolderConfig = (configPath: string): PromptFolderConfigFile => {
  const fs = getFs()
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as PromptFolderConfigFile
}

const readPromptFolderData = (
  workspacePath: string,
  folderName: string,
  promptIds?: string[]
): UpdatedPromptFolderData => {
  const configPath = path.join(workspacePath, 'Prompts', folderName, 'PromptFolder.json')
  const parsed = readPromptFolderConfig(configPath)
  const resolvedPromptIds =
    promptIds ?? readPromptFolderPrompts(workspacePath, folderName).map((prompt) => prompt.id)

  return {
    folderName,
    displayName: parsed.foldername,
    promptCount: parsed.promptCount,
    promptIds: resolvedPromptIds,
    folderDescription: parsed.folderDescription
  }
}

export const buildPromptFolderData = (
  folderName: string,
  config: PromptFolderConfigFile,
  promptIds: string[]
): UpdatedPromptFolderData => ({
  folderName,
  displayName: config.foldername,
  promptCount: config.promptCount,
  promptIds,
  folderDescription: config.folderDescription
})

const readPromptFolderPrompts = (
  workspacePath: string,
  folderName: string
): PromptFromFile[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts', folderName, 'Prompts.json')
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as {
    prompts?: PromptFromFile[]
  }
  return parsed.prompts ?? []
}

const toUpdatedPromptData = (prompt: PromptFromFile): UpdatedPromptData => {
  const { id: _id, ...data } = prompt
  return data
}

export const setupUpdatedPromptFolderHandlers = (): void => {
  ipcMain.handle(
    'updated-load-prompt-folder-by-id',
    async (
      _,
      request: UpdatedLoadPromptFolderByIdRequest
    ): Promise<UpdatedLoadPromptFolderByIdResult> => {
      const location = getPromptFolderLocation(request.id)

      if (!location) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const data = readPromptFolderData(location.workspacePath, location.folderName)

        return {
          success: true,
          ...buildResponseData(request.id, data, revisions.promptFolder)
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
      const location = getPromptFolderLocation(request.id)

      if (!location) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const prompts = readPromptFolderPrompts(location.workspacePath, location.folderName)
        const data = readPromptFolderData(
          location.workspacePath,
          location.folderName,
          prompts.map((prompt) => prompt.id)
        )

        return {
          success: true,
          promptFolder: buildResponseData(request.id, data, revisions.promptFolder),
          prompts: prompts.map((prompt) =>
            buildResponseData(prompt.id, toUpdatedPromptData(prompt), revisions.prompt)
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

}
