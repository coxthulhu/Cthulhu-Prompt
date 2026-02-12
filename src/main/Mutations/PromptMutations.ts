import { ipcMain } from 'electron'
import * as path from 'path'
import type {
  CreatePromptResponsePayload,
  CreatePromptResult,
  CreatePromptWireRequest,
  DeletePromptResponsePayload,
  DeletePromptResult,
  DeletePromptWireRequest,
  Prompt,
  PromptRevisionResponsePayload,
  UpdatePromptRevisionRequest,
  UpdatePromptRevisionResult
} from '@shared/Prompt'
import type {
  MutationResult
} from '@shared/SystemSettings'
import type { IpcRequestWithPayload } from '@shared/IpcRequest'
import type {
  PromptFolderConfigFile,
  PromptsFile
} from '../DiskTypes/WorkspaceDiskTypes'
import { getFs } from '../fs-provider'
import { readPromptFolder } from '../DataAccess/WorkspaceReads'
import {
  parseCreatePromptRequest,
  parseDeletePromptRequest,
  parseUpdatePromptRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'
import {
  getPromptLocation,
  getPromptFolderLocation,
  registerPrompts
} from '../Registries/WorkspaceRegistry'

const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPTS_FILENAME = 'Prompts.json'

const isPromptFolderPathValid = (workspacePath: string, folderName: string): boolean => {
  const fs = getFs()
  const folderPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName)
  return (
    fs.existsSync(path.join(folderPath, PROMPT_FOLDER_CONFIG_FILENAME)) &&
    fs.existsSync(path.join(folderPath, PROMPTS_FILENAME))
  )
}

const readPromptFolderConfig = (
  workspacePath: string,
  folderName: string
): PromptFolderConfigFile => {
  const fs = getFs()
  const configPath = path.join(
    workspacePath,
    PROMPTS_FOLDER_NAME,
    folderName,
    PROMPT_FOLDER_CONFIG_FILENAME
  )
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as PromptFolderConfigFile
}

const readPromptFile = (workspacePath: string, folderName: string): PromptsFile => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, folderName, PROMPTS_FILENAME)
  return JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as PromptsFile
}

const writePromptFolderConfig = (
  workspacePath: string,
  folderName: string,
  config: PromptFolderConfigFile
): void => {
  const fs = getFs()
  const configPath = path.join(
    workspacePath,
    PROMPTS_FOLDER_NAME,
    folderName,
    PROMPT_FOLDER_CONFIG_FILENAME
  )
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
}

