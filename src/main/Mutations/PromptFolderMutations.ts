import { ipcMain } from 'electron'
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
  parseUpdatePromptFolderRevisionRequest
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

const hasMatchingPromptIds = (existingPromptIds: string[], nextPromptIds: string[]): boolean => {
  if (existingPromptIds.length !== nextPromptIds.length) {
    return false
  }

  const sortedExistingPromptIds = [...existingPromptIds].sort()
  const sortedNextPromptIds = [...nextPromptIds].sort()
  return sortedExistingPromptIds.every(
    (existingPromptId, index) => existingPromptId === sortedNextPromptIds[index]
  )
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

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              workspace: tx.workspace.update({
                id: requestedWorkspace.id,
                expectedRevision: requestedWorkspace.expectedRevision,
                recipe: (draft) => {
                  draft.promptFolderIds = [...draft.promptFolderIds, payload.promptFolderId]
                }
              }),
              promptFolder: tx.promptFolder.create({
                id: payload.promptFolderId,
                data: {
                  id: payload.promptFolderId,
                  folderName,
                  displayName: normalizedDisplayName,
                  promptCount: 0,
                  promptIds: [],
                  folderDescription: ''
                },
                persistenceFields: {
                  workspaceId: requestedWorkspace.id,
                  workspacePath: committedWorkspace.committed.workspacePath,
                  folderName
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

  ipcMain.handle('update-prompt-folder', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseUpdatePromptFolderRevisionRequest,
      async (validatedRequest) => {
        try {
          const requestedPromptFolder = validatedRequest.payload.promptFolder
          const committedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )

          if (!committedPromptFolder) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          if (
            !hasMatchingPromptIds(
              committedPromptFolder.committed.promptIds,
              requestedPromptFolder.data.promptIds
            )
          ) {
            return { success: false, error: 'Invalid prompt order' }
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.folderDescription = requestedPromptFolder.data.folderDescription
                  draft.promptIds = [...requestedPromptFolder.data.promptIds]
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
