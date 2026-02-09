import { ipcMain } from 'electron'
import type {
  TanstackLoadWorkspaceByPathResult,
  TanstackLoadWorkspaceByPathWireRequest
} from '@shared/tanstack/TanstackWorkspaceLoad'
import { parseTanstackLoadWorkspaceByPathRequest } from '../IpcFramework/TanstackIpcValidation'
import { runTanstackQueryIpcRequest } from '../IpcFramework/TanstackIpcRequest'
import { loadTanstackWorkspaceByPath } from '../Registries/TanstackWorkspaceLoader'

export const setupTanstackWorkspaceQueryHandlers = (): void => {
  ipcMain.handle(
    'tanstack-load-workspace-by-path',
    async (_, request: unknown): Promise<TanstackLoadWorkspaceByPathResult> => {
      return await runTanstackQueryIpcRequest<TanstackLoadWorkspaceByPathWireRequest, TanstackLoadWorkspaceByPathResult>(
        request,
        parseTanstackLoadWorkspaceByPathRequest,
        async (validatedRequest) => {
          return await loadTanstackWorkspaceByPath(validatedRequest.payload.workspacePath)
        }
      )
    }
  )
}
