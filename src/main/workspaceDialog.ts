import { ipcMain } from 'electron'
import * as path from 'path'
import type { WorkspaceFolderStatus } from '@shared/Workspace'
import { PROMPTS_DIRECTORY_NAME } from './Persistence/PromptPersistencePaths'
import { getDialogProvider } from './dialog-provider'
import { getFs } from './fs-provider'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'

const getWorkspaceFolderStatus = (folderPath: string): WorkspaceFolderStatus => {
  const fs = getFs()

  if (!fs.existsSync(folderPath)) {
    return { exists: false, isWorkspace: false, isEmpty: true }
  }

  const isWorkspace =
    fs.existsSync(path.join(folderPath, WORKSPACE_INFO_FILENAME)) &&
    fs.existsSync(path.join(folderPath, PROMPTS_DIRECTORY_NAME))

  return {
    exists: true,
    isWorkspace,
    isEmpty: fs.readdirSync(folderPath).length === 0
  }
}

export const setupWorkspaceDialogHandlers = (): void => {
  ipcMain.handle('select-workspace-folder', async () => {
    const dialogProvider = getDialogProvider()
    return await dialogProvider.selectFolder()
  })

  ipcMain.handle('get-workspace-folder-status', async (_, folderPath: string) => {
    return getWorkspaceFolderStatus(folderPath)
  })
}
