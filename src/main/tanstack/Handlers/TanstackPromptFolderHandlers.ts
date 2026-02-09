import { ipcMain } from 'electron'
import * as path from 'path'
import type {
  TanstackLoadPromptFolderInitialResult,
  TanstackLoadPromptFolderInitialWireRequest
} from '@shared/tanstack/TanstackPromptFolderLoad'
import type { TanstackWorkspace } from '@shared/tanstack/TanstackWorkspace'
import type {
  TanstackCreatePromptFolderResult,
  TanstackCreatePromptFolderWireRequest
} from '@shared/tanstack/TanstackPromptFolderCreate'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { getTanstackFs } from '../DataAccess/TanstackFsProvider'
import { runTanstackIpcRequest } from '../IpcFramework/TanstackIpcRequest'
import { tanstackRevisions } from '../Registries/TanstackRevisions'
import {
  getTanstackPromptFolderIds,
  getTanstackPromptFolderLocation,
  registerTanstackPromptFolder,
  registerTanstackPrompts,
  getTanstackWorkspacePath
} from '../Registries/TanstackWorkspaceRegistry'
import { readTanstackPromptFolder, readTanstackPrompts } from '../DataAccess/TanstackWorkspaceReads'

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

export const setupTanstackPromptFolderHandlers = (): void => {
  ipcMain.handle(
    'tanstack-create-prompt-folder',
    async (
      _,
      request: TanstackCreatePromptFolderWireRequest | undefined
    ): Promise<TanstackCreatePromptFolderResult> => {
      if (
        !request?.requestId ||
        !request.payload?.workspace ||
        !request.payload.promptFolderId ||
        !request.payload.displayName
      ) {
        return { requestId: request?.requestId ?? '', success: false, error: 'Invalid request payload' }
      }

      return runTanstackIpcRequest(request, async (payload) => {
        try {
          const workspace = payload.workspace

          if (
            !workspace.id ||
            typeof workspace.expectedRevision !== 'number' ||
            !payload.promptFolderId
          ) {
            return { success: false, error: 'Invalid request payload' }
          }

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
    'tanstack-load-prompt-folder-initial',
    async (
      _,
      request: TanstackLoadPromptFolderInitialWireRequest
    ): Promise<TanstackLoadPromptFolderInitialResult> => {
      if (!request?.payload?.workspaceId || !request.payload.promptFolderId) {
        return { success: false, error: 'Invalid request payload' }
      }

      const location = getTanstackPromptFolderLocation(request.payload.promptFolderId)

      if (!location || location.workspaceId !== request.payload.workspaceId) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const promptFolder = readTanstackPromptFolder(location.workspacePath, location.folderName)
        const prompts = readTanstackPrompts(location.workspacePath, location.folderName)
        registerTanstackPrompts(
          location.workspaceId,
          location.workspacePath,
          promptFolder.id,
          promptFolder.folderName,
          prompts.map((prompt) => prompt.id)
        )

        return {
          success: true,
          promptFolder: {
            id: promptFolder.id,
            revision: tanstackRevisions.promptFolder.get(promptFolder.id),
            data: promptFolder
          },
          prompts: prompts.map((prompt) => ({
            id: prompt.id,
            revision: tanstackRevisions.prompt.get(prompt.id),
            data: prompt
          }))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message || 'Failed to load prompt folder initial data' }
      }
    }
  )
}
