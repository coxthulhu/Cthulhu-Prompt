import { ipcMain } from 'electron'
import type {
  TanstackLoadWorkspaceByPathResult,
  TanstackLoadWorkspaceByPathWireRequest
} from '@shared/tanstack/TanstackWorkspaceLoad'
import type {
  TanstackCloseWorkspaceResult,
  TanstackCloseWorkspaceWireRequest
} from '@shared/tanstack/TanstackWorkspaceClose'
import { loadTanstackWorkspaceByPath } from '../Registries/TanstackWorkspaceLoader'
import { setSelectedTanstackWorkspaceId } from '../Registries/TanstackWorkspaceRegistry'
import type {
  TanstackCreateWorkspaceResponse,
  TanstackCreateWorkspaceWireRequest
} from '@shared/tanstack/TanstackWorkspaceCreate'
import { runTanstackIpcRequest } from '../IpcFramework/TanstackIpcRequest'
import { createTanstackWorkspace } from '../DataAccess/TanstackWorkspaceDataAccess'

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

      // Special-case payload: this create request uses command-style workspace fields,
      // not the normal TanStack revision mutation entity shape.
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
