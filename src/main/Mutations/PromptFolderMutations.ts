import { ipcMain } from 'electron'
import * as path from 'path'
import type { Workspace } from '@shared/Workspace'
import type {
  PromptFolderConfigFile,
  PromptsFile
} from '../DiskTypes/WorkspaceDiskTypes'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { getFs } from '../fs-provider'
import { readPromptFolder } from '../DataAccess/WorkspaceReads'
import {
  parseCreatePromptFolderRequest,
  parseUpdatePromptFolderRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'
import {
  getPromptFolderLocation,
  getPromptFolderIds,
  getWorkspacePath,
  registerPromptFolder,
  registerPrompts
} from '../Registries/WorkspaceRegistry'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPTS_FILENAME = 'Prompts.json'

const isWorkspacePathValid = (workspacePath: string): boolean => {
  const fs = getFs()
  return (
    fs.existsSync(path.join(workspacePath, WORKSPACE_INFO_FILENAME)) &&
    fs.existsSync(path.join(workspacePath, PROMPTS_FOLDER_NAME))
  )
}

const hasPromptFolderNameConflict = (workspacePath: string, folderName: string): boolean => {
  const fs = getFs()
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
): { id: string; revision: number; data: Workspace } => {
  return {
    id: workspaceId,
    revision,
    data: {
      id: workspaceId,
      workspacePath,
      promptFolderIds: getPromptFolderIds(workspaceId)
    }
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

const reorderPrompts = (
  prompts: PromptsFile['prompts'],
  nextPromptIds: string[]
): PromptsFile['prompts'] | null => {
  if (prompts.length !== nextPromptIds.length) {
    return null
  }

  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt] as const))
  const orderedPrompts: PromptsFile['prompts'] = []

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

export const setupPromptFolderMutationHandlers = (): void => {
  ipcMain.handle(
    'create-prompt-folder',
    async (
      _,
      request: unknown
    ) => {
      return await runMutationIpcRequest(request, parseCreatePromptFolderRequest, async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const workspace = payload.workspace
          const workspacePath = getWorkspacePath(workspace.id)

          if (!workspacePath) {
            return { success: false, error: 'Workspace not registered' }
          }

          if (!isWorkspacePathValid(workspacePath)) {
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

          const currentWorkspaceRevision = revisions.workspace.get(workspace.id)

          if (workspace.expectedRevision !== currentWorkspaceRevision) {
            return {
              success: false,
              conflict: true,
              payload: {
                workspace: buildWorkspaceSnapshot(workspace.id, workspacePath, currentWorkspaceRevision)
              }
            }
          }

          const fs = getFs()
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

          const promptFolder = readPromptFolder(workspacePath, folderName)
          registerPromptFolder(workspace.id, workspacePath, {
            id: promptFolder.id,
            folderName: promptFolder.folderName
          })
          registerPrompts(
            workspace.id,
            workspacePath,
            promptFolder.id,
            promptFolder.folderName,
            promptFolder.promptIds
          )

          const promptFolderRevision = revisions.promptFolder.bump(promptFolder.id)
          const workspaceRevision = revisions.workspace.bump(workspace.id)

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
    'update-prompt-folder',
    async (_, request: unknown) => {
      return await runMutationIpcRequest(request, parseUpdatePromptFolderRevisionRequest, async (validatedRequest) => {
        try {
          const promptFolderEntity = validatedRequest.payload.promptFolder
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
          const reorderedPrompts = reorderPrompts(
            promptsFile.prompts,
            promptFolderEntity.data.promptIds
          )

          if (!reorderedPrompts) {
            return { success: false, error: 'Invalid prompt order' }
          }

          promptFolderConfig.folderDescription = promptFolderEntity.data.folderDescription
          writePromptFolderConfig(location.workspacePath, location.folderName, promptFolderConfig)
          writePromptFile(location.workspacePath, location.folderName, {
            ...promptsFile,
            prompts: reorderedPrompts
          })

          const promptFolder = readPromptFolder(location.workspacePath, location.folderName)
          registerPrompts(
            location.workspaceId,
            location.workspacePath,
            promptFolder.id,
            promptFolder.folderName,
            promptFolder.promptIds
          )

          const promptFolderRevision = revisions.promptFolder.bump(promptFolder.id)

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
