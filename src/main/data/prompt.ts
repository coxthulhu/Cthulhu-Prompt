import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  UpdatedLoadPromptByIdRequest,
  UpdatedLoadPromptByIdResult,
  UpdatedPromptData
} from '@shared/ipc/updatedTypes'
import type { PromptFromFile } from './diskTypes'
import { getPromptLocation } from './registry'
import { buildResponseData } from './updatedResponse'

export const setupUpdatedPromptHandlers = (): void => {
  ipcMain.handle(
    'updated-load-prompt-by-id',
    async (
      _,
      request: UpdatedLoadPromptByIdRequest
    ): Promise<UpdatedLoadPromptByIdResult> => {
      const location = getPromptLocation(request.id)

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
          prompts?: PromptFromFile[]
        }
        const prompt = parsed.prompts?.find((item) => item.id === request.id)

        if (!prompt) {
          return { success: false, error: 'Prompt not found' }
        }

        const { id: _id, ...data } = prompt

        return {
          success: true,
          ...buildResponseData(request.id, data as UpdatedPromptData, revisions.prompt)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

}
