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
          const workspaceEntity = payload.workspace
          const workspaceEntry = data.workspace.committedStore.getEntry(workspaceEntity.id)

          if (!workspaceEntry) {
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

          if (hasPromptFolderNameConflict(workspaceEntry, folderName)) {
            return { success: false, error: 'A folder with this name already exists' }
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              workspace: tx.workspace.update({
                id: workspaceEntity.id,
                expectedRevision: workspaceEntity.expectedRevision,
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
                  workspaceId: workspaceEntity.id,
                  workspacePath: workspaceEntry.committed.workspacePath,
                  folderName
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            const latestWorkspaceEntry = data.workspace.committedStore.getEntry(workspaceEntity.id)

            if (!latestWorkspaceEntry) {
              return { success: false, error: 'Workspace not loaded' }
            }

            return {
              success: false,
              conflict: true,
              payload: {
                workspace: buildWorkspaceSnapshot(latestWorkspaceEntry)
              }
            }
          }

          const nextWorkspaceEntry = data.workspace.committedStore.getEntry(workspaceEntity.id)
          const nextPromptFolderEntry = data.promptFolder.committedStore.getEntry(payload.promptFolderId)

          if (!nextWorkspaceEntry || !nextPromptFolderEntry) {
            return { success: false, error: 'Prompt folder create commit did not complete' }
          }

          return {
            success: true,
            payload: {
              workspace: buildWorkspaceSnapshot(nextWorkspaceEntry),
              promptFolder: buildPromptFolderSnapshot(nextPromptFolderEntry)
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
          const promptFolderEntity = validatedRequest.payload.promptFolder
          const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderEntity.id)

          if (!promptFolderEntry) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          if (
            !hasMatchingPromptIds(promptFolderEntry.committed.promptIds, promptFolderEntity.data.promptIds)
          ) {
            return { success: false, error: 'Invalid prompt order' }
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: promptFolderEntity.id,
                expectedRevision: promptFolderEntity.expectedRevision,
                recipe: (draft) => {
                  draft.folderDescription = promptFolderEntity.data.folderDescription
                  draft.promptIds = [...promptFolderEntity.data.promptIds]
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            const latestPromptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderEntity.id)

            if (!latestPromptFolderEntry) {
              return { success: false, error: 'Prompt folder not loaded' }
            }

            return {
              success: false,
              conflict: true,
              payload: {
                promptFolder: buildPromptFolderSnapshot(latestPromptFolderEntry)
              }
            }
          }

          const nextPromptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderEntity.id)

          if (!nextPromptFolderEntry) {
            return { success: false, error: 'Prompt folder update commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(nextPromptFolderEntry)
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
