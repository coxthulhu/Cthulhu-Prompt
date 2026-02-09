import { ipcMain } from 'electron'
import * as path from 'path'
import type { TanstackWorkspace } from '@shared/tanstack/TanstackWorkspace'
import type {
  TanstackCreatePromptFolderResponsePayload,
  TanstackCreatePromptFolderResult,
  TanstackCreatePromptFolderWireRequest
} from '@shared/tanstack/TanstackPromptFolderCreate'
import type { TanstackMutationResult } from '@shared/tanstack/TanstackSystemSettingsRevision'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { getTanstackFs } from '../DataAccess/TanstackFsProvider'
import { readTanstackPromptFolder } from '../DataAccess/TanstackWorkspaceReads'
import { parseTanstackCreatePromptFolderRequest } from '../IpcFramework/TanstackIpcValidation'
import { runTanstackMutationIpcRequest } from '../IpcFramework/TanstackIpcRequest'
import { tanstackRevisions } from '../Registries/TanstackRevisions'
import {
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
}
