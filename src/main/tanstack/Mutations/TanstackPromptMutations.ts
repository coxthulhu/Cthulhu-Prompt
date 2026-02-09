import { ipcMain } from 'electron'
import * as path from 'path'
import type { TanstackPrompt } from '@shared/tanstack/TanstackPrompt'
import type {
  TanstackCreatePromptResponsePayload,
  TanstackCreatePromptResult,
  TanstackCreatePromptWireRequest
} from '@shared/tanstack/TanstackPromptCreate'
import type {
  TanstackPromptRevisionResponsePayload,
  TanstackUpdatePromptRevisionRequest,
  TanstackUpdatePromptRevisionResult
} from '@shared/tanstack/TanstackPromptRevision'
import type {
  TanstackMutationResult,
  TanstackMutationWireRequest
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import type {
  TanstackPromptFolderConfigFile,
  TanstackPromptsFile
} from '@shared/tanstack/TanstackWorkspaceDiskTypes'
import { getTanstackFs } from '../DataAccess/TanstackFsProvider'
import { readTanstackPromptFolder } from '../DataAccess/TanstackWorkspaceReads'
import {
  parseTanstackCreatePromptRequest,
  parseTanstackUpdatePromptRevisionRequest
} from '../IpcFramework/TanstackIpcValidation'
import { runTanstackMutationIpcRequest } from '../IpcFramework/TanstackIpcRequest'
import { tanstackRevisions } from '../Registries/TanstackRevisions'
import {
  getTanstackPromptLocation,
  getTanstackPromptFolderLocation,
  registerTanstackPrompts
} from '../Registries/TanstackWorkspaceRegistry'

const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPTS_FILENAME = 'Prompts.json'

const isTanstackPromptFolderPathValid = (workspacePath: string, folderName: string): boolean => {
  const fs = getTanstackFs()
  const folderPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName)
  return (
    fs.existsSync(path.join(folderPath, PROMPT_FOLDER_CONFIG_FILENAME)) &&
    fs.existsSync(path.join(folderPath, PROMPTS_FILENAME))
  )
}

const readTanstackPromptFolderConfig = (
  workspacePath: string,
  folderName: string
): TanstackPromptFolderConfigFile => {
  const fs = getTanstackFs()
  const configPath = path.join(
    workspacePath,
    PROMPTS_FOLDER_NAME,
    folderName,
    PROMPT_FOLDER_CONFIG_FILENAME
  )
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as TanstackPromptFolderConfigFile
}

const readTanstackPromptFile = (workspacePath: string, folderName: string): TanstackPromptsFile => {
  const fs = getTanstackFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  return JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as TanstackPromptsFile
}

const writeTanstackPromptFolderConfig = (
  workspacePath: string,
  folderName: string,
  config: TanstackPromptFolderConfigFile
): void => {
  const fs = getTanstackFs()
  const configPath = path.join(
    workspacePath,
    PROMPTS_FOLDER_NAME,
    folderName,
    PROMPT_FOLDER_CONFIG_FILENAME
  )
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
}

const writeTanstackPromptFile = (
  workspacePath: string,
  folderName: string,
  promptsFile: TanstackPromptsFile
): void => {
  const fs = getTanstackFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  fs.writeFileSync(
    promptsPath,
    JSON.stringify(
      {
        metadata: promptsFile.metadata ?? { schemaVersion: 1 },
        prompts: promptsFile.prompts
      },
      null,
      2
    ),
    'utf8'
  )
}

const buildPromptSnapshot = (prompt: TanstackPrompt, revision: number) => {
  return {
    id: prompt.id,
    revision,
    data: prompt
  }
}

const buildPromptFolderSnapshot = (
  promptFolder: ReturnType<typeof readTanstackPromptFolder>,
  revision: number
) => {
  return {
    id: promptFolder.id,
    revision,
    data: promptFolder
  }
}

