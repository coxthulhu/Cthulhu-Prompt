import { ipcMain, shell } from 'electron'
import * as path from 'path'
import type { WorkspaceFolderStatus } from '@shared/Workspace'
import {
  PROMPTS_DIRECTORY_NAME,
  WORKSPACE_INFO_FILENAME_SUFFIX
} from './Persistence/PromptPersistencePaths'
import { getDialogProvider } from './dialog-provider'
import { getFs } from './fs-provider'

const hasWorkspaceInfoFile = (folderPath: string): boolean => {
  const fs = getFs()
  return fs
    .readdirSync(folderPath)
    .some((entryName) => entryName.toLowerCase().endsWith(WORKSPACE_INFO_FILENAME_SUFFIX))
}

const getWorkspaceFolderStatus = (folderPath: string): WorkspaceFolderStatus => {
  const fs = getFs()

  if (!fs.existsSync(folderPath)) {
    return { exists: false, isWorkspace: false, isEmpty: true }
  }

  const isWorkspace =
    hasWorkspaceInfoFile(folderPath) && fs.existsSync(path.join(folderPath, PROMPTS_DIRECTORY_NAME))

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

  ipcMain.handle('select-workspace-info-file', async () => {
    const dialogProvider = getDialogProvider()
    return await dialogProvider.selectWorkspaceInfoFile()
  })

  ipcMain.handle('get-workspace-folder-status', async (_, folderPath: string) => {
    return getWorkspaceFolderStatus(folderPath)
  })

  ipcMain.handle('open-workspace-folder', async (_, workspacePath: string) => {
    const openError = await shell.openPath(workspacePath)
    if (openError) {
      throw new Error(openError)
    }
  })
}
