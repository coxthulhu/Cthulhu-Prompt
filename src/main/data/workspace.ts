import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  Prompt,
  UpdatedLoadWorkspaceByIdRequest,
  UpdatedLoadWorkspaceByIdResult,
  UpdatedLoadWorkspaceByPathRequest,
  UpdatedLoadWorkspaceByPathResult,
  UpdatedPromptFolderData,
  UpdatedWorkspaceData
} from '@shared/ipc'
import type { PromptFolderConfig } from '@shared/promptFolderConfig'
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
  const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
    workspaceId?: string
  }

  if (!parsed.workspaceId) {
    throw new Error('Invalid workspace info')
  }

  return parsed.workspaceId
}

const readPromptFolderConfig = (configPath: string): PromptFolderConfig => {
  const fs = getFs()
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as PromptFolderConfig
}

const readPromptFolders = (
  workspacePath: string
): Array<{ folderName: string; config: PromptFolderConfig }> => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts')

  if (!fs.existsSync(promptsPath)) {
    return []
  }

  const entries = fs.readdirSync(promptsPath, { withFileTypes: true })
  const folders: Array<{ folderName: string; config: PromptFolderConfig }> = []

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

const buildPromptFolderData = (
  folderName: string,
  config: PromptFolderConfig,
  promptIds: string[]
): UpdatedPromptFolderData => ({
  promptFolderId: config.promptFolderId,
  folderName,
  displayName: config.foldername,
  promptIds,
  folderDescription: config.folderDescription
})

const readPromptFolderPrompts = (workspacePath: string, folderName: string): Prompt[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts', folderName, 'Prompts.json')
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as {
    prompts?: Prompt[]
  }
  return parsed.prompts ?? []
}

export const setupUpdatedWorkspaceHandlers = (): void => {
  ipcMain.handle(
    'updated-load-workspace-by-id',
    async (_, request: UpdatedLoadWorkspaceByIdRequest): Promise<UpdatedLoadWorkspaceByIdResult> => {
      const workspacePath = getWorkspacePath(request.workspaceId)

      if (!workspacePath) {
        return { success: false, error: 'Workspace not registered' }
      }

      try {
        const promptFolderIds = readPromptFolderIds(workspacePath)
        const workspace: UpdatedWorkspaceData = {
          workspaceId: request.workspaceId,
          workspacePath,
          promptFolderIds
        }

        return {
          success: true,
          data: workspace,
          revision: revisions.workspace.get(request.workspaceId)
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

        const promptFolderSnapshots: Array<{ data: UpdatedPromptFolderData; revision: number }> = []
        const promptFolderIds: string[] = []

        for (const folder of readPromptFolders(request.workspacePath)) {
          const prompts = readPromptFolderPrompts(request.workspacePath, folder.folderName)
          const promptIds = prompts.map((prompt) => prompt.id)
          const data = buildPromptFolderData(folder.folderName, folder.config, promptIds)
          promptFolderIds.push(data.promptFolderId)
          registerPromptFolder(data.promptFolderId, request.workspacePath, folder.folderName)

          for (const prompt of prompts) {
            registerPrompt(prompt.id, request.workspacePath, folder.folderName)
          }

          promptFolderSnapshots.push({
            data,
            revision: revisions.promptFolder.get(data.promptFolderId)
          })
        }

        const workspace: UpdatedWorkspaceData = {
          workspaceId,
          workspacePath: request.workspacePath,
          promptFolderIds
        }

        return {
          success: true,
          workspace,
          workspaceRevision: revisions.workspace.get(workspaceId),
          promptFolders: promptFolderSnapshots
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )
}
