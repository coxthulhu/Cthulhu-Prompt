import { ipcMain } from 'electron'
import * as path from 'path'
import { copyPromptFolderSettings, createEmptyPromptFolderSettings } from '@shared/PromptFolder'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import {
  buildPromptFolderSnapshot,
  buildWorkspaceSnapshot,
  type WorkspaceCommittedEntry
} from '../Data/DataSnapshotHelpers'
import {
  parseCreatePromptFolderRequest,
  parseCreatePromptSubfolderRequest,
  parseUpdatePromptFolderSettingsRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'

const hasPromptFolderNameConflict = (
  workspaceEntry: WorkspaceCommittedEntry,
  folderName: string
): boolean => {
  const normalizedTargetName = folderName.toLowerCase()

  return workspaceEntry.committed.promptFolderIds.some((promptFolderId) => {
    const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderId)

    if (!promptFolderEntry) {
      return false
    }

    return promptFolderEntry.committed.folderName.toLowerCase() === normalizedTargetName
  })
}

const MAX_SUBFOLDER_DEPTH = 8

const hasPromptSubfolderNameConflict = (
  parentPromptFolderId: string,
  folderName: string
): boolean => {
  const parentPromptFolder = data.promptFolder.committedStore.getEntry(parentPromptFolderId)

  if (!parentPromptFolder) {
    return false
  }

  const normalizedTargetName = path
    .join(parentPromptFolder.committed.folderName, folderName)
    .toLowerCase()

  return parentPromptFolder.committed.entryIds.some((entryId) => {
    const promptFolderEntry = data.promptFolder.committedStore.getEntry(entryId)
    return promptFolderEntry?.committed.folderName.toLowerCase() === normalizedTargetName
  })
}

export const setupPromptFolderMutationHandlers = (): void => {
  ipcMain.handle('create-prompt-folder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseCreatePromptFolderRequest,
      async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const requestedWorkspace = payload.workspace
          const committedWorkspace = data.workspace.committedStore.getEntry(requestedWorkspace.id)

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

          if (hasPromptFolderNameConflict(committedWorkspace, folderName)) {
            return { success: false, error: 'A folder with this name already exists' }
          }

          const now = getCurrentIsoSecondTimestamp()
          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              workspace: tx.workspace.update({
                id: requestedWorkspace.id,
                expectedRevision: requestedWorkspace.expectedRevision,
                recipe: (draft) => {
                  draft.promptFolderIds = [payload.promptFolderId, ...draft.promptFolderIds]
                }
              }),
              promptFolder: tx.promptFolder.create({
                id: payload.promptFolderId,
                data: {
                  id: payload.promptFolderId,
                  folderName,
                  displayName: normalizedDisplayName,
                  parentPromptFolderId: null,
                  depth: 0,
                  modifiedAt: now,
                  promptCount: 0,
                  entryIds: [],
                  completedPromptIds: [],
                  settings: createEmptyPromptFolderSettings()
                },
                persistenceFields: {
                  workspaceId: requestedWorkspace.id,
                  workspacePath: committedWorkspace.committed.workspacePath,
                  folderName,
                  parentPromptFolderId: null,
                  depth: 0
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
          const createdPromptFolder = data.promptFolder.committedStore.getEntry(
            payload.promptFolderId
          )

          if (!updatedWorkspace || !createdPromptFolder) {
            return { success: false, error: 'Prompt folder create commit did not complete' }
          }

          return {
            success: true,
            payload: {
              workspace: buildWorkspaceSnapshot(updatedWorkspace),
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

  ipcMain.handle('create-prompt-subfolder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseCreatePromptSubfolderRequest,
      async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const requestedParentPromptFolder = payload.parentPromptFolder
          const committedParentPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedParentPromptFolder.id
          )

          if (!committedParentPromptFolder) {
            return { success: false, error: 'Parent prompt folder not loaded' }
          }

          if (committedParentPromptFolder.committed.depth >= MAX_SUBFOLDER_DEPTH) {
            return {
              success: false,
              error: 'Prompt folders can contain up to 8 nested subfolder layers'
            }
          }

          if (
            payload.previousEntryId !== null &&
            !committedParentPromptFolder.committed.entryIds.includes(payload.previousEntryId)
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

          if (hasPromptSubfolderNameConflict(requestedParentPromptFolder.id, folderName)) {
            return { success: false, error: 'A folder with this name already exists' }
          }

          const insertIndex =
            payload.previousEntryId === null
              ? 0
              : committedParentPromptFolder.committed.entryIds.indexOf(payload.previousEntryId) + 1
          const now = getCurrentIsoSecondTimestamp()
          const subfolderName = path.join(
            committedParentPromptFolder.committed.folderName,
            folderName
          )
          const subfolderDepth = committedParentPromptFolder.committed.depth + 1

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              parentPromptFolder: tx.promptFolder.update({
                id: requestedParentPromptFolder.id,
                expectedRevision: requestedParentPromptFolder.expectedRevision,
                recipe: (draft) => {
                  const nextEntryIds = [...draft.entryIds]
                  nextEntryIds.splice(insertIndex, 0, payload.promptFolderId)
                  draft.entryIds = nextEntryIds
                  draft.modifiedAt = now
                }
              }),
              promptFolder: tx.promptFolder.create({
                id: payload.promptFolderId,
                data: {
                  id: payload.promptFolderId,
                  folderName: subfolderName,
                  displayName: normalizedDisplayName,
                  parentPromptFolderId: requestedParentPromptFolder.id,
                  depth: subfolderDepth,
                  modifiedAt: now,
                  promptCount: 0,
                  entryIds: [],
                  completedPromptIds: [],
                  settings: createEmptyPromptFolderSettings()
                },
                persistenceFields: {
                  workspaceId: committedParentPromptFolder.persistenceFields.workspaceId,
                  workspacePath: committedParentPromptFolder.persistenceFields.workspacePath,
                  folderName: subfolderName,
                  parentPromptFolderId: requestedParentPromptFolder.id,
                  depth: subfolderDepth
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.promptFolder.committedStore.getEntry(requestedParentPromptFolder.id),
              'Parent prompt folder not loaded',
              (latestParentPromptFolder) => ({
                parentPromptFolder: buildPromptFolderSnapshot(latestParentPromptFolder)
              })
            )
          }

          const updatedParentPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedParentPromptFolder.id
          )
          const createdPromptFolder = data.promptFolder.committedStore.getEntry(
            payload.promptFolderId
          )

          if (!updatedParentPromptFolder || !createdPromptFolder) {
            return { success: false, error: 'Prompt subfolder create commit did not complete' }
          }

          return {
            success: true,
            payload: {
              parentPromptFolder: buildPromptFolderSnapshot(updatedParentPromptFolder),
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

          const now = getCurrentIsoSecondTimestamp()
          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.settings = copyPromptFolderSettings(requestedPromptFolder.data)
                  draft.modifiedAt = now
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
