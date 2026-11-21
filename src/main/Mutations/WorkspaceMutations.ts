import { detachWorkspace, renameWorkspace } from '../Persistence/sqlite/WorkspaceDatabase'
import { ipcMain } from 'electron'
import { data } from '../Data/Data'
import type { IpcMutationActionResponse } from '@shared/ipc/IpcResult'
import {
  parseMovePromptCollectionDomainCommand,
  planMovePromptCollectionDomainMutation
} from '@shared/domain/prompt-collection/PromptCollectionDomainMutations'
import { createWorkspace } from '../Workspace/createWorkspace'
import {
  parseCloseWorkspaceRequest,
  parseCreateWorkspaceRequest,
  parseRenameWorkspaceRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers workspace lifecycle and collection ordering mutations. */
export const setupWorkspaceMutationHandlers = (): void => {
  ipcMain.handle(
    'create-workspace',
    async (_, request: unknown): Promise<IpcMutationActionResponse> =>
      await runMutationIpcRequest(request, parseCreateWorkspaceRequest, async (validated) => {
        /** Validated command-style workspace creation payload. */
        const payload = validated.payload
        try { return createWorkspace(payload.workspaceName, payload.includeExamplePrompts) }
        catch (error) { return { success: false as const, error: error instanceof Error ? error.message : String(error) } }
      })
  )

  ipcMain.handle(
    'rename-workspace',
    (_, request: unknown) => runMutationIpcRequest(request, parseRenameWorkspaceRequest, async ({ payload }) => {
      try { return { success: true as const, path: renameWorkspace(payload.workspaceId, payload.workspaceName) } }
      catch (error) { return { success: false as const, error: error instanceof Error ? error.message : String(error) } }
    })
  )

  ipcMain.handle(
    'close-workspace',
    async (_, request: unknown): Promise<IpcMutationActionResponse> =>
      await runMutationIpcRequest(request, parseCloseWorkspaceRequest, async () => {
        // Release registered workspace stores after flushing, preserving application-wide state.
        for (const [name, store] of Object.entries(data)) {
          if (name === 'systemSettings' || name === 'userPersistence') continue
          store.committedStore.clear()
        }
        detachWorkspace()
        return { success: true }
      })
  )

  handleMainDomainMutation({
    ipc: { channel: 'move-prompt-collection' },
    mutation: {
      parseCommand: parseMovePromptCollectionDomainCommand,
      plan: planMovePromptCollectionDomainMutation
    }
  })
}
