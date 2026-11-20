import { ipcMain, shell } from 'electron'
import { getDialogProvider } from './dialog-provider'
import { listWorkspaces } from './Persistence/sqlite/WorkspaceDatabase'
import { importWorkspace } from './Workspace/importWorkspace'
import { data } from './Data/Data'

/** Registers managed workspace discovery, single-file legacy import, and Explorer selection. */
export const setupWorkspaceDialogHandlers = (): void => {
  ipcMain.handle('select-workspace-folder', () => getDialogProvider().selectFolder())
  ipcMain.handle('list-workspaces', listWorkspaces)
  ipcMain.handle('import-workspace', async () => {
    /** The native picker returns one legacy metadata file. */
    const selection = await getDialogProvider().selectWorkspaceInfoFile()
    if (!selection.dialogCancelled && selection.filePaths.length) importWorkspace(selection.filePaths[0])
  })
  ipcMain.handle('open-workspace-folder', () => {
    /** Explorer reveals the active managed file. */
    const workspace = data.workspace.committedStore.getAllEntries()[0]?.committed
    if (workspace) shell.showItemInFolder(workspace.workspacePath)
  })
}
