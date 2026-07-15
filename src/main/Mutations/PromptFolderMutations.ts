import { ipcMain } from 'electron'
import * as path from 'path'
import { copyPromptFolderSettings, createEmptyPromptFolderSettings } from '@shared/PromptFolder'
import { folderEntryRef, type EntryRef } from '@shared/OrderContainer'
import { buildPromptFolderTreeIndex } from '@shared/PromptFolderTree'
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
  parseRenamePromptFolderRequest,
  parseUpdatePromptFolderSettingsRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'
import {
  refreshPromptFolderTreePersistencePaths,
  resolvePromptFolderPathFromData,
  collectWorkspacePromptFolders
} from './PromptFolderPathHelpers'

const getPromptFolderNameCandidates = (
  entries: readonly EntryRef[]
): PromptFolderNameCandidate[] =>
  entries.flatMap((entry) => {
    if (entry.kind !== 'folder') return []
    const promptFolder = data.promptFolder.committedStore.getEntry(entry.id)?.committed
    return promptFolder ? [promptFolder] : []
  })

const MAX_SUBFOLDER_DEPTH = 8

export const setupPromptFolderMutationHandlers = (): void => {
  ipcMain.handle('create-prompt-folder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseCreatePromptFolderRequest,
      async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const requestedWorkspace = payload.workspace
          const requestedParentPromptFolder = payload.parentPromptFolder
          const committedWorkspace = data.workspace.committedStore.getEntry(requestedWorkspace.id)

          if (!committedWorkspace) {
            return { success: false, error: 'Workspace not loaded' }
          }

          const committedParentPromptFolder = requestedParentPromptFolder
            ? data.promptFolder.committedStore.getEntry(requestedParentPromptFolder.id)
            : null

          if (requestedParentPromptFolder && !committedParentPromptFolder) {
            return { success: false, error: 'Parent prompt folder not loaded' }
          }

          const treeIndex = buildPromptFolderTreeIndex(
            committedWorkspace.committed,
            collectWorkspacePromptFolders(committedWorkspace.committed)
          )
          const parentDepth = committedParentPromptFolder
            ? (treeIndex.get(committedParentPromptFolder.committed.id)?.depth ?? 0)
            : -1

          if (parentDepth >= MAX_SUBFOLDER_DEPTH) {
            return {
              success: false,
              error: 'Prompt folders can contain up to 8 nested subfolder layers'
            }
          }

          const siblingEntries =
            committedParentPromptFolder?.committed.entries ?? committedWorkspace.committed.entries

          if (
            payload.previousEntryId !== null &&
            !siblingEntries.some((entry) => entry.id === payload.previousEntryId)
          ) {
            return { success: false, error: 'Previous entry not found' }
          }

          const {
            validation,
            displayName: normalizedDisplayName,
            folderName
          } = preparePromptFolderName(payload.displayName)

          if (!validation.isValid) {
            return {
              success: false,
              error: validation.errorMessage ?? 'Invalid prompt folder name'
            }
          }

          if (
            hasPromptFolderNameConflict(
              getPromptFolderNameCandidates(siblingEntries),
              folderName
            )
          ) {
            return { success: false, error: PROMPT_FOLDER_NAME_CONFLICT_ERROR }
          }

          const insertIndex =
            payload.previousEntryId === null
              ? 0
              : siblingEntries.findIndex((entry) => entry.id === payload.previousEntryId) + 1
          const folderPath = committedParentPromptFolder
            ? path.join(committedParentPromptFolder.persistenceFields.folderPath, folderName)
            : folderName

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              orderContainer: committedParentPromptFolder
                ? tx.promptFolder.update({
                    id: committedParentPromptFolder.committed.id,
                    expectedRevision: requestedParentPromptFolder?.expectedRevision,
                    recipe: (draft) => {
                      const entries = [...draft.entries]
                      entries.splice(insertIndex, 0, folderEntryRef(payload.promptFolderId))
                      draft.entries = entries
                    }
                  })
                : tx.workspace.update({
                    id: requestedWorkspace.id,
                    expectedRevision: requestedWorkspace.expectedRevision,
                    recipe: (draft) => {
                      const entries = [...draft.entries]
                      entries.splice(insertIndex, 0, folderEntryRef(payload.promptFolderId))
                      draft.entries = entries
                    }
                  }),
              promptFolder: tx.promptFolder.create({
                id: payload.promptFolderId,
                data: {
                  id: payload.promptFolderId,
                  folderName,
                  displayName: normalizedDisplayName,
                  entries: [],
                  completedPromptIds: [],
                  settings: createEmptyPromptFolderSettings()
                },
                persistenceFields: {
                  workspaceId: requestedWorkspace.id,
                  workspacePath: committedWorkspace.committed.workspacePath,
                  folderName,
                  folderPath
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            if (requestedParentPromptFolder) {
              return buildConflictResponseFromLatest(
                data.promptFolder.committedStore.getEntry(requestedParentPromptFolder.id),
                'Parent prompt folder not loaded',
                (latestParentPromptFolder) => ({
                  parentPromptFolder: buildPromptFolderSnapshot(latestParentPromptFolder)
                })
              )
            }

            return buildConflictResponseFromLatest(
              data.workspace.committedStore.getEntry(requestedWorkspace.id),
              'Workspace not loaded',
              (latestWorkspace) => ({
                workspace: buildWorkspaceSnapshot(latestWorkspace)
              })
            )
          }

          const updatedWorkspace = data.workspace.committedStore.getEntry(requestedWorkspace.id)
          const updatedParentPromptFolder = requestedParentPromptFolder
            ? data.promptFolder.committedStore.getEntry(requestedParentPromptFolder.id)
            : null
          const createdPromptFolder = data.promptFolder.committedStore.getEntry(
            payload.promptFolderId
          )

          if (
            !updatedWorkspace ||
            (requestedParentPromptFolder && !updatedParentPromptFolder) ||
            !createdPromptFolder
          ) {
            return { success: false, error: 'Prompt folder create commit did not complete' }
          }

          return {
            success: true,
            payload: {
              ...(requestedParentPromptFolder
                ? {
                    parentPromptFolder: buildPromptFolderSnapshot(updatedParentPromptFolder!)
                  }
                : {
                    workspace: buildWorkspaceSnapshot(updatedWorkspace)
                  }),
              promptFolder: buildPromptFolderSnapshot(createdPromptFolder)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message }
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
          const payload = validatedRequest.payload
          const requestedPromptFolder = payload.promptFolder
          const committedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )

          if (!committedPromptFolder) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          const committedWorkspace = data.workspace.committedStore.getEntry(
            committedPromptFolder.persistenceFields.workspaceId
          )

          if (!committedWorkspace) {
            return { success: false, error: 'Workspace not loaded' }
          }

          const {
            validation,
            displayName: normalizedDisplayName,
            folderName
          } = preparePromptFolderName(payload.displayName)

          if (!validation.isValid) {
            return {
              success: false,
              error: validation.errorMessage ?? 'Invalid prompt folder name'
            }
          }

          const treeIndex = buildPromptFolderTreeIndex(
            committedWorkspace.committed,
            collectWorkspacePromptFolders(committedWorkspace.committed)
          )
          const parentPromptFolderId =
            treeIndex.get(requestedPromptFolder.id)?.parentPromptFolderId ?? null
          const siblingEntries = parentPromptFolderId
            ? (data.promptFolder.committedStore.getEntry(parentPromptFolderId)?.committed.entries ??
              [])
            : committedWorkspace.committed.entries

          if (
            hasPromptFolderNameConflict(
              getPromptFolderNameCandidates(siblingEntries),
              folderName,
              requestedPromptFolder.id
            )
          ) {
            return { success: false, error: PROMPT_FOLDER_NAME_CONFLICT_ERROR }
          }

          const previousFolderPath = committedPromptFolder.persistenceFields.folderPath
          const folderPath = resolvePromptFolderPathFromData(
            requestedPromptFolder.id,
            new Map([
              [
                requestedPromptFolder.id,
                {
                  folderName
                }
              ]
            ])
          )
          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.displayName = normalizedDisplayName
                  draft.folderName = folderName
                },
                persistenceFields: {
                  ...committedPromptFolder.persistenceFields,
                  folderName,
                  folderPath,
                  previousFolderPath
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.promptFolder.committedStore.getEntry(requestedPromptFolder.id),
              'Prompt folder not loaded',
              (latestPromptFolder) => ({
                promptFolder: buildPromptFolderSnapshot(latestPromptFolder)
              })
            )
          }

          refreshPromptFolderTreePersistencePaths(requestedPromptFolder.id)

          const updatedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )

          if (!updatedPromptFolder) {
            return { success: false, error: 'Prompt folder rename commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(updatedPromptFolder)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message }
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
          const requestedPromptFolder = validatedRequest.payload.promptFolder
          const committedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )

          if (!committedPromptFolder) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.settings = copyPromptFolderSettings(requestedPromptFolder.data)
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.promptFolder.committedStore.getEntry(requestedPromptFolder.id),
              'Prompt folder not loaded',
              (latestPromptFolder) => ({
                promptFolder: buildPromptFolderSnapshot(latestPromptFolder)
              })
            )
          }

          const updatedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )

          if (!updatedPromptFolder) {
            return { success: false, error: 'Prompt folder update commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(updatedPromptFolder)
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
