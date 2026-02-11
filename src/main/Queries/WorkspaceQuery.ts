import { ipcMain } from 'electron'
import type {
  LoadWorkspaceByPathResult,
  LoadWorkspaceByPathWireRequest
} from '@shared/WorkspaceLoad'
import { parseLoadWorkspaceByPathRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'
import { loadWorkspaceByPath } from '../Registries/WorkspaceLoader'

export const setupWorkspaceQueryHandlers = (): void => {
  ipcMain.handle(
    'load-workspace-by-path',
    async (_, request: unknown): Promise<LoadWorkspaceByPathResult> => {
      return await runQueryIpcRequest<LoadWorkspaceByPathWireRequest, LoadWorkspaceByPathResult>(
        request,
        parseLoadWorkspaceByPathRequest,
        async (validatedRequest) => {
          return await loadWorkspaceByPath(validatedRequest.payload.workspacePath)
        }
      )
    }
  )
}