export const setupTanstackPromptMutationHandlers = (): void => {
  ipcMain.handle(
    'tanstack-create-prompt',
    async (_, request: unknown): Promise<TanstackCreatePromptResult> => {
      return await runTanstackMutationIpcRequest<
        TanstackCreatePromptWireRequest,
        TanstackMutationResult<TanstackCreatePromptResponsePayload>
      >(request, parseTanstackCreatePromptRequest, async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const promptFolderEntity = payload.promptFolder
          const promptEntity = payload.prompt
          const location = getTanstackPromptFolderLocation(promptFolderEntity.id)

          if (!location) {
            return { success: false, error: 'Prompt folder not registered' }
          }

          if (!isTanstackPromptFolderPathValid(location.workspacePath, location.folderName)) {
            return { success: false, error: 'Invalid prompt folder path' }
          }

          const currentPromptFolderRevision = tanstackRevisions.promptFolder.get(promptFolderEntity.id)
          if (promptFolderEntity.expectedRevision !== currentPromptFolderRevision) {
            const promptFolder = readTanstackPromptFolder(location.workspacePath, location.folderName)
            return {
              success: false,
              conflict: true,
              payload: {
                promptFolder: buildPromptFolderSnapshot(promptFolder, currentPromptFolderRevision)
              }
            }
          }

          const promptFolderConfig = readTanstackPromptFolderConfig(
            location.workspacePath,
            location.folderName
          )
          const promptsFile = readTanstackPromptFile(location.workspacePath, location.folderName)

          if (promptsFile.prompts.some((prompt) => prompt.id === promptEntity.data.id)) {
            return { success: false, error: 'Prompt already exists' }
          }

          let insertIndex = promptsFile.prompts.length
          if (payload.previousPromptId === null) {
            insertIndex = 0
          } else {
            const previousIndex = promptsFile.prompts.findIndex(
              (prompt) => prompt.id === payload.previousPromptId
            )
            if (previousIndex === -1) {
              return { success: false, error: 'Previous prompt not found' }
            }
            insertIndex = previousIndex + 1
          }

          const nextPromptCount = promptFolderConfig.promptCount + 1
          const now = new Date().toISOString()
          const prompt: TanstackPrompt = {
            id: promptEntity.data.id,
            title: promptEntity.data.title,
            creationDate: now,
            lastModifiedDate: now,
            promptText: promptEntity.data.promptText,
            promptFolderCount: nextPromptCount
          }

          promptsFile.prompts.splice(insertIndex, 0, prompt)
          writeTanstackPromptFile(location.workspacePath, location.folderName, promptsFile)

          promptFolderConfig.promptCount = nextPromptCount
          writeTanstackPromptFolderConfig(location.workspacePath, location.folderName, promptFolderConfig)

          const promptFolder = readTanstackPromptFolder(location.workspacePath, location.folderName)
          registerTanstackPrompts(
            location.workspaceId,
            location.workspacePath,
            promptFolder.id,
            promptFolder.folderName,
            promptFolder.promptIds
          )

          const promptRevision = tanstackRevisions.prompt.bump(prompt.id)
          const promptFolderRevision = tanstackRevisions.promptFolder.bump(promptFolder.id)

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(promptFolder, promptFolderRevision),
              prompt: buildPromptSnapshot(prompt, promptRevision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message }
        }
      })
    }
  )

  ipcMain.handle(
    'tanstack-update-prompt',
    async (_, request: unknown): Promise<TanstackUpdatePromptRevisionResult> => {
      return await runTanstackMutationIpcRequest<
        TanstackMutationWireRequest<TanstackUpdatePromptRevisionRequest>,
        TanstackMutationResult<TanstackPromptRevisionResponsePayload>
      >(request, parseTanstackUpdatePromptRevisionRequest, async (validatedRequest) => {
        try {
          const promptEntity = validatedRequest.payload.prompt
          const location = getTanstackPromptLocation(promptEntity.id)

          if (!location) {
            return { success: false, error: 'Prompt not registered' }
          }

          if (!isTanstackPromptFolderPathValid(location.workspacePath, location.folderName)) {
            return { success: false, error: 'Invalid prompt folder path' }
          }

          const promptsFile = readTanstackPromptFile(location.workspacePath, location.folderName)
          const promptIndex = promptsFile.prompts.findIndex((prompt) => prompt.id === promptEntity.id)

          if (promptIndex === -1) {
            return { success: false, error: 'Prompt not found' }
          }

          const currentPromptRevision = tanstackRevisions.prompt.get(promptEntity.id)

          if (promptEntity.expectedRevision !== currentPromptRevision) {
            return {
              success: false,
              conflict: true,
              payload: {
                prompt: buildPromptSnapshot(promptsFile.prompts[promptIndex], currentPromptRevision)
              }
            }
          }

          const prompt: TanstackPrompt = {
            ...promptEntity.data,
            id: promptEntity.id,
            lastModifiedDate: new Date().toISOString()
          }

          promptsFile.prompts[promptIndex] = prompt
          writeTanstackPromptFile(location.workspacePath, location.folderName, promptsFile)

          registerTanstackPrompts(
            location.workspaceId,
            location.workspacePath,
            location.promptFolderId,
            location.folderName,
            promptsFile.prompts.map((savedPrompt) => savedPrompt.id)
          )

          const promptRevision = tanstackRevisions.prompt.bump(prompt.id)

          return {
            success: true,
            payload: {
              prompt: buildPromptSnapshot(prompt, promptRevision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to update prompt' }
        }
      })
    }
  )
}
