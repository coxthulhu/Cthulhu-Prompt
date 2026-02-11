import { ipcMain } from 'electron'
import { getDialogProvider } from './dialog-provider'
import { getFs } from './fs-provider'

export const checkFolderExists = (folderPath: string): boolean => {
  try {
    const fs = getFs()
    return fs.existsSync(folderPath)
  } catch {
    return false
  }
}

export const setupWorkspaceDialogHandlers = (): void => {
  ipcMain.handle('select-workspace-folder', async () => {
    const dialogProvider = getDialogProvider()
    return await dialogProvider.selectFolder()
  })

  ipcMain.handle('check-folder-exists', async (_, folderPath: string) => {
    return checkFolderExists(folderPath)
  })
}
