import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  UpdatedCreatePromptRequest,
  UpdatedCreatePromptResult,
  UpdatedLoadPromptByIdRequest,
  UpdatedLoadPromptByIdResult,
  UpdatedPromptData
} from '@shared/ipc/updatedTypes'
import type { PromptFromFile, PromptsFile } from './diskTypes'
import { buildPromptFolderData } from './promptFolder'
import { getPromptFolderLocation, getPromptLocation, registerPrompt } from './registry'
import { runExclusiveUpdatedWorkspaceOperation } from './updatedFileOperations'
import { runUpdatedMutation } from './updatedMutations'
import { buildResponseData } from './updatedResponse'
import { readPromptFolderConfig, readPromptFolderPrompts } from './updatedWorkspaceReads'

const readPromptsFile = (promptsPath: string): PromptsFile => {
  const fs = getFs()
  return JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as PromptsFile
}

const writePromptsFile = (promptsPath: string, data: PromptsFile): void => {
  const fs = getFs()
  fs.writeFileSync(promptsPath, JSON.stringify(data, null, 2), 'utf8')
}

const toUpdatedPromptData = (prompt: PromptFromFile): UpdatedPromptData => {
  const { id: _id, ...data } = prompt
  return data
}

const buildPromptFolderResponse = (
  promptFolderId: string,
  workspacePath: string,
  folderName: string
) => {
  const configPath = path.join(workspacePath, 'Prompts', folderName, 'PromptFolder.json')
  const config = readPromptFolderConfig(configPath)
  const prompts = readPromptFolderPrompts(workspacePath, folderName)
  const promptIds = prompts.map((prompt) => prompt.id)
  const data = buildPromptFolderData(folderName, config, promptIds)
  return buildResponseData(promptFolderId, data, revisions.promptFolder)
}

export const setupUpdatedPromptHandlers = (): void => {
  ipcMain.handle(
    'updated-load-prompt-by-id',
    async (_, request: UpdatedLoadPromptByIdRequest): Promise<UpdatedLoadPromptByIdResult> => {
      const location = getPromptLocation(request.id)

      if (!location) {
        return { success: false, error: 'Prompt not registered' }
      }

      try {
        const promptsPath = path.join(
          location.workspacePath,
          'Prompts',
          location.folderName,
          'Prompts.json'
        )
        const parsed = readPromptsFile(promptsPath)
        const prompt = parsed.prompts.find((item) => item.id === request.id)

        if (!prompt) {
          return { success: false, error: 'Prompt not found' }
        }

        return {
          success: true,
          ...buildResponseData(request.id, toUpdatedPromptData(prompt), revisions.prompt)
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
      return await runUpdatedMutation(request, async (respond, mutationRequest) => {
        const { data, expectedRevision } = mutationRequest.payload
        const location = getPromptFolderLocation(data.promptFolderId)

        if (!location) {
          return respond.error('Prompt folder not registered')
        }

        try {
          return await runExclusiveUpdatedWorkspaceOperation(location.workspacePath, async () => {
            const currentRevision = revisions.promptFolder.get(data.promptFolderId)

            if (expectedRevision !== currentRevision) {
              return respond.conflict({
                promptFolder: buildPromptFolderResponse(
                  data.promptFolderId,
                  location.workspacePath,
                  location.folderName
                )
              })
            }

            const fs = getFs()
            const folderPath = path.join(location.workspacePath, 'Prompts', location.folderName)
            const promptsPath = path.join(folderPath, 'Prompts.json')
            const configPath = path.join(folderPath, 'PromptFolder.json')

            if (!fs.existsSync(promptsPath) || !fs.existsSync(configPath)) {
              return respond.error('Invalid prompt folder path')
            }

            const promptsFile = readPromptsFile(promptsPath)
            const folderConfig = readPromptFolderConfig(configPath)
            const nextPromptCount = folderConfig.promptCount + 1

            let insertIndex = promptsFile.prompts.length
            if (data.insertAfterPromptId === null) {
              insertIndex = 0
            } else {
              const previousIndex = promptsFile.prompts.findIndex(
                (prompt) => prompt.id === data.insertAfterPromptId
              )
              if (previousIndex === -1) {
                return respond.error('Previous prompt not found')
              }
              insertIndex = previousIndex + 1
            }

            const now = new Date().toISOString()
            const promptId = randomUUID()
            const newPrompt: PromptFromFile = {
              id: promptId,
              title: data.title,
              creationDate: now,
              lastModifiedDate: now,
              promptText: data.promptText,
              promptFolderCount: nextPromptCount
            }

            promptsFile.prompts.splice(insertIndex, 0, newPrompt)
            writePromptsFile(promptsPath, promptsFile)

            folderConfig.promptCount = nextPromptCount
            fs.writeFileSync(configPath, JSON.stringify(folderConfig, null, 2), 'utf8')

            registerPrompt(promptId, location.workspacePath, location.folderName)
            revisions.prompt.setClientTempId(promptId, data.clientTempId)
            revisions.prompt.bump(promptId)
            revisions.promptFolder.bump(data.promptFolderId)

            return respond.success({
              promptFolder: buildPromptFolderResponse(
                data.promptFolderId,
                location.workspacePath,
                location.folderName
              ),
              prompt: buildResponseData(promptId, toUpdatedPromptData(newPrompt), revisions.prompt)
            })
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return respond.error(message)
        }
      })
    }
  )
}
