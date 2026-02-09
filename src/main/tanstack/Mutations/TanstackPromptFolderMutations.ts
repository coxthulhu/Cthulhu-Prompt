import { ipcMain } from 'electron'
import * as path from 'path'
import type { TanstackWorkspace } from '@shared/tanstack/TanstackWorkspace'
import type {
  TanstackCreatePromptFolderResponsePayload,
  TanstackCreatePromptFolderResult,
  TanstackCreatePromptFolderWireRequest
} from '@shared/tanstack/TanstackPromptFolderCreate'
import type {
  TanstackPromptFolderRevisionResponsePayload,
  TanstackUpdatePromptFolderRevisionRequest,
  TanstackUpdatePromptFolderRevisionResult
} from '@shared/tanstack/TanstackPromptFolderRevision'
import type {
  TanstackPromptFolderConfigFile,
  TanstackPromptsFile
} from '@shared/tanstack/TanstackWorkspaceDiskTypes'
import type {
  TanstackMutationResult,
  TanstackMutationWireRequest
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { getTanstackFs } from '../DataAccess/TanstackFsProvider'
import { readTanstackPromptFolder } from '../DataAccess/TanstackWorkspaceReads'
import {
  parseTanstackCreatePromptFolderRequest,
  parseTanstackUpdatePromptFolderRevisionRequest
} from '../IpcFramework/TanstackIpcValidation'
import { runTanstackMutationIpcRequest } from '../IpcFramework/TanstackIpcRequest'
import { tanstackRevisions } from '../Registries/TanstackRevisions'
import {
  getTanstackPromptFolderLocation,
  getTanstackPromptFolderIds,
  getTanstackWorkspacePath,
  registerTanstackPromptFolder,
  registerTanstackPrompts
} from '../Registries/TanstackWorkspaceRegistry'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPTS_FILENAME = 'Prompts.json'

const isTanstackWorkspacePathValid = (workspacePath: string): boolean => {
  const fs = getTanstackFs()
  return (
    fs.existsSync(path.join(workspacePath, WORKSPACE_INFO_FILENAME)) &&
    fs.existsSync(path.join(workspacePath, PROMPTS_FOLDER_NAME))
  )
}

const hasPromptFolderNameConflict = (workspacePath: string, folderName: string): boolean => {
  const fs = getTanstackFs()
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME)
  const normalizedTargetName = folderName.toLowerCase()
  const entries = fs.readdirSync(promptsPath, { withFileTypes: true })

  return entries.some(
    (entry) => entry.isDirectory() && entry.name.toLowerCase() === normalizedTargetName
  )
}

const buildWorkspaceSnapshot = (
  workspaceId: string,
  workspacePath: string,
  revision: number
): { id: string; revision: number; data: TanstackWorkspace } => {
  return {
    id: workspaceId,
    revision,
    data: {
      id: workspaceId,
      workspacePath,
      promptFolderIds: getTanstackPromptFolderIds(workspaceId)
    }
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

const reorderTanstackPrompts = (
  prompts: TanstackPromptsFile['prompts'],
  nextPromptIds: string[]
): TanstackPromptsFile['prompts'] | null => {
  if (prompts.length !== nextPromptIds.length) {
    return null
  }

  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt] as const))
  const orderedPrompts: TanstackPromptsFile['prompts'] = []

  for (const promptId of nextPromptIds) {
    const prompt = promptById.get(promptId)

    if (!prompt) {
      return null
    }

    orderedPrompts.push(prompt)
    promptById.delete(promptId)
  }

  if (promptById.size > 0) {
    return null
  }

  return orderedPrompts
}

