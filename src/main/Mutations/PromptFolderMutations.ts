import { ipcMain } from 'electron'
import {
  copyPromptFolderSettings,
  createEmptyPromptFolderSettings,
  createRootCategoryOrder,
  getCategoryOrderCategoryIds,
  type PromptFolder,
  type PromptFolderKind
} from '@shared/PromptFolder'
import { folderEntryRef, removeEntry, resolveEntryInsertIndex } from '@shared/OrderContainer'
import {
  hasPromptFolderNameConflict,
  preparePromptFolderName,
  PROMPT_FOLDER_NAME_CONFLICT_ERROR,
  type PromptFolderNameCandidate
} from '@shared/promptFolderName'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildPromptFolderSnapshot, buildWorkspaceSnapshot } from '../Data/DataSnapshotHelpers'
import {
  parseCreatePromptFolderRequest,
  parseDeletePromptFolderRequest,
  parseRenamePromptFolderRequest,
  parseUpdatePromptFolderSettingsRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'
import { MarkdownContentUiStateDataAccess } from '../DataAccess/MarkdownContentUiStateDataAccess'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import {
  collectPromptFolderContentIds,
  createPromptFolderContentDeleteHandles
} from './PromptFolderContentMutations'

/** Returns root-folder name candidates of one content kind from workspace ordering. */
const getPromptFolderNameCandidates = (
  workspaceEntries: readonly { id: string }[],
  kind: PromptFolderKind
): PromptFolderNameCandidate[] =>
  workspaceEntries.flatMap((entry) => {
    /** Loaded root folder referenced by the workspace entry. */
    const promptFolder = data.promptFolder.committedStore.getEntry(entry.id)?.committed
    return promptFolder && promptFolder.kind === kind ? [promptFolder] : []
  })

/** Registers root prompt-folder creation, deletion, rename, and settings mutations. */
export const setupPromptFolderMutationHandlers = (): void => {
  ipcMain.handle('create-prompt-folder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseCreatePromptFolderRequest,
      async (validatedRequest) => {
        try {
          /** Validated root-folder creation command. */
          const payload = validatedRequest.payload
          /** Workspace that will own the new root folder. */
          const workspace = data.workspace.committedStore.getEntry(payload.workspace.id)
          if (!workspace) return { success: false, error: 'Workspace not loaded' }
          if (
            payload.previousEntryId !== null &&
            !workspace.committed.entries.some((entry) => entry.id === payload.previousEntryId)
          ) {
            return { success: false, error: 'Previous entry not found' }
          }

          /** Validated display and disk names for the new root folder. */
          const preparedName = preparePromptFolderName(payload.displayName)
          if (!preparedName.validation.isValid) {
            return {
              success: false,
              error: preparedName.validation.errorMessage ?? 'Invalid prompt folder name'
            }
          }
          if (
            hasPromptFolderNameConflict(
              getPromptFolderNameCandidates(workspace.committed.entries, payload.kind),
              preparedName.folderName
            )
          ) {
            return { success: false, error: PROMPT_FOLDER_NAME_CONFLICT_ERROR }
          }

          /** Workspace insertion index for the new root folder. */
          const insertIndex = resolveEntryInsertIndex(
            workspace.committed.entries,
            payload.previousEntryId
          )!
          /** Initial persisted root-folder record. */
          const promptFolder: PromptFolder = {
            id: payload.promptFolderId,
            kind: payload.kind,
            folderName: preparedName.folderName,
            displayName: preparedName.displayName,
            completedPromptIds: [],
            categoryOrder: createRootCategoryOrder(),
            settings: createEmptyPromptFolderSettings()
          } as PromptFolder
          /** Atomic workspace-order and folder-create result. */
          const outcome = await runAtomicDataTransaction((tx) => ({
            workspace: tx.workspace.update({
              id: payload.workspace.id,
              expectedRevision: payload.workspace.expectedRevision,
              recipe: (draft) => {
                /** Updated root-folder order. */
                const entries = [...draft.entries]
                entries.splice(insertIndex, 0, folderEntryRef(payload.promptFolderId))
                draft.entries = entries
              }
            }),
            promptFolder: tx.promptFolder.create({
              id: payload.promptFolderId,
              data: promptFolder,
              persistenceFields: {
                workspaceId: payload.workspace.id,
                workspacePath: workspace.committed.workspacePath,
                folderName: preparedName.folderName,
                folderPath: preparedName.folderName,
                kind: payload.kind
              }
            })
          }))

          if (outcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.workspace.committedStore.getEntry(payload.workspace.id),
              'Workspace not loaded',
              (latestWorkspace) => ({ workspace: buildWorkspaceSnapshot(latestWorkspace) })
            )
          }
          /** Authoritative workspace after creation. */
          const updatedWorkspace = data.workspace.committedStore.getEntry(payload.workspace.id)
          /** Authoritative new prompt folder. */
          const createdFolder = data.promptFolder.committedStore.getEntry(payload.promptFolderId)
          if (!updatedWorkspace || !createdFolder) {
            return { success: false, error: 'Prompt folder create commit did not complete' }
          }
          return {
            success: true,
            payload: {
              workspace: buildWorkspaceSnapshot(updatedWorkspace),
              promptFolder: buildPromptFolderSnapshot(createdFolder)
            }
          }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
      }
    )
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

  ipcMain.handle('rename-prompt-folder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseRenamePromptFolderRequest,
      async (validatedRequest) => {
        try {
          /** Validated root-folder rename command. */
          const payload = validatedRequest.payload
          /** Root folder being renamed. */
          const promptFolder = data.promptFolder.committedStore.getEntry(payload.promptFolder.id)
          if (!promptFolder) return { success: false, error: 'Prompt folder not loaded' }
          /** Workspace that owns the root folder. */
          const workspace = data.workspace.committedStore.getEntry(
            promptFolder.persistenceFields.workspaceId
          )
          if (!workspace) return { success: false, error: 'Workspace not loaded' }
          /** Validated display and disk names. */
          const preparedName = preparePromptFolderName(payload.displayName)
          if (!preparedName.validation.isValid) {
            return {
              success: false,
              error: preparedName.validation.errorMessage ?? 'Invalid prompt folder name'
            }
          }
          if (
            hasPromptFolderNameConflict(
              getPromptFolderNameCandidates(workspace.committed.entries, promptFolder.committed.kind),
              preparedName.folderName,
              promptFolder.committed.id
            )
          ) {
            return { success: false, error: PROMPT_FOLDER_NAME_CONFLICT_ERROR }
          }
          /** Atomic root-folder rename result. */
          const outcome = await runAtomicDataTransaction((tx) => ({
            promptFolder: tx.promptFolder.update({
              id: promptFolder.committed.id,
              expectedRevision: payload.promptFolder.expectedRevision,
              recipe: (draft) => {
                draft.displayName = preparedName.displayName
                draft.folderName = preparedName.folderName
              },
              persistenceFields: {
                ...promptFolder.persistenceFields,
                folderName: preparedName.folderName,
                folderPath: preparedName.folderName
              }
            })
          }))
          if (outcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.promptFolder.committedStore.getEntry(promptFolder.committed.id),
              'Prompt folder not loaded',
              (latestFolder) => ({ promptFolder: buildPromptFolderSnapshot(latestFolder) })
            )
          }
          /** Authoritative renamed root folder. */
          const updatedFolder = data.promptFolder.committedStore.getEntry(promptFolder.committed.id)
          return updatedFolder
            ? { success: true, payload: { promptFolder: buildPromptFolderSnapshot(updatedFolder) } }
            : { success: false, error: 'Prompt folder rename commit did not complete' }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
      }
    )
  })

  ipcMain.handle('update-prompt-folder-settings', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseUpdatePromptFolderSettingsRequest,
      async (validatedRequest) => {
        try {
          /** Revision-bearing root-folder settings update. */
          const requestedFolder = validatedRequest.payload.promptFolder
          /** Loaded root folder selected for settings persistence. */
          const promptFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
          if (!promptFolder) return { success: false, error: 'Prompt folder not loaded' }
          /** Atomic folder-settings update result. */
          const outcome = await runAtomicDataTransaction((tx) => ({
            promptFolder: tx.promptFolder.update({
              id: requestedFolder.id,
              expectedRevision: requestedFolder.expectedRevision,
              recipe: (draft) => {
                draft.settings = copyPromptFolderSettings(requestedFolder.data)
              }
            })
          }))
          if (outcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.promptFolder.committedStore.getEntry(requestedFolder.id),
              'Prompt folder not loaded',
              (latestFolder) => ({ promptFolder: buildPromptFolderSnapshot(latestFolder) })
            )
          }
          /** Authoritative folder after settings persistence. */
          const updatedFolder = data.promptFolder.committedStore.getEntry(requestedFolder.id)
          return updatedFolder
            ? { success: true, payload: { promptFolder: buildPromptFolderSnapshot(updatedFolder) } }
            : { success: false, error: 'Prompt folder update commit did not complete' }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) }
        }
      }
    )
  })
}
