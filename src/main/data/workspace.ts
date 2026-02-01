import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  UpdatedLoadWorkspaceByIdRequest,
  UpdatedLoadWorkspaceByIdResult,
  UpdatedLoadWorkspaceByPathRequest,
  UpdatedLoadWorkspaceByPathResult,
  UpdatedPromptFolderData,
  UpdatedWorkspaceData
} from '@shared/ipc/updatedTypes'
import type {
  PromptFolderConfigFile,
  PromptFromFile,
  WorkspaceInfoFile
} from './diskTypes'
import { buildPromptFolderData } from './promptFolder'
import {
  getWorkspacePath,
  registerPrompt,
  registerPromptFolder,
  registerWorkspace,
  resetRegistry
} from './registry'

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

const readPromptFolderConfig = (configPath: string): PromptFolderConfigFile => {
  const fs = getFs()
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as PromptFolderConfigFile
}

const readPromptFolders = (
  workspacePath: string
): Array<{ folderName: string; config: PromptFolderConfigFile }> => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts')

  if (!fs.existsSync(promptsPath)) {
    return []
  }

  const entries = fs.readdirSync(promptsPath, { withFileTypes: true })
  const folders: Array<{ folderName: string; config: PromptFolderConfigFile }> = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const folderName = entry.name
    const configPath = path.join(promptsPath, folderName, 'PromptFolder.json')
    const config = readPromptFolderConfig(configPath)
    folders.push({ folderName, config })
  }

  return folders
}

const readPromptFolderIds = (workspacePath: string): string[] =>
  readPromptFolders(workspacePath).map((folder) => folder.config.promptFolderId)

const readPromptFolderPrompts = (
  workspacePath: string,
  folderName: string
): PromptFromFile[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts', folderName, 'Prompts.json')
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as {
    prompts?: PromptFromFile[]
  }
  return parsed.prompts ?? []
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
        const clientTempId = revisions.workspace.getClientTempId(request.id)

        return {
          success: true,
          id: request.id,
          data: workspace,
          revision: revisions.workspace.get(request.id),
          ...(clientTempId !== undefined ? { clientTempId } : {})
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

        const promptFolderSnapshots: Array<{
          id: string
          data: UpdatedPromptFolderData
          revision: number
          clientTempId?: string
        }> = []
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

          const promptFolderClientTempId = revisions.promptFolder.getClientTempId(
            folder.config.promptFolderId
          )

          promptFolderSnapshots.push({
            id: folder.config.promptFolderId,
            data,
            revision: revisions.promptFolder.get(folder.config.promptFolderId),
            ...(promptFolderClientTempId !== undefined
              ? { clientTempId: promptFolderClientTempId }
              : {})
          })
        }

        const workspace: UpdatedWorkspaceData = {
          workspacePath: request.workspacePath,
          promptFolderIds
        }
        const workspaceClientTempId = revisions.workspace.getClientTempId(workspaceId)

        return {
          success: true,
          workspace: {
            id: workspaceId,
            data: workspace,
            revision: revisions.workspace.get(workspaceId),
            ...(workspaceClientTempId !== undefined
              ? { clientTempId: workspaceClientTempId }
              : {})
          },
          promptFolders: promptFolderSnapshots
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )
}
