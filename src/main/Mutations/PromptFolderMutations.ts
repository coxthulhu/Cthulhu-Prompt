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
import { createMarkdownContentUiStateKey } from '@shared/MarkdownContentUiState'
import {
  createCategoryDescriptionEditorUiStateKey,
  createWorkspacePromptFolderUiStateKey
} from '@shared/UiState'
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
          // Side effect: query workspace UI state before grouping its possible update with deletion.
          await data.workspaceUiState.loadDataFromPersistence(payload.workspace.id, {})
          /** Current workspace UI state when SQLite contains a row for this workspace. */
          const workspaceUiState = data.workspaceUiState.committedStore.getEntry(
            payload.workspace.id
          )
          /** Atomic graph deletion result. */
          const outcome = (await runAtomicDataTransaction((tx) => ({
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
            }),
            ...Object.fromEntries(
              [...contentIds.prompt, ...contentIds.template].map((contentId) => [
                `markdownContentUiState:${contentId}`,
                tx.markdownContentUiState.delete({
                  id: createMarkdownContentUiStateKey(payload.workspace.id, contentId)
                })
              ])
            ),
            ...Object.fromEntries(
              [promptFolder.committed.id, ...categoryIds].map((contentOwnerId) => [
                `workspacePromptFolderUiState:${contentOwnerId}`,
                tx.workspacePromptFolderUiState.delete({
                  id: createWorkspacePromptFolderUiStateKey(
                    payload.workspace.id,
                    contentOwnerId
                  )
                })
              ])
            ),
            ...Object.fromEntries(
              categoryIds.map((categoryId) => [
                `categoryDescriptionEditorUiState:${categoryId}`,
                tx.categoryDescriptionEditorUiState.delete({
                  id: createCategoryDescriptionEditorUiStateKey(
                    payload.workspace.id,
                    categoryId
                  )
                })
              ])
            ),
            ...(workspaceUiState
              ? {
                  workspaceUiState: tx.workspaceUiState.update({
                    id: payload.workspace.id,
                    recipe: (draft) => {
                      if (
                        draft.selectedScreen === 'prompt-folders' &&
                        draft.selectedScreenData.promptFolderId === promptFolder.committed.id
                      ) {
                        Object.assign(draft, {
                          selectedScreen: 'home',
                          selectedScreenData: null,
                          lastPromptFolderId: null
                        })
                      } else if (draft.lastPromptFolderId === promptFolder.committed.id) {
                        draft.lastPromptFolderId = null
                      }
                    }
                  })
                }
              : {})
          })))!

          if (outcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.workspace.committedStore.getEntry(payload.workspace.id),
              'Workspace not loaded',
              (latestWorkspace) => ({ workspace: buildWorkspaceSnapshot(latestWorkspace) })
            )
          }
          /** Authoritative workspace after deletion. */
          const updatedWorkspace = data.workspace.committedStore.getEntry(payload.workspace.id)
          if (!updatedWorkspace) {
            return { success: false, error: 'Prompt folder delete commit did not complete' }
          }
          return { success: true, payload: { workspace: buildWorkspaceSnapshot(updatedWorkspace) } }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
      }
    )
  })
}
