import { ipcMain } from 'electron'
import type {
  TanstackLoadWorkspaceByPathResult,
  TanstackLoadWorkspaceByPathWireRequest
} from '@shared/tanstack/TanstackWorkspaceLoad'
import type {
  TanstackCloseWorkspaceResult,
  TanstackCloseWorkspaceWireRequest
} from '@shared/tanstack/TanstackWorkspaceClose'
import { loadTanstackWorkspaceByPath } from './TanstackWorkspaceLoader'
import { setSelectedTanstackWorkspaceId } from './TanstackWorkspaceRegistry'

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

  ipcMain.handle(
    'tanstack-close-workspace',
    async (_, request: TanstackCloseWorkspaceWireRequest | undefined): Promise<TanstackCloseWorkspaceResult> => {
      if (!request?.requestId) {
        return { success: false, error: 'Invalid request payload' }
      }

      setSelectedTanstackWorkspaceId(null)
      return { success: true }
    }
  )
}
