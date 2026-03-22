import { ipcMain } from 'electron'
import type { PromptPersisted } from '@shared/Prompt'
import { PromptUiStateDataAccess } from '../DataAccess/PromptUiStateDataAccess'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import {
  parseCreatePromptRequest,
  parseDeletePromptRequest,
  parseUpdatePromptRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'

const getLoadedPromptIds = (promptIds: string[]): string[] => {
  return promptIds.filter((promptId) => data.prompt.committedStore.getEntry(promptId) !== null)
}

const buildPromptSnapshot = (
  promptEntry: NonNullable<ReturnType<typeof data.prompt.committedStore.getEntry>>
) => {
  return {
    id: promptEntry.committed.id,
    revision: promptEntry.revision,
    data: promptEntry.committed
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

export const setupPromptMutationHandlers = (): void => {
  ipcMain.handle('create-prompt', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseCreatePromptRequest,
      async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const promptFolderEntity = payload.promptFolder
          const promptEntity = payload.prompt
          const promptId = promptEntity.data.id
          const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderEntity.id)

          if (!promptFolderEntry) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          if (data.prompt.committedStore.getEntry(promptId)) {
            return { success: false, error: 'Prompt already exists' }
          }

          let insertIndex = promptFolderEntry.committed.promptIds.length
          if (payload.previousPromptId === null) {
            insertIndex = 0
          } else {
            const previousIndex = promptFolderEntry.committed.promptIds.indexOf(payload.previousPromptId)
            if (previousIndex === -1) {
              return { success: false, error: 'Previous prompt not found' }
            }
            insertIndex = previousIndex + 1
          }

          const nextPromptCount = promptFolderEntry.committed.promptCount + 1
          const now = new Date().toISOString()
          const prompt: PromptPersisted = {
            id: promptId,
            title: promptEntity.data.title,
            creationDate: now,
            lastModifiedDate: now,
            promptText: promptEntity.data.promptText,
            promptFolderCount: nextPromptCount
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: promptFolderEntity.id,
                expectedRevision: promptFolderEntity.expectedRevision,
                recipe: (draft) => {
                  const nextPromptIds = [...draft.promptIds]
                  nextPromptIds.splice(insertIndex, 0, promptId)
                  draft.promptIds = nextPromptIds
                  draft.promptCount += 1
                }
              }),
              prompt: tx.prompt.create({
                id: promptId,
                data: prompt,
                persistenceFields: {
                  workspaceId: promptFolderEntry.persistenceFields.workspaceId,
                  workspacePath: promptFolderEntry.persistenceFields.workspacePath,
                  folderName: promptFolderEntry.persistenceFields.folderName,
                  promptFolderId: promptFolderEntity.id,
                  promptId,
                  promptStem: promptId
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
          const nextPromptEntry = data.prompt.committedStore.getEntry(promptId)

          if (!nextPromptFolderEntry || !nextPromptEntry) {
            return { success: false, error: 'Prompt create commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(nextPromptFolderEntry),
              prompt: buildPromptSnapshot(nextPromptEntry)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message }
        }
      }
    )
  })

  ipcMain.handle('delete-prompt', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseDeletePromptRequest,
      async (validatedRequest) => {
        try {
          const promptFolderEntity = validatedRequest.payload.promptFolder
          const promptEntity = validatedRequest.payload.prompt
          const promptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderEntity.id)

          if (!promptFolderEntry) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          const promptId = promptEntity.id
          const promptEntry = data.prompt.committedStore.getEntry(promptId)
          if (!promptEntry || !promptFolderEntry.committed.promptIds.includes(promptId)) {
            return {
              success: false,
              conflict: true,
              payload: {
                promptFolder: buildPromptFolderSnapshot(promptFolderEntry)
              }
            }
          }

          const workspaceId = promptFolderEntry.persistenceFields.workspaceId
          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: promptFolderEntity.id,
                expectedRevision: promptFolderEntity.expectedRevision,
                recipe: (draft) => {
                  draft.promptIds = draft.promptIds.filter((currentPromptId) => currentPromptId !== promptId)
                }
              }),
              prompt: tx.prompt.delete({
                id: promptId,
                expectedRevision: promptEntity.expectedRevision
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

          // Side effect: remove persisted Monaco view state for deleted prompts.
          PromptUiStateDataAccess.deletePromptUiState(workspaceId, promptId)

          const nextPromptFolderEntry = data.promptFolder.committedStore.getEntry(promptFolderEntity.id)

          if (!nextPromptFolderEntry) {
            return { success: false, error: 'Prompt delete commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(nextPromptFolderEntry)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to delete prompt' }
        }
      }
    )
  })

  ipcMain.handle('update-prompt', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseUpdatePromptRevisionRequest,
      async (validatedRequest) => {
        try {
          const promptEntity = validatedRequest.payload.prompt
          const promptEntry = data.prompt.committedStore.getEntry(promptEntity.id)

          if (!promptEntry) {
            return { success: false, error: 'Prompt not loaded' }
          }

          const nextLastModifiedDate = new Date().toISOString()
          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              prompt: tx.prompt.update({
                id: promptEntity.id,
                expectedRevision: promptEntity.expectedRevision,
                recipe: (draft) => {
                  draft.title = promptEntity.data.title
                  draft.creationDate = promptEntity.data.creationDate
                  draft.promptText = promptEntity.data.promptText
                  draft.promptFolderCount = promptEntity.data.promptFolderCount
                  draft.lastModifiedDate = nextLastModifiedDate
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            const latestPromptEntry = data.prompt.committedStore.getEntry(promptEntity.id)

            if (!latestPromptEntry) {
              return { success: false, error: 'Prompt not loaded' }
            }

            return {
              success: false,
              conflict: true,
              payload: {
                prompt: buildPromptSnapshot(latestPromptEntry)
              }
            }
          }

          const nextPromptEntry = data.prompt.committedStore.getEntry(promptEntity.id)

          if (!nextPromptEntry) {
            return { success: false, error: 'Prompt update commit did not complete' }
          }

          return {
            success: true,
            payload: {
              prompt: buildPromptSnapshot(nextPromptEntry)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to update prompt' }
        }
      }
    )
  })
}
