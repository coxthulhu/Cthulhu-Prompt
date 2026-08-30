import { ipcMain } from 'electron'
import { getCategoryOrderCategoryIds } from '@shared/PromptFolder'
import { removeEntry } from '@shared/OrderContainer'
import {
  parseCreatePromptFolderDomainCommand,
  parseRenamePromptFolderDomainCommand,
  planCreatePromptFolderDomainMutation,
  planRenamePromptFolderDomainMutation
} from '@shared/PromptFolderDomainMutations'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildWorkspaceSnapshot } from '../Data/DataSnapshotHelpers'
import { parseDeletePromptFolderRequest } from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'
import { MarkdownContentUiStateDataAccess } from '../DataAccess/MarkdownContentUiStateDataAccess'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import {
  collectPromptFolderContentIds,
  createPromptFolderContentDeleteHandles
} from './PromptFolderContentMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers root prompt-folder creation, deletion, and rename mutations. */
export const setupPromptFolderMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: 'rename-prompt-folder' },
    mutation: {
      parseCommand: parseRenamePromptFolderDomainCommand,
      plan: planRenamePromptFolderDomainMutation
    }
  })

  handleMainDomainMutation({
    ipc: { channel: 'create-prompt-folder' },
    mutation: {
      parseCommand: parseCreatePromptFolderDomainCommand,
      plan: planCreatePromptFolderDomainMutation
    }
  })

  ipcMain.handle('delete-prompt-folder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseDeletePromptFolderRequest,
      async (validatedRequest) => {
        try {
          /** Validated root-folder deletion command. */
          const payload = validatedRequest.payload
          /** Workspace that directly owns the root folder. */
          const workspace = data.workspace.committedStore.getEntry(payload.workspace.id)
          /** Root folder selected for deletion. */
          const promptFolder = data.promptFolder.committedStore.getEntry(payload.promptFolder.id)
          if (!workspace || !promptFolder) {
            return { success: false, error: 'Prompt folder not loaded' }
          }
          if (!workspace.committed.entries.some((entry) => entry.id === promptFolder.committed.id)) {
            return { success: false, error: 'Prompt folder does not belong to the workspace' }
          }

          /** Content IDs owned by the deleted root. */
          const contentIds = collectPromptFolderContentIds([promptFolder.committed.id])
          /** Category IDs owned by the deleted root. */
          const categoryIds = getCategoryOrderCategoryIds(promptFolder.committed.categoryOrder)
          /** Atomic graph deletion result. */
          const outcome = await runAtomicDataTransaction((tx) => ({
            workspace: tx.workspace.update({
              id: workspace.committed.id,
              expectedRevision: payload.workspace.expectedRevision,
              recipe: (draft) => {
                draft.entries = removeEntry(draft.entries, 'folder', promptFolder.committed.id)
              }
            }),
            ...createPromptFolderContentDeleteHandles(tx, contentIds),
            ...Object.fromEntries(
              categoryIds.map((categoryId) => [
                `category:${categoryId}`,
                tx.category.delete({ id: categoryId })
              ])
            ),
            promptFolder: tx.promptFolder.delete({
              id: promptFolder.committed.id,
              expectedRevision: payload.promptFolder.expectedRevision
            })
          }))

          if (outcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.workspace.committedStore.getEntry(payload.workspace.id),
              'Workspace not loaded',
              (latestWorkspace) => ({ workspace: buildWorkspaceSnapshot(latestWorkspace) })
            )
          }
          for (const contentId of [...contentIds.prompt, ...contentIds.template]) {
            // Side effect: remove Monaco state owned by deleted content.
            MarkdownContentUiStateDataAccess.deleteMarkdownContentUiState(
              payload.workspace.id,
              contentId
            )
          }
          /** Authoritative workspace after deletion. */
          const updatedWorkspace = data.workspace.committedStore.getEntry(payload.workspace.id)
          if (!updatedWorkspace) {
            return { success: false, error: 'Prompt folder delete commit did not complete' }
          }
          /** Root folders remaining after the delete commit. */
          const remainingPromptFolderIds = updatedWorkspace.committed.entries.map(
            (entry) => entry.id
          )
          /** Categories remaining across those root folders. */
          const remainingCategoryIds = remainingPromptFolderIds.flatMap((promptFolderId) => {
            const remainingPromptFolder =
              data.promptFolder.committedStore.getEntry(promptFolderId)?.committed
            return remainingPromptFolder
              ? getCategoryOrderCategoryIds(remainingPromptFolder.categoryOrder)
              : []
          })
          // Side effect: prune UI state for the deleted root folder and its categories.
          UserPersistenceDataAccess.cleanupWorkspacePromptFolderViewState(
            payload.workspace.id,
            remainingPromptFolderIds,
            remainingCategoryIds
          )
          return { success: true, payload: { workspace: buildWorkspaceSnapshot(updatedWorkspace) } }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
      }
    )
  })
}
