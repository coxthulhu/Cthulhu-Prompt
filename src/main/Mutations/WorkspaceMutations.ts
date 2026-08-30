import { ipcMain } from 'electron'
import type { IpcMutationActionResponse } from '@shared/IpcResult'
import {
  parseMovePromptFolderDomainCommand,
  planMovePromptFolderDomainMutation
} from '@shared/PromptFolderDomainMutations'
import { createWorkspace } from '../DataAccess/WorkspaceDataAccess'
import {
  parseCloseWorkspaceRequest,
  parseCreateWorkspaceRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers workspace lifecycle and root-folder ordering mutations. */
export const setupWorkspaceMutationHandlers = (): void => {
  ipcMain.handle(
    'create-workspace',
    async (_, request: unknown): Promise<IpcMutationActionResponse> =>
      await runMutationIpcRequest(request, parseCreateWorkspaceRequest, async (validated) => {
        /** Validated command-style workspace creation payload. */
        const payload = validated.payload
        return await createWorkspace(
          payload.workspacePath,
          payload.workspaceName,
          payload.includeExamplePrompts
        )
      })
  )

  ipcMain.handle(
    'close-workspace',
    async (_, request: unknown): Promise<IpcMutationActionResponse> =>
      await runMutationIpcRequest(request, parseCloseWorkspaceRequest, async () => ({
        success: true
      }))
  )

  handleMainDomainMutation({
    ipc: { channel: 'move-prompt-folder' },
    mutation: {
      parseCommand: parseMovePromptFolderDomainCommand,
      plan: planMovePromptFolderDomainMutation
    }
  })
}