export const setupTanstackPromptFolderMutationHandlers = (): void => {
  ipcMain.handle(
    'tanstack-create-prompt-folder',
    async (
      _,
      request: unknown
    ): Promise<TanstackCreatePromptFolderResult> => {
      return await runTanstackMutationIpcRequest<
        TanstackCreatePromptFolderWireRequest,
        TanstackMutationResult<TanstackCreatePromptFolderResponsePayload>
      >(request, parseTanstackCreatePromptFolderRequest, async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const workspace = payload.workspace
          const workspacePath = getTanstackWorkspacePath(workspace.id)

          if (!workspacePath) {
            return { success: false, error: 'Workspace not registered' }
          }

          if (!isTanstackWorkspacePathValid(workspacePath)) {
            return { success: false, error: 'Invalid workspace path' }
          }

          const {
            validation,
            displayName: normalizedDisplayName,
            folderName
          } = preparePromptFolderName(payload.displayName)

          if (!validation.isValid) {
            return { success: false, error: validation.errorMessage ?? 'Invalid prompt folder name' }
          }

          const currentWorkspaceRevision = tanstackRevisions.workspace.get(workspace.id)

          if (workspace.expectedRevision !== currentWorkspaceRevision) {
            return {
              success: false,
              conflict: true,
              payload: {
                workspace: buildWorkspaceSnapshot(workspace.id, workspacePath, currentWorkspaceRevision)
              }
            }
          }

          const fs = getTanstackFs()
          const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME)
          const folderPath = path.join(promptsPath, folderName)

          if (
            hasPromptFolderNameConflict(workspacePath, folderName) ||
            fs.existsSync(folderPath)
          ) {
            return { success: false, error: 'A folder with this name already exists' }
          }

          fs.mkdirSync(folderPath, { recursive: true })

          const promptFolderConfigPath = path.join(folderPath, PROMPT_FOLDER_CONFIG_FILENAME)
          fs.writeFileSync(
            promptFolderConfigPath,
            JSON.stringify(
              {
                foldername: normalizedDisplayName,
                promptFolderId: payload.promptFolderId,
                promptCount: 0,
                folderDescription: ''
              },
              null,
              2
            ),
            'utf8'
          )

          const promptsFilePath = path.join(folderPath, PROMPTS_FILENAME)
          fs.writeFileSync(
            promptsFilePath,
            JSON.stringify({ metadata: { schemaVersion: 1 }, prompts: [] }, null, 2),
            'utf8'
          )

          const promptFolder = readTanstackPromptFolder(workspacePath, folderName)
          registerTanstackPromptFolder(workspace.id, workspacePath, {
            id: promptFolder.id,
            folderName: promptFolder.folderName
          })
          registerTanstackPrompts(
            workspace.id,
            workspacePath,
            promptFolder.id,
            promptFolder.folderName,
            promptFolder.promptIds
          )

          const promptFolderRevision = tanstackRevisions.promptFolder.bump(promptFolder.id)
          const workspaceRevision = tanstackRevisions.workspace.bump(workspace.id)

          return {
            success: true,
            payload: {
              workspace: buildWorkspaceSnapshot(workspace.id, workspacePath, workspaceRevision),
              promptFolder: buildPromptFolderSnapshot(promptFolder, promptFolderRevision)
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
    'tanstack-update-prompt-folder',
    async (_, request: unknown): Promise<TanstackUpdatePromptFolderRevisionResult> => {
      return await runTanstackMutationIpcRequest<
        TanstackMutationWireRequest<TanstackUpdatePromptFolderRevisionRequest>,
        TanstackMutationResult<TanstackPromptFolderRevisionResponsePayload>
      >(request, parseTanstackUpdatePromptFolderRevisionRequest, async (validatedRequest) => {
        try {
          const promptFolderEntity = validatedRequest.payload.promptFolder
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
          const reorderedPrompts = reorderTanstackPrompts(
            promptsFile.prompts,
            promptFolderEntity.data.promptIds
          )

          if (!reorderedPrompts) {
            return { success: false, error: 'Invalid prompt order' }
          }

          promptFolderConfig.folderDescription = promptFolderEntity.data.folderDescription
          writeTanstackPromptFolderConfig(location.workspacePath, location.folderName, promptFolderConfig)
          writeTanstackPromptFile(location.workspacePath, location.folderName, {
            ...promptsFile,
            prompts: reorderedPrompts
          })

          const promptFolder = readTanstackPromptFolder(location.workspacePath, location.folderName)
          registerTanstackPrompts(
            location.workspaceId,
            location.workspacePath,
            promptFolder.id,
            promptFolder.folderName,
            promptFolder.promptIds
          )

          const promptFolderRevision = tanstackRevisions.promptFolder.bump(promptFolder.id)

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(promptFolder, promptFolderRevision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message }
        }
      })
    }
  )
}
