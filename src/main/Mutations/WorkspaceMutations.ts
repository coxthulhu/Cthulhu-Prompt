import { ipcMain } from 'electron'
import type { IpcMutationActionResponse } from '@shared/IpcResult'
import { folderEntryRef, removeEntry, resolveEntryInsertIndex } from '@shared/OrderContainer'
import { createWorkspace } from '../DataAccess/WorkspaceDataAccess'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildWorkspaceSnapshot } from '../Data/DataSnapshotHelpers'
import {
  parseCloseWorkspaceRequest,
  parseCreateWorkspaceRequest,
  parseMovePromptFolderRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'

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

  ipcMain.handle('move-prompt-folder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseMovePromptFolderRequest,
      async (validatedRequest) => {
        try {
          /** Validated root-folder reorder command. */
          const payload = validatedRequest.payload
          /** Workspace whose root-folder order changes. */
          const workspace = data.workspace.committedStore.getEntry(payload.workspace.id)
          /** Root folder being reordered. */
          const promptFolder = data.promptFolder.committedStore.getEntry(payload.promptFolderId)
          if (!workspace || !promptFolder) {
            return { success: false, error: 'Prompt folder not loaded' }
          }
          if (!workspace.committed.entries.some((entry) => entry.id === payload.promptFolderId)) {
            return { success: false, error: 'Prompt folder not in workspace' }
          }
          /** Root order after removing the dragged folder. */
          const entries = removeEntry(
            workspace.committed.entries,
            'folder',
            payload.promptFolderId
          )
          /** New insertion index after the requested root predecessor. */
          const insertIndex = resolveEntryInsertIndex(entries, payload.previousEntryId)
          if (insertIndex === null) return { success: false, error: 'Previous entry not found' }
          entries.splice(insertIndex, 0, folderEntryRef(payload.promptFolderId))
          /** Atomic root-folder reorder result. */
          const outcome = await runAtomicDataTransaction((tx) => ({
            workspace: tx.workspace.update({
              id: workspace.committed.id,
              expectedRevision: payload.workspace.expectedRevision,
              recipe: (draft) => {
                draft.entries = entries
              }
            })
          }))
          /** Latest authoritative workspace for success or conflict reconciliation. */
          const updatedWorkspace = data.workspace.committedStore.getEntry(workspace.committed.id)
          if (!updatedWorkspace) return { success: false, error: 'Workspace not loaded' }
          return outcome.status === 'conflict'
            ? {
                success: false,
                conflict: true,
                payload: {
                  workspace: buildWorkspaceSnapshot(updatedWorkspace),
                  promptFolders: [],
                  prompts: [],
                  promptTemplates: []
                }
              }
            : {
                success: true,
                payload: {
                  workspace: buildWorkspaceSnapshot(updatedWorkspace),
                  promptFolders: [],
                  prompts: [],
                  promptTemplates: []
                }
              }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
      }
    )
  })
}
