import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  ResponseData,
  UpdatedLoadWorkspaceByIdRequest,
  UpdatedLoadWorkspaceByIdResult,
  UpdatedLoadWorkspaceByPathRequest,
  UpdatedLoadWorkspaceByPathResult,
  UpdatedPromptFolderData,
  UpdatedWorkspaceData
} from '@shared/ipc/updatedTypes'
import type { WorkspaceInfoFile } from './diskTypes'
import { buildPromptFolderData } from './promptFolder'
import {
  getWorkspacePath,
  registerPrompt,
  registerPromptFolder,
  registerWorkspace,
  resetRegistry
} from './registry'
import { buildResponseData } from './updatedResponse'
import {
  readPromptFolderIds,
  readPromptFolderPrompts,
  readPromptFolders
} from './updatedWorkspaceReads'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'


const readWorkspaceId = (workspacePath: string): string => {
  const fs = getFs()
  const settingsPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)
  const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as WorkspaceInfoFile

  if (!parsed?.workspaceId) {
    throw new Error('Invalid workspace info')
  }

  return parsed.workspaceId
}


export const setupUpdatedWorkspaceHandlers = (): void => {
  ipcMain.handle(
    'updated-load-workspace-by-id',
    async (_, request: UpdatedLoadWorkspaceByIdRequest): Promise<UpdatedLoadWorkspaceByIdResult> => {
      const workspacePath = getWorkspacePath(request.id)

      if (!workspacePath) {
        return { success: false, error: 'Workspace not registered' }
      }

      try {
        const promptFolderIds = readPromptFolderIds(workspacePath)
        const workspace: UpdatedWorkspaceData = {
          workspacePath,
          promptFolderIds
        }
        return {
          success: true,
          ...buildResponseData(request.id, workspace, revisions.workspace)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'updated-load-workspace-by-path',
    async (
      _,
      request: UpdatedLoadWorkspaceByPathRequest
    ): Promise<UpdatedLoadWorkspaceByPathResult> => {
      try {
        const workspaceId = readWorkspaceId(request.workspacePath)

        // Rebuild the GUID registry from disk for this workspace load.
        resetRegistry()
        registerWorkspace(workspaceId, request.workspacePath)

        const promptFolderSnapshots: Array<ResponseData<UpdatedPromptFolderData>> = []
        const promptFolderIds: string[] = []

        for (const folder of readPromptFolders(request.workspacePath)) {
          const prompts = readPromptFolderPrompts(request.workspacePath, folder.folderName)
          const promptIds = prompts.map((prompt) => prompt.id)
          const data = buildPromptFolderData(folder.folderName, folder.config, promptIds)
          promptFolderIds.push(folder.config.promptFolderId)
          registerPromptFolder(
            folder.config.promptFolderId,
            request.workspacePath,
            folder.folderName
          )

          for (const prompt of prompts) {
            registerPrompt(prompt.id, request.workspacePath, folder.folderName)
          }

          promptFolderSnapshots.push(
            buildResponseData(folder.config.promptFolderId, data, revisions.promptFolder)
          )
        }

        const workspace: UpdatedWorkspaceData = {
          workspacePath: request.workspacePath,
          promptFolderIds
        }

        return {
          success: true,
          workspace: buildResponseData(workspaceId, workspace, revisions.workspace),
          promptFolders: promptFolderSnapshots
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

}
