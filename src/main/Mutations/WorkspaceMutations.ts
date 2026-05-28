import { ipcMain } from 'electron'
import type { IpcMutationActionResponse } from '@shared/IpcResult'
import {
  parseCloseWorkspaceRequest,
  parseCreateWorkspaceRequest,
  parseMovePromptFolderRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { createWorkspace } from '../DataAccess/WorkspaceDataAccess'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildWorkspaceSnapshot } from '../Data/DataSnapshotHelpers'
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'

const resolvePromptFolderInsertIndex = (
  promptFolderIds: string[],
  orderAfterPromptFolderId: string | null
): number | null => {
  if (orderAfterPromptFolderId === null) {
    return 0
  }

  const previousIndex = promptFolderIds.indexOf(orderAfterPromptFolderId)
  return previousIndex === -1 ? null : previousIndex + 1
}

export const setupWorkspaceMutationHandlers = (): void => {
  ipcMain.handle(
    'create-workspace',
    async (_, request: unknown): Promise<IpcMutationActionResponse> => {
      // Special-case payload: this create request uses command-style workspace fields,
      // not the normal  revision mutation entity shape.
      return await runMutationIpcRequest(
        request,
        parseCreateWorkspaceRequest,
        async (validatedRequest) => {
          const payload = validatedRequest.payload
          return await createWorkspace(
            payload.workspacePath,
            payload.workspaceName,
            payload.includeExamplePrompts
          )
        }
      )
    }
  )

  ipcMain.handle(
    'close-workspace',
    async (_, request: unknown): Promise<IpcMutationActionResponse> => {
      return await runMutationIpcRequest(request, parseCloseWorkspaceRequest, async () => {
        return { success: true }
      })
    }
  )

  ipcMain.handle('move-prompt-folder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseMovePromptFolderRequest,
      async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const requestedWorkspace = payload.workspace
          const committedWorkspace = data.workspace.committedStore.getEntry(requestedWorkspace.id)

          if (!committedWorkspace) {
            return { success: false, error: 'Workspace not loaded' }
          }

          if (!committedWorkspace.committed.promptFolderIds.includes(payload.promptFolderId)) {
            return { success: false, error: 'Prompt folder not found in workspace' }
          }

          const destinationPromptFolderIds = committedWorkspace.committed.promptFolderIds.filter(
            (promptFolderId) => promptFolderId !== payload.promptFolderId
          )
          const insertIndex = resolvePromptFolderInsertIndex(
            destinationPromptFolderIds,
            payload.orderAfterPromptFolderId
          )

          if (insertIndex === null) {
            return { success: false, error: 'Order-after prompt folder not found' }
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              workspace: tx.workspace.update({
                id: requestedWorkspace.id,
                expectedRevision: requestedWorkspace.expectedRevision,
                recipe: (draft) => {
                  const nextPromptFolderIds = [...destinationPromptFolderIds]
                  nextPromptFolderIds.splice(insertIndex, 0, payload.promptFolderId)
                  draft.promptFolderIds = nextPromptFolderIds
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.workspace.committedStore.getEntry(requestedWorkspace.id),
              'Workspace not loaded',
              (latestWorkspace) => ({
                workspace: buildWorkspaceSnapshot(latestWorkspace)
              })
            )
          }

          const updatedWorkspace = data.workspace.committedStore.getEntry(requestedWorkspace.id)

          if (!updatedWorkspace) {
            return { success: false, error: 'Prompt folder move commit did not complete' }
          }

          return {
            success: true,
            payload: {
              workspace: buildWorkspaceSnapshot(updatedWorkspace)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message }
        }
      }
    )
  })
}
