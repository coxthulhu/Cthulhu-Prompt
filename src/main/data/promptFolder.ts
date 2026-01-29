import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  Prompt,
  UpdatedCreatePromptFolderRequest,
  UpdatedCreatePromptFolderResult,
  UpdatedLoadPromptFolderByIdRequest,
  UpdatedLoadPromptFolderByIdResult,
  UpdatedLoadPromptFolderInitialRequest,
  UpdatedLoadPromptFolderInitialResult,
  UpdatedPromptFolderData
} from '@shared/ipc'
import { createPromptFolderConfig, type PromptFolderConfig } from '@shared/promptFolderConfig'
import { PromptAPI } from '../prompt-api'
import { getPromptFolderLocation, getWorkspacePath, registerPromptFolder } from './registry'

const readPromptFolderConfig = (configPath: string): PromptFolderConfig => {
  const fs = getFs()
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as PromptFolderConfig
}

const readPromptFolderData = (
  workspacePath: string,
  folderName: string
): UpdatedPromptFolderData => {
  const configPath = path.join(workspacePath, 'Prompts', folderName, 'PromptFolder.json')
  const parsed = readPromptFolderConfig(configPath)

  return {
    promptFolderId: parsed.promptFolderId,
    folderName,
    displayName: parsed.foldername,
    promptCount: parsed.promptCount,
    folderDescription: parsed.folderDescription
  }
}

const readPromptFolderPrompts = (workspacePath: string, folderName: string): Prompt[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts', folderName, 'Prompts.json')
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as {
    prompts?: Prompt[]
  }
  return parsed.prompts ?? []
}

export const setupUpdatedPromptFolderHandlers = (): void => {
  ipcMain.handle(
    'updated-load-prompt-folder-by-id',
    async (
      _,
      request: UpdatedLoadPromptFolderByIdRequest
    ): Promise<UpdatedLoadPromptFolderByIdResult> => {
      const location = getPromptFolderLocation(request.promptFolderId)

      if (!location) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const data = readPromptFolderData(location.workspacePath, location.folderName)

        return {
          success: true,
          data,
          revision: revisions.promptFolder.get(request.promptFolderId)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'updated-load-prompt-folder-initial',
    async (
      _,
      request: UpdatedLoadPromptFolderInitialRequest
    ): Promise<UpdatedLoadPromptFolderInitialResult> => {
      const location = getPromptFolderLocation(request.promptFolderId)

      if (!location) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const data = readPromptFolderData(location.workspacePath, location.folderName)
        const prompts = readPromptFolderPrompts(location.workspacePath, location.folderName)

        return {
          success: true,
          promptFolder: {
            data,
            revision: revisions.promptFolder.get(request.promptFolderId)
          },
          prompts: prompts.map((prompt) => ({
            data: prompt,
            revision: revisions.prompt.get(prompt.id)
          }))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'updated-create-prompt-folder',
    async (
      _,
      request: UpdatedCreatePromptFolderRequest
    ): Promise<UpdatedCreatePromptFolderResult> => {
      const workspacePath = getWorkspacePath(request.workspaceId)

      if (!workspacePath) {
        return { success: false, error: 'Workspace not registered' }
      }

      const currentWorkspaceRevision = revisions.workspace.get(request.workspaceId)

      if (request.workspaceRevision !== currentWorkspaceRevision) {
        return {
          success: false,
          conflict: true,
          data: {
            workspaceRevision: currentWorkspaceRevision,
            promptFolderRevision: revisions.promptFolder.get(request.promptFolder.promptFolderId)
          }
        }
      }

      try {
        const fs = getFs()
        const folderPath = path.join(
          workspacePath,
          'Prompts',
          request.promptFolder.folderName
        )

        if (fs.existsSync(folderPath)) {
          return { success: false, error: 'A folder with this name already exists' }
        }

        fs.mkdirSync(folderPath, { recursive: true })

        const configPath = path.join(folderPath, 'PromptFolder.json')
        const configContent = JSON.stringify(
          createPromptFolderConfig(
            request.promptFolder.displayName,
            request.promptFolder.promptCount,
            request.promptFolder.promptFolderId,
            request.promptFolder.folderDescription
          ),
          null,
          2
        )
        fs.writeFileSync(configPath, configContent, 'utf8')

        PromptAPI.createInitialPromptsFile(folderPath)
        registerPromptFolder(
          request.promptFolder.promptFolderId,
          workspacePath,
          request.promptFolder.folderName
        )

        const nextPromptFolderRevision = revisions.promptFolder.bump(
          request.promptFolder.promptFolderId
        )
        const nextWorkspaceRevision = revisions.workspace.bump(request.workspaceId)

        return {
          success: true,
          data: {
            workspaceRevision: nextWorkspaceRevision,
            promptFolderRevision: nextPromptFolderRevision
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )
}
