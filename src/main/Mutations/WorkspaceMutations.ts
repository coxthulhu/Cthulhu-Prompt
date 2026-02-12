import { ipcMain } from 'electron'
import type {
  CloseWorkspaceResult,
  CreateWorkspaceResponse
} from '@shared/Workspace'
import {
  parseCloseWorkspaceRequest,
  parseCreateWorkspaceRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { createWorkspace } from '../DataAccess/WorkspaceDataAccess'

export const setupWorkspaceMutationHandlers = (): void => {
  ipcMain.handle(
    'create-workspace',
    async (
      _,
      request: unknown
    ): Promise<CreateWorkspaceResponse> => {
      // Special-case payload: this create request uses command-style workspace fields,
      // not the normal  revision mutation entity shape.
      return await runMutationIpcRequest(request, parseCreateWorkspaceRequest, async (validatedRequest) => {
        const payload = validatedRequest.payload
        return await createWorkspace(payload.workspacePath, payload.includeExamplePrompts)
      })
    }
  )

  ipcMain.handle(
    'close-workspace',
    async (_, request: unknown): Promise<CloseWorkspaceResult> => {
      return await runMutationIpcRequest(request, parseCloseWorkspaceRequest, async () => {
        return { success: true }
      })
    }
  )
}
