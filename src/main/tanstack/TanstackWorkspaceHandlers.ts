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
import type {
  TanstackCreateWorkspaceResponse,
  TanstackCreateWorkspaceWireRequest
} from '@shared/tanstack/TanstackWorkspaceCreate'
import { runTanstackIpcRequest } from './TanstackIpcRequest'
import { createTanstackWorkspace } from './TanstackWorkspaceCreate'

export const setupTanstackWorkspaceHandlers = (): void => {
  ipcMain.handle(
    'tanstack-create-workspace',
    async (
      _,
      request: TanstackCreateWorkspaceWireRequest | undefined
    ): Promise<TanstackCreateWorkspaceResponse> => {
      if (!request?.requestId || !request.payload?.workspacePath) {
        return { requestId: request?.requestId ?? '', success: false, error: 'Invalid request payload' }
      }

      if (typeof request.payload.includeExamplePrompts !== 'boolean') {
        return { requestId: request.requestId, success: false, error: 'Invalid request payload' }
      }

      return runTanstackIpcRequest(request, async (payload) => {
        return await createTanstackWorkspace(payload.workspacePath, payload.includeExamplePrompts)
      })
    }
  )

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
