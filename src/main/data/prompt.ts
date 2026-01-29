import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  Prompt,
  UpdatedCreatePromptRequest,
  UpdatedCreatePromptResult,
  UpdatedLoadPromptByIdRequest,
  UpdatedLoadPromptByIdResult
} from '@shared/ipc'
import type { PromptFolderConfig } from '@shared/promptFolderConfig'
import { getPromptFolderLocation, getPromptLocation, registerPrompt } from './registry'

export const setupUpdatedPromptHandlers = (): void => {
  ipcMain.handle(
    'updated-load-prompt-by-id',
    async (
      _,
      request: UpdatedLoadPromptByIdRequest
    ): Promise<UpdatedLoadPromptByIdResult> => {
      const location = getPromptLocation(request.promptId)

      if (!location) {
        return { success: false, error: 'Prompt not registered' }
      }

      try {
        const fs = getFs()
        const promptsPath = path.join(
          location.workspacePath,
          'Prompts',
          location.folderName,
          'Prompts.json'
        )
        const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as {
          prompts?: Prompt[]
        }
        const prompt = parsed.prompts?.find((item) => item.id === request.promptId)

        if (!prompt) {
          return { success: false, error: 'Prompt not found' }
        }

        return {
          success: true,
          data: prompt,
          revision: revisions.prompt.get(request.promptId)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'updated-create-prompt',
    async (_, request: UpdatedCreatePromptRequest): Promise<UpdatedCreatePromptResult> => {
      const location = getPromptFolderLocation(request.promptFolderId)

      if (!location) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      const currentPromptFolderRevision = revisions.promptFolder.get(request.promptFolderId)

      if (request.promptFolderRevision !== currentPromptFolderRevision) {
        return {
          success: false,
          conflict: true,
          data: {
            promptRevision: revisions.prompt.get(request.prompt.id),
            promptFolderRevision: currentPromptFolderRevision
          }
        }
      }

      try {
        const fs = getFs()
        const promptsPath = path.join(
          location.workspacePath,
          'Prompts',
          location.folderName,
          'Prompts.json'
        )
        const configPath = path.join(
          location.workspacePath,
          'Prompts',
          location.folderName,
          'PromptFolder.json'
        )

        const promptsFile = fs.existsSync(promptsPath)
          ? (JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as {
              prompts?: Prompt[]
              metadata?: { schemaVersion: number }
            })
          : { metadata: { schemaVersion: 1 }, prompts: [] }

        const prompts = promptsFile.prompts ?? []
        let insertIndex = prompts.length

        if (request.previousPromptId === null) {
          insertIndex = 0
        } else if (request.previousPromptId) {
          const previousIndex = prompts.findIndex(
            (prompt) => prompt.id === request.previousPromptId
          )
          if (previousIndex === -1) {
            return { success: false, error: 'Previous prompt not found' }
          }
          insertIndex = previousIndex + 1
        }

        prompts.splice(insertIndex, 0, request.prompt)
        promptsFile.prompts = prompts
        fs.writeFileSync(promptsPath, JSON.stringify(promptsFile, null, 2), 'utf8')

        const folderConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as PromptFolderConfig
        folderConfig.promptCount = request.prompt.promptFolderCount
        fs.writeFileSync(configPath, JSON.stringify(folderConfig, null, 2), 'utf8')

        registerPrompt(request.prompt.id, location.workspacePath, location.folderName)

        const nextPromptRevision = revisions.prompt.bump(request.prompt.id)
        const nextPromptFolderRevision = revisions.promptFolder.bump(request.promptFolderId)

        return {
          success: true,
          data: {
            promptRevision: nextPromptRevision,
            promptFolderRevision: nextPromptFolderRevision
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )
}