const writePromptFile = (
  workspacePath: string,
  folderName: string,
  promptsFile: PromptsFile
): void => {
  const fs = getFs()
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

const buildPromptSnapshot = (prompt: Prompt, revision: number) => {
  return {
    id: prompt.id,
    revision,
    data: prompt
  }
}

const buildPromptFolderSnapshot = (
  promptFolder: ReturnType<typeof readPromptFolder>,
  revision: number
) => {
  return {
    id: promptFolder.id,
    revision,
    data: promptFolder
  }
}

export const setupPromptMutationHandlers = (): void => {
  ipcMain.handle(
    'create-prompt',
    async (_, request: unknown): Promise<CreatePromptResult> => {
      return await runMutationIpcRequest<
        CreatePromptWireRequest,
        MutationResult<CreatePromptResponsePayload>
      >(request, parseCreatePromptRequest, async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const promptFolderEntity = payload.promptFolder
          const promptEntity = payload.prompt
          const location = getPromptFolderLocation(promptFolderEntity.id)

          if (!location) {
            return { success: false, error: 'Prompt folder not registered' }
          }

          if (!isPromptFolderPathValid(location.workspacePath, location.folderName)) {
            return { success: false, error: 'Invalid prompt folder path' }
          }

          const currentPromptFolderRevision = revisions.promptFolder.get(promptFolderEntity.id)
          if (promptFolderEntity.expectedRevision !== currentPromptFolderRevision) {
            const promptFolder = readPromptFolder(location.workspacePath, location.folderName)
            return {
              success: false,
              conflict: true,
              payload: {
                promptFolder: buildPromptFolderSnapshot(promptFolder, currentPromptFolderRevision)
              }
            }
          }

          const promptFolderConfig = readPromptFolderConfig(
            location.workspacePath,
            location.folderName
          )
          const promptsFile = readPromptFile(location.workspacePath, location.folderName)

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
          const prompt: Prompt = {
            id: promptEntity.data.id,
            title: promptEntity.data.title,
            creationDate: now,
            lastModifiedDate: now,
            promptText: promptEntity.data.promptText,
            promptFolderCount: nextPromptCount
          }

          promptsFile.prompts.splice(insertIndex, 0, prompt)
          writePromptFile(location.workspacePath, location.folderName, promptsFile)

          promptFolderConfig.promptCount = nextPromptCount
          writePromptFolderConfig(location.workspacePath, location.folderName, promptFolderConfig)

          const promptFolder = readPromptFolder(location.workspacePath, location.folderName)
          registerPrompts(
            location.workspaceId,
            location.workspacePath,
            promptFolder.id,
            promptFolder.folderName,
            promptFolder.promptIds
          )

          const promptRevision = revisions.prompt.bump(prompt.id)
          const promptFolderRevision = revisions.promptFolder.bump(promptFolder.id)

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
    'delete-prompt',
    async (_, request: unknown): Promise<DeletePromptResult> => {
      return await runMutationIpcRequest<
        DeletePromptWireRequest,
        MutationResult<DeletePromptResponsePayload>
      >(request, parseDeletePromptRequest, async (validatedRequest) => {
        try {
          const promptFolderEntity = validatedRequest.payload.promptFolder
          const promptEntity = validatedRequest.payload.prompt
          const location = getPromptFolderLocation(promptFolderEntity.id)

          if (!location) {
            return { success: false, error: 'Prompt folder not registered' }
          }

          if (!isPromptFolderPathValid(location.workspacePath, location.folderName)) {
            return { success: false, error: 'Invalid prompt folder path' }
          }

          const promptFolder = readPromptFolder(location.workspacePath, location.folderName)
          const currentPromptFolderRevision = revisions.promptFolder.get(promptFolderEntity.id)

          if (promptFolderEntity.expectedRevision !== currentPromptFolderRevision) {
            return {
              success: false,
              conflict: true,
              payload: {
                promptFolder: buildPromptFolderSnapshot(promptFolder, currentPromptFolderRevision)
              }
            }
          }

          const currentPromptRevision = revisions.prompt.get(promptEntity.id)

          if (promptEntity.expectedRevision !== currentPromptRevision) {
            return {
              success: false,
              conflict: true,
              payload: {
                promptFolder: buildPromptFolderSnapshot(promptFolder, currentPromptFolderRevision)
              }
            }
          }

          const promptsFile = readPromptFile(location.workspacePath, location.folderName)
          const promptIndex = promptsFile.prompts.findIndex((prompt) => prompt.id === promptEntity.id)

          if (promptIndex === -1) {
            return {
              success: false,
              conflict: true,
              payload: {
                promptFolder: buildPromptFolderSnapshot(promptFolder, currentPromptFolderRevision)
              }
            }
          }

          promptsFile.prompts.splice(promptIndex, 1)
          writePromptFile(location.workspacePath, location.folderName, promptsFile)

          registerPrompts(
            location.workspaceId,
            location.workspacePath,
            promptFolder.id,
            promptFolder.folderName,
            promptsFile.prompts.map((prompt) => prompt.id)
          )

          const promptFolderRevision = revisions.promptFolder.bump(promptFolder.id)
          const nextPromptFolder = readPromptFolder(location.workspacePath, location.folderName)

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(nextPromptFolder, promptFolderRevision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to delete prompt' }
        }
      })
    }
  )

  ipcMain.handle(
    'update-prompt',
    async (_, request: unknown): Promise<UpdatePromptRevisionResult> => {
      return await runMutationIpcRequest<
        IpcRequestWithPayload<UpdatePromptRevisionRequest['payload']>,
        MutationResult<PromptRevisionResponsePayload>
      >(request, parseUpdatePromptRevisionRequest, async (validatedRequest) => {
        try {
          const promptEntity = validatedRequest.payload.prompt
          const location = getPromptLocation(promptEntity.id)

          if (!location) {
            return { success: false, error: 'Prompt not registered' }
          }

          if (!isPromptFolderPathValid(location.workspacePath, location.folderName)) {
            return { success: false, error: 'Invalid prompt folder path' }
          }

          const promptsFile = readPromptFile(location.workspacePath, location.folderName)
          const promptIndex = promptsFile.prompts.findIndex((prompt) => prompt.id === promptEntity.id)

          if (promptIndex === -1) {
            return { success: false, error: 'Prompt not found' }
          }

          const currentPromptRevision = revisions.prompt.get(promptEntity.id)

          if (promptEntity.expectedRevision !== currentPromptRevision) {
            return {
              success: false,
              conflict: true,
              payload: {
                prompt: buildPromptSnapshot(promptsFile.prompts[promptIndex], currentPromptRevision)
              }
            }
          }

          const prompt: Prompt = {
            ...promptEntity.data,
            id: promptEntity.id,
            lastModifiedDate: new Date().toISOString()
          }

          promptsFile.prompts[promptIndex] = prompt
          writePromptFile(location.workspacePath, location.folderName, promptsFile)

          registerPrompts(
            location.workspaceId,
            location.workspacePath,
            location.promptFolderId,
            location.folderName,
            promptsFile.prompts.map((savedPrompt) => savedPrompt.id)
          )

          const promptRevision = revisions.prompt.bump(prompt.id)

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
