import { ipcMain } from 'electron'
import * as path from 'path'
import { copyPromptFolderSettings, createEmptyPromptFolderSettings } from '@shared/PromptFolder'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { preparePromptFolderName } from '@shared/promptFolderName'
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
  resolvePromptFolderPathFromData
} from './PromptFolderPathHelpers'

const hasPromptFolderNameConflict = (
  siblingEntryIds: string[],
  folderName: string,
  excludedPromptFolderId: string | null = null
): boolean => {
  const normalizedTargetName = folderName.toLowerCase()

  return siblingEntryIds.some((promptFolderId) => {
    if (promptFolderId === excludedPromptFolderId) {
      return false
    }

    const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderId)

    if (!promptFolderEntry) {
      return false
    }

    return promptFolderEntry.committed.folderName.toLowerCase() === normalizedTargetName
  })
}

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

          if (
            committedParentPromptFolder &&
            committedParentPromptFolder.committed.depth >= MAX_SUBFOLDER_DEPTH
          ) {
            return {
              success: false,
              error: 'Prompt folders can contain up to 8 nested subfolder layers'
            }
          }

          const siblingEntryIds =
            committedParentPromptFolder?.committed.entryIds ??
            committedWorkspace.committed.promptFolderIds

          if (
            payload.previousEntryId !== null &&
            !siblingEntryIds.includes(payload.previousEntryId)
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

          if (hasPromptFolderNameConflict(siblingEntryIds, folderName)) {
            return { success: false, error: 'A folder with this name already exists' }
          }

          const insertIndex =
            payload.previousEntryId === null
              ? 0
              : siblingEntryIds.indexOf(payload.previousEntryId) + 1
          const now = getCurrentIsoSecondTimestamp()
          const parentPromptFolderId = requestedParentPromptFolder?.id ?? null
          const depth = committedParentPromptFolder
            ? committedParentPromptFolder.committed.depth + 1
            : 0
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
                      const nextEntryIds = [...draft.entryIds]
                      nextEntryIds.splice(insertIndex, 0, payload.promptFolderId)
                      draft.entryIds = nextEntryIds
                      draft.modifiedAt = now
                    }
                  })
                : tx.workspace.update({
                    id: requestedWorkspace.id,
                    expectedRevision: requestedWorkspace.expectedRevision,
                    recipe: (draft) => {
                      const nextPromptFolderIds = [...draft.promptFolderIds]
                      nextPromptFolderIds.splice(insertIndex, 0, payload.promptFolderId)
                      draft.promptFolderIds = nextPromptFolderIds
                    }
                  }),
              promptFolder: tx.promptFolder.create({
                id: payload.promptFolderId,
                data: {
                  id: payload.promptFolderId,
                  folderName,
                  displayName: normalizedDisplayName,
                  parentPromptFolderId,
                  depth,
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
                  folderPath,
                  parentPromptFolderId,
                  depth
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

          const siblingEntryIds =
            committedPromptFolder.committed.parentPromptFolderId === null
              ? committedWorkspace.committed.promptFolderIds
              : (data.promptFolder.committedStore.getEntry(
                  committedPromptFolder.committed.parentPromptFolderId
                )?.committed.entryIds ?? [])

          if (hasPromptFolderNameConflict(siblingEntryIds, folderName, requestedPromptFolder.id)) {
            return { success: false, error: 'A folder with this name already exists' }
          }

          const now = getCurrentIsoSecondTimestamp()
          const previousFolderPath = committedPromptFolder.persistenceFields.folderPath
          const folderPath = resolvePromptFolderPathFromData(
            requestedPromptFolder.id,
            new Map([
              [
                requestedPromptFolder.id,
                {
                  folderName,
                  parentPromptFolderId: committedPromptFolder.committed.parentPromptFolderId
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
                  draft.modifiedAt = now
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
