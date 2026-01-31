import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  Prompt,
  UpdatedLoadPromptByIdRequest,
  UpdatedLoadPromptByIdResult
} from '@shared/ipc'
import { getPromptLocation } from './registry'

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

}
