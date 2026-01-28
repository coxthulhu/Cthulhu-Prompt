import { ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  UpdatedLoadWorkspaceByIdRequest,
  UpdatedLoadWorkspaceByIdResult,
  UpdatedWorkspaceData
} from '@shared/ipc'
import { getWorkspacePath } from './registry'

const readPromptFolderIds = (workspacePath: string): string[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts')

  if (!fs.existsSync(promptsPath)) {
    return []
  }

  const entries = fs.readdirSync(promptsPath, { withFileTypes: true })
  const folderIds: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const folderName = entry.name
    const configPath = path.join(promptsPath, folderName, 'PromptFolder.json')
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { promptFolderId: string }
    folderIds.push(parsed.promptFolderId)
  }

  return folderIds
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
}
