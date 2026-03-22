import { ipcMain } from 'electron'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import {
  parseCreatePromptFolderRequest,
  parseUpdatePromptFolderRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'

const getLoadedWorkspacePromptFolderIds = (promptFolderIds: string[]): string[] => {
  return promptFolderIds.filter((promptFolderId) => {
    return data.promptFolder.committedStore.getEntry(promptFolderId) !== null
  })
}

const getLoadedPromptIds = (promptIds: string[]): string[] => {
  return promptIds.filter((promptId) => data.prompt.committedStore.getEntry(promptId) !== null)
}

const buildWorkspaceSnapshot = (
  workspaceEntry: NonNullable<ReturnType<typeof data.workspace.committedStore.getEntry>>
) => {
  return {
    id: workspaceEntry.committed.id,
    revision: workspaceEntry.revision,
    data: {
      ...workspaceEntry.committed,
      promptFolderIds: getLoadedWorkspacePromptFolderIds(workspaceEntry.committed.promptFolderIds)
    }
  }
}

const buildPromptFolderSnapshot = (
  promptFolderEntry: NonNullable<ReturnType<typeof data.promptFolder.committedStore.getEntry>>
) => {
  return {
    id: promptFolderEntry.committed.id,
    revision: promptFolderEntry.revision,
    data: {
      ...promptFolderEntry.committed,
      promptIds: getLoadedPromptIds(promptFolderEntry.committed.promptIds)
    }
  }
}

const hasPromptFolderNameConflict = (
  workspaceEntry: NonNullable<ReturnType<typeof data.workspace.committedStore.getEntry>>,
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

  const remainingCountsByPromptId = new Map<string, number>()

  for (const promptId of existingPromptIds) {
    remainingCountsByPromptId.set(promptId, (remainingCountsByPromptId.get(promptId) ?? 0) + 1)
  }

  for (const promptId of nextPromptIds) {
    const remainingCount = remainingCountsByPromptId.get(promptId)

    if (!remainingCount) {
      return false
    }

    if (remainingCount === 1) {
      remainingCountsByPromptId.delete(promptId)
      continue
    }

    remainingCountsByPromptId.set(promptId, remainingCount - 1)
  }

  return remainingCountsByPromptId.size === 0
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
