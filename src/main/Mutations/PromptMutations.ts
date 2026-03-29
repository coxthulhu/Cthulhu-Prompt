import { ipcMain } from 'electron'
import type { MovePromptResponsePayload, PromptPersisted } from '@shared/Prompt'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { PromptUiStateDataAccess } from '../DataAccess/PromptUiStateDataAccess'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildPromptFolderSnapshot, buildPromptSnapshot } from '../Data/DataSnapshotHelpers'
import {
  parseCreatePromptRequest,
  parseDeletePromptRequest,
  parseMovePromptRequest,
  parseUpdatePromptRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'

const resolvePromptInsertIndex = (
  promptIds: string[],
  orderAfterPromptId: string | null
): number | null => {
  if (orderAfterPromptId === null) {
    return 0
  }

  const previousIndex = promptIds.indexOf(orderAfterPromptId)
  return previousIndex === -1 ? null : previousIndex + 1
}

const buildMovePromptConflictResponse = (
  sourcePromptFolderId: string,
  destinationPromptFolderId: string,
  promptId: string
):
  | {
      success: false
      error: string
    }
  | {
      success: false
      conflict: true
      payload: MovePromptResponsePayload
    } => {
  const latestSourcePromptFolder = data.promptFolder.committedStore.getEntry(sourcePromptFolderId)
  const latestDestinationPromptFolder = data.promptFolder.committedStore.getEntry(
    destinationPromptFolderId
  )
  const latestPrompt = data.prompt.committedStore.getEntry(promptId)

  if (!latestSourcePromptFolder || !latestDestinationPromptFolder || !latestPrompt) {
    return { success: false, error: 'Prompt move conflict data not loaded' }
  }

  return {
    success: false,
    conflict: true,
    payload: {
      sourcePromptFolder: buildPromptFolderSnapshot(latestSourcePromptFolder),
      destinationPromptFolder: buildPromptFolderSnapshot(latestDestinationPromptFolder),
      prompt: buildPromptSnapshot(latestPrompt)
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
          const requestedPromptFolder = payload.promptFolder
          const requestedPrompt = payload.prompt
          const promptId = requestedPrompt.data.id
          const committedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )

          if (!committedPromptFolder) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          if (data.prompt.committedStore.getEntry(promptId)) {
            return { success: false, error: 'Prompt already exists' }
          }

          let insertIndex = committedPromptFolder.committed.promptIds.length
          if (payload.previousPromptId === null) {
            insertIndex = 0
          } else {
            const previousIndex = committedPromptFolder.committed.promptIds.indexOf(
              payload.previousPromptId
            )
            if (previousIndex === -1) {
              return { success: false, error: 'Previous prompt not found' }
            }
            insertIndex = previousIndex + 1
          }

          const nextPromptCount = committedPromptFolder.committed.promptCount + 1
          const now = getCurrentIsoSecondTimestamp()
          const prompt: PromptPersisted = {
            id: promptId,
            title: requestedPrompt.data.title,
            createdAt: now,
            promptText: requestedPrompt.data.promptText,
            promptFolderCount: nextPromptCount
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
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
                  workspaceId: committedPromptFolder.persistenceFields.workspaceId,
                  workspacePath: committedPromptFolder.persistenceFields.workspacePath,
                  folderName: committedPromptFolder.persistenceFields.folderName,
                  promptFolderId: requestedPromptFolder.id,
                  promptId,
                  promptStem: promptId
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
          const createdPrompt = data.prompt.committedStore.getEntry(promptId)

          if (!updatedPromptFolder || !createdPrompt) {
            return { success: false, error: 'Prompt create commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(updatedPromptFolder),
              prompt: buildPromptSnapshot(createdPrompt)
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
          const requestedPromptFolder = validatedRequest.payload.promptFolder
          const requestedPrompt = validatedRequest.payload.prompt
          const committedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )

          if (!committedPromptFolder) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          const promptId = requestedPrompt.id
          const committedPrompt = data.prompt.committedStore.getEntry(promptId)
          if (!committedPrompt || !committedPromptFolder.committed.promptIds.includes(promptId)) {
            return buildConflictResponseFromLatest(
              data.promptFolder.committedStore.getEntry(requestedPromptFolder.id),
              'Prompt folder not loaded',
              (latestPromptFolder) => ({
                promptFolder: buildPromptFolderSnapshot(latestPromptFolder)
              })
            )
          }

          const workspaceId = committedPromptFolder.persistenceFields.workspaceId
          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.promptIds = draft.promptIds.filter(
                    (currentPromptId) => currentPromptId !== promptId
                  )
                }
              }),
              prompt: tx.prompt.delete({
                id: promptId,
                expectedRevision: requestedPrompt.expectedRevision
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

          // Side effect: remove persisted Monaco view state for deleted prompts.
          PromptUiStateDataAccess.deletePromptUiState(workspaceId, promptId)

          const updatedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )

          if (!updatedPromptFolder) {
            return { success: false, error: 'Prompt delete commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(updatedPromptFolder)
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
          const requestedPrompt = validatedRequest.payload.prompt
          const committedPrompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!committedPrompt) {
            return { success: false, error: 'Prompt not loaded' }
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              prompt: tx.prompt.update({
                id: requestedPrompt.id,
                expectedRevision: requestedPrompt.expectedRevision,
                recipe: (draft) => {
                  draft.title = requestedPrompt.data.title
                  draft.createdAt = requestedPrompt.data.createdAt
                  draft.promptText = requestedPrompt.data.promptText
                  draft.promptFolderCount = requestedPrompt.data.promptFolderCount
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            return buildConflictResponseFromLatest(
              data.prompt.committedStore.getEntry(requestedPrompt.id),
              'Prompt not loaded',
              (latestPrompt) => ({
                prompt: buildPromptSnapshot(latestPrompt)
              })
            )
          }

          const updatedPrompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!updatedPrompt) {
            return { success: false, error: 'Prompt update commit did not complete' }
          }

          return {
            success: true,
            payload: {
              prompt: buildPromptSnapshot(updatedPrompt)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to update prompt' }
        }
      }
    )
  })

  ipcMain.handle('move-prompt', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseMovePromptRequest,
      async (validatedRequest) => {
        try {
          const {
            sourcePromptFolder: requestedSourcePromptFolder,
            destinationPromptFolder: requestedDestinationPromptFolder,
            prompt: requestedPrompt,
            orderAfterPromptId
          } = validatedRequest.payload
          const sourcePromptFolder = data.promptFolder.committedStore.getEntry(
            requestedSourcePromptFolder.id
          )
          const destinationPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedDestinationPromptFolder.id
          )
          const prompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!sourcePromptFolder || !destinationPromptFolder || !prompt) {
            return { success: false, error: 'Prompt move data not loaded' }
          }

          if (!sourcePromptFolder.committed.promptIds.includes(requestedPrompt.id)) {
            return buildMovePromptConflictResponse(
              requestedSourcePromptFolder.id,
              requestedDestinationPromptFolder.id,
              requestedPrompt.id
            )
          }

          const isSameFolder = requestedSourcePromptFolder.id === requestedDestinationPromptFolder.id
          const destinationPromptIds = isSameFolder
            ? sourcePromptFolder.committed.promptIds.filter((promptId) => promptId !== requestedPrompt.id)
            : destinationPromptFolder.committed.promptIds
          const insertIndex = resolvePromptInsertIndex(destinationPromptIds, orderAfterPromptId)

          if (insertIndex === null) {
            return { success: false, error: 'Order-after prompt not found' }
          }

          const transactionOutcome = isSameFolder
            ? await runAtomicDataTransaction((tx) => {
                return {
                  sourcePromptFolder: tx.promptFolder.update({
                    id: requestedSourcePromptFolder.id,
                    expectedRevision: requestedSourcePromptFolder.expectedRevision,
                    recipe: (draft) => {
                      const nextPromptIds = draft.promptIds.filter(
                        (promptId) => promptId !== requestedPrompt.id
                      )
                      nextPromptIds.splice(insertIndex, 0, requestedPrompt.id)
                      draft.promptIds = nextPromptIds
                    }
                  })
                }
              })
            : await runAtomicDataTransaction((tx) => {
                return {
                  sourcePromptFolder: tx.promptFolder.update({
                    id: requestedSourcePromptFolder.id,
                    expectedRevision: requestedSourcePromptFolder.expectedRevision,
                    recipe: (draft) => {
                      draft.promptIds = draft.promptIds.filter(
                        (promptId) => promptId !== requestedPrompt.id
                      )
                    }
                  }),
                  destinationPromptFolder: tx.promptFolder.update({
                    id: requestedDestinationPromptFolder.id,
                    expectedRevision: requestedDestinationPromptFolder.expectedRevision,
                    recipe: (draft) => {
                      const nextPromptIds = [...draft.promptIds]
                      nextPromptIds.splice(insertIndex, 0, requestedPrompt.id)
                      draft.promptIds = nextPromptIds
                      draft.promptCount += 1
                    }
                  }),
                  prompt: tx.prompt.update({
                    id: requestedPrompt.id,
                    expectedRevision: requestedPrompt.expectedRevision,
                    recipe: (draft) => {
                      draft.promptFolderCount = destinationPromptFolder.committed.promptCount + 1
                    },
                    persistenceFields: {
                      ...prompt.persistenceFields,
                      folderName: destinationPromptFolder.persistenceFields.folderName,
                      previousFolderName: sourcePromptFolder.persistenceFields.folderName,
                      promptFolderId: requestedDestinationPromptFolder.id
                    }
                  })
                }
              })

          if (transactionOutcome.status === 'conflict') {
            return buildMovePromptConflictResponse(
              requestedSourcePromptFolder.id,
              requestedDestinationPromptFolder.id,
              requestedPrompt.id
            )
          }

          const updatedSourcePromptFolder = data.promptFolder.committedStore.getEntry(
            requestedSourcePromptFolder.id
          )
          const updatedDestinationPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedDestinationPromptFolder.id
          )
          const updatedPrompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!updatedSourcePromptFolder || !updatedDestinationPromptFolder || !updatedPrompt) {
            return { success: false, error: 'Prompt move commit did not complete' }
          }

          return {
            success: true,
            payload: {
              sourcePromptFolder: buildPromptFolderSnapshot(updatedSourcePromptFolder),
              destinationPromptFolder: buildPromptFolderSnapshot(updatedDestinationPromptFolder),
              prompt: buildPromptSnapshot(updatedPrompt)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to move prompt' }
        }
      }
    )
  })
}
