import { ipcMain } from 'electron'
import type {
  CloseWorkspacePayload,
  CloseWorkspaceResult,
  CreateWorkspaceResponse,
  CreateWorkspacePayload
} from '@shared/Workspace'
import type {
  IpcRequestWithPayload
} from '@shared/IpcRequest'
import {
  parseCloseWorkspaceRequest,
  parseCreateWorkspaceRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { createWorkspace } from '../DataAccess/WorkspaceDataAccess'

type CreateWorkspaceMutationResult =
  | { success: true }
  | { success: false; error: string }

type CloseWorkspaceMutationResult =
  | { success: true }
  | { success: false; error: string }

export const setupWorkspaceMutationHandlers = (): void => {
  ipcMain.handle(
    'create-workspace',
    async (
      _,
      request: unknown
    ): Promise<CreateWorkspaceResponse> => {
      // Special-case payload: this create request uses command-style workspace fields,
      // not the normal  revision mutation entity shape.
      return await runMutationIpcRequest<
        IpcRequestWithPayload<CreateWorkspacePayload>,
        CreateWorkspaceMutationResult
      >(
        request,
        parseCreateWorkspaceRequest,
        async (validatedRequest) => {
          const payload = validatedRequest.payload
          return await createWorkspace(payload.workspacePath, payload.includeExamplePrompts)
        }
      )
    }
  )

  ipcMain.handle(
    'close-workspace',
    async (_, request: unknown): Promise<CloseWorkspaceResult> => {
      return await runMutationIpcRequest<
        IpcRequestWithPayload<CloseWorkspacePayload>,
        CloseWorkspaceMutationResult
      >(request, parseCloseWorkspaceRequest, async () => {
        return { success: true }
      })
    }
  )
}
