import { ipcMain } from 'electron'
import type {
  TanstackLoadWorkspaceByPathResult,
  TanstackLoadWorkspaceByPathWireRequest
} from '@shared/tanstack/TanstackWorkspaceLoad'
import { loadTanstackWorkspaceByPath } from './TanstackWorkspaceLoader'

export const setupTanstackWorkspaceHandlers = (): void => {
  ipcMain.handle(
    'tanstack-load-workspace-by-path',
    async (_, request: TanstackLoadWorkspaceByPathWireRequest): Promise<TanstackLoadWorkspaceByPathResult> => {
      if (!request?.payload?.workspacePath) {
        return { success: false, error: 'Invalid request payload' }
      }

      return await loadTanstackWorkspaceByPath(request.payload.workspacePath)
    }
  )
}
