import { ipcMain } from 'electron'
import type {
  TanstackCloseWorkspaceResult,
  TanstackCloseWorkspaceWireRequest
} from '@shared/tanstack/TanstackWorkspaceClose'
import type {
  TanstackCreateWorkspaceResponse,
  TanstackCreateWorkspaceWireRequest
} from '@shared/tanstack/TanstackWorkspaceCreate'
import {
  parseTanstackCloseWorkspaceRequest,
  parseTanstackCreateWorkspaceRequest
} from '../IpcFramework/TanstackIpcValidation'
import { runTanstackMutationIpcRequest } from '../IpcFramework/TanstackIpcRequest'
import { createTanstackWorkspace } from '../DataAccess/TanstackWorkspaceDataAccess'
import { setSelectedTanstackWorkspaceId } from '../Registries/TanstackWorkspaceRegistry'

type TanstackCreateWorkspaceMutationResult =
  | { success: true }
  | { success: false; error: string }

type TanstackCloseWorkspaceMutationResult =
  | { success: true }
  | { success: false; error: string }

export const setupTanstackWorkspaceMutationHandlers = (): void => {
  ipcMain.handle(
    'tanstack-create-workspace',
    async (
      _,
      request: unknown
    ): Promise<TanstackCreateWorkspaceResponse> => {
      // Special-case payload: this create request uses command-style workspace fields,
      // not the normal TanStack revision mutation entity shape.
      return await runTanstackMutationIpcRequest<
        TanstackCreateWorkspaceWireRequest,
        TanstackCreateWorkspaceMutationResult
      >(
        request,
        parseTanstackCreateWorkspaceRequest,
        async (validatedRequest) => {
          const payload = validatedRequest.payload
          return await createTanstackWorkspace(payload.workspacePath, payload.includeExamplePrompts)
        }
      )
    }
  )

  ipcMain.handle(
    'tanstack-close-workspace',
    async (_, request: unknown): Promise<TanstackCloseWorkspaceResult> => {
      return await runTanstackMutationIpcRequest<
        TanstackCloseWorkspaceWireRequest,
        TanstackCloseWorkspaceMutationResult
      >(request, parseTanstackCloseWorkspaceRequest, async () => {
        setSelectedTanstackWorkspaceId(null)
        return { success: true }
      })
    }
  )
}
