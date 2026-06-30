import { ipcMain } from 'electron'
import { PromptStatus } from '@shared/Prompt'
import type {
  CompletePromptResponsePayload,
  MovePromptResponsePayload,
  PromptPersisted,
  UncompletePromptResponsePayload
} from '@shared/Prompt'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import { PromptUiStateDataAccess } from '../DataAccess/PromptUiStateDataAccess'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildPromptFolderSnapshot, buildPromptSnapshot } from '../Data/DataSnapshotHelpers'
import type { PromptFolder } from '@shared/PromptFolder'
import {
  parseCreatePromptRequest,
  parseDeletePromptRequest,
  parseCompletePromptRequest,
  parseMovePromptRequest,
  parseUncompletePromptRequest,
  parseUpdatePromptRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'
import { resolveCompletedPromptFolderName } from '../Persistence/PromptPersistencePaths'

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

const lookupCommittedPrompt = (promptId: string): PromptPersisted | null => {
  return data.prompt.committedStore.getEntry(promptId)?.committed ?? null
}

const getPromptFolderPromptIds = (promptFolder: PromptFolder): string[] => {
  return promptFolder.entryIds.filter((entryId) => data.prompt.committedStore.getEntry(entryId))
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
  const latestDestinationPromptFolder =
    data.promptFolder.committedStore.getEntry(destinationPromptFolderId)
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

const buildCompletePromptConflictResponse = (
  promptFolderId: string,
  promptId: string
):
  | {
      success: false
      error: string
    }
  | {
      success: false
      conflict: true
      payload: CompletePromptResponsePayload | UncompletePromptResponsePayload
    } => {
  const latestPromptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)
  const latestPrompt = data.prompt.committedStore.getEntry(promptId)

  if (!latestPromptFolder || !latestPrompt) {
    return { success: false, error: 'Prompt complete conflict data not loaded' }
  }

  return {
    success: false,
    conflict: true,
    payload: {
      promptFolder: buildPromptFolderSnapshot(latestPromptFolder),
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

          let insertIndex = committedPromptFolder.committed.entryIds.length
          if (payload.previousPromptId === null) {
            insertIndex = 0
          } else {
            const previousIndex = committedPromptFolder.committed.entryIds.indexOf(
              payload.previousPromptId
            )
            if (previousIndex === -1) {
              return { success: false, error: 'Previous prompt not found' }
            }
            insertIndex = previousIndex + 1
          }

          const now = getCurrentIsoSecondTimestamp()
          const promptIds = getPromptFolderPromptIds(committedPromptFolder.committed)
          const promptTitleFields = resolvePromptTitleUpdateForPromptIds({
            promptIds,
            lookupPrompt: lookupCommittedPrompt,
            promptId,
            currentFallbackTitle: requestedPrompt.data.fallbackTitle,
            nextTitle: requestedPrompt.data.title
          })
          const prompt: PromptPersisted = {
            id: promptId,
            title: promptTitleFields.title,
            fallbackTitle: promptTitleFields.fallbackTitle,
            createdAt: now,
            modifiedAt: now,
            status: PromptStatus.ToDo,
            promptText: requestedPrompt.data.promptText
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  const nextEntryIds = [...draft.entryIds]
                  nextEntryIds.splice(insertIndex, 0, promptId)
                  draft.entryIds = nextEntryIds
                  draft.promptCount = nextEntryIds.filter((entryId) =>
                    data.prompt.committedStore.getEntry(entryId)
                  ).length + 1
                  draft.modifiedAt = now
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
          if (
            !committedPrompt ||
            (!committedPromptFolder.committed.entryIds.includes(promptId) &&
              !committedPromptFolder.committed.completedPromptIds.includes(promptId))
          ) {
            return buildConflictResponseFromLatest(
              data.promptFolder.committedStore.getEntry(requestedPromptFolder.id),
              'Prompt folder not loaded',
              (latestPromptFolder) => ({
                promptFolder: buildPromptFolderSnapshot(latestPromptFolder)
              })
            )
          }

          const workspaceId = committedPromptFolder.persistenceFields.workspaceId
          const now = getCurrentIsoSecondTimestamp()
          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.entryIds = draft.entryIds.filter((entryId) => entryId !== promptId)
                  draft.completedPromptIds = draft.completedPromptIds.filter(
                    (currentPromptId) => currentPromptId !== promptId
                  )
                  draft.promptCount = Math.max(0, draft.promptCount - 1)
                  draft.modifiedAt = now
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

          const promptFolder = data.promptFolder.committedStore.getEntry(
            committedPrompt.persistenceFields.promptFolderId
          )

          if (!promptFolder) {
            return { success: false, error: 'Prompt folder not loaded' }
          }

          const now = getCurrentIsoSecondTimestamp()
          const promptIds = getPromptFolderPromptIds(promptFolder.committed)
          const promptTitleFields = resolvePromptTitleUpdateForPromptIds({
            promptIds,
            lookupPrompt: lookupCommittedPrompt,
            promptId: requestedPrompt.id,
            currentTitle: committedPrompt.committed.title,
            currentFallbackTitle: requestedPrompt.data.fallbackTitle,
            nextTitle: requestedPrompt.data.title
          })

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: promptFolder.committed.id,
                recipe: (draft) => {
                  draft.modifiedAt = now
                }
              }),
              prompt: tx.prompt.update({
                id: requestedPrompt.id,
                expectedRevision: requestedPrompt.expectedRevision,
                recipe: (draft) => {
                  draft.title = promptTitleFields.title
                  draft.fallbackTitle = promptTitleFields.fallbackTitle
                  draft.createdAt = requestedPrompt.data.createdAt
                  draft.modifiedAt = requestedPrompt.data.modifiedAt
                  draft.promptText = requestedPrompt.data.promptText
                  draft.status = requestedPrompt.data.status
                  if (
                    requestedPrompt.data.status === PromptStatus.Completed &&
                    requestedPrompt.data.completedAt
                  ) {
                    draft.completedAt = requestedPrompt.data.completedAt
                  } else {
                    delete draft.completedAt
                  }
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
          const updatedPromptFolder = data.promptFolder.committedStore.getEntry(
            promptFolder.committed.id
          )

          if (!updatedPrompt || !updatedPromptFolder) {
            return { success: false, error: 'Prompt update commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(updatedPromptFolder),
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

          if (!sourcePromptFolder.committed.entryIds.includes(requestedPrompt.id)) {
            return buildMovePromptConflictResponse(
              requestedSourcePromptFolder.id,
              requestedDestinationPromptFolder.id,
              requestedPrompt.id
            )
          }

          const isSameFolder =
            requestedSourcePromptFolder.id === requestedDestinationPromptFolder.id
          const destinationEntryIds = isSameFolder
            ? sourcePromptFolder.committed.entryIds.filter(
                (entryId) => entryId !== requestedPrompt.id
              )
            : destinationPromptFolder.committed.entryIds
          const insertIndex = resolvePromptInsertIndex(destinationEntryIds, orderAfterPromptId)

          if (insertIndex === null) {
            return { success: false, error: 'Order-after prompt not found' }
          }

          const now = getCurrentIsoSecondTimestamp()
          const transactionOutcome = isSameFolder
            ? await runAtomicDataTransaction((tx) => {
                return {
                  sourcePromptFolder: tx.promptFolder.update({
                    id: requestedSourcePromptFolder.id,
                    expectedRevision: requestedSourcePromptFolder.expectedRevision,
                    recipe: (draft) => {
                      const nextEntryIds = draft.entryIds.filter(
                        (entryId) => entryId !== requestedPrompt.id
                      )
                      nextEntryIds.splice(insertIndex, 0, requestedPrompt.id)
                      draft.entryIds = nextEntryIds
                      draft.modifiedAt = now
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
                      draft.entryIds = draft.entryIds.filter(
                        (entryId) => entryId !== requestedPrompt.id
                      )
                      draft.promptCount = Math.max(0, draft.promptCount - 1)
                      draft.modifiedAt = now
                    }
                  }),
                  destinationPromptFolder: tx.promptFolder.update({
                    id: requestedDestinationPromptFolder.id,
                    expectedRevision: requestedDestinationPromptFolder.expectedRevision,
                    recipe: (draft) => {
                      const nextEntryIds = [...draft.entryIds]
                      nextEntryIds.splice(insertIndex, 0, requestedPrompt.id)
                      draft.entryIds = nextEntryIds
                      draft.promptCount += 1
                      draft.modifiedAt = now
                    }
                  }),
                  prompt: tx.prompt.update({
                    id: requestedPrompt.id,
                    expectedRevision: requestedPrompt.expectedRevision,
                    recipe: (draft) => {
                      if (draft.title.trim().length === 0) {
                        draft.fallbackTitle = resolvePromptTitleUpdateForPromptIds({
                          promptIds: destinationEntryIds.filter((entryId) =>
                            data.prompt.committedStore.getEntry(entryId)
                          ),
                          lookupPrompt: lookupCommittedPrompt,
                          promptId: requestedPrompt.id,
                          currentTitle: draft.title,
                          currentFallbackTitle: draft.fallbackTitle,
                          nextTitle: draft.title
                        }).fallbackTitle
                      }
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

  ipcMain.handle('complete-prompt', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseCompletePromptRequest,
      async (validatedRequest) => {
        try {
          const requestedPromptFolder = validatedRequest.payload.promptFolder
          const requestedPrompt = validatedRequest.payload.prompt
          const promptFolder = data.promptFolder.committedStore.getEntry(requestedPromptFolder.id)
          const prompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!promptFolder || !prompt) {
            return { success: false, error: 'Prompt complete data not loaded' }
          }

          if (!promptFolder.committed.entryIds.includes(requestedPrompt.id)) {
            return buildCompletePromptConflictResponse(
              requestedPromptFolder.id,
              requestedPrompt.id
            )
          }

          const now = getCurrentIsoSecondTimestamp()
          const completedPrompt: PromptPersisted = {
            ...requestedPrompt.data,
            status: PromptStatus.Completed,
            completedAt: now,
            modifiedAt: now
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.entryIds = draft.entryIds.filter((entryId) => entryId !== requestedPrompt.id)
                  draft.completedPromptIds = [...draft.completedPromptIds, requestedPrompt.id]
                  draft.promptCount = Math.max(0, draft.promptCount - 1)
                  draft.modifiedAt = now
                }
              }),
              prompt: tx.prompt.update({
                id: requestedPrompt.id,
                expectedRevision: requestedPrompt.expectedRevision,
                recipe: (draft) => {
                  Object.assign(draft, completedPrompt)
                },
                persistenceFields: {
                  ...prompt.persistenceFields,
                  folderName: resolveCompletedPromptFolderName(
                    promptFolder.persistenceFields.folderName
                  ),
                  previousFolderName: promptFolder.persistenceFields.folderName,
                  promptFolderId: requestedPromptFolder.id
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            return buildCompletePromptConflictResponse(requestedPromptFolder.id, requestedPrompt.id)
          }

          const updatedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )
          const updatedPrompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!updatedPromptFolder || !updatedPrompt) {
            return { success: false, error: 'Prompt complete commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(updatedPromptFolder),
              prompt: buildPromptSnapshot(updatedPrompt)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to complete prompt' }
        }
      }
    )
  })

  ipcMain.handle('uncomplete-prompt', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseUncompletePromptRequest,
      async (validatedRequest) => {
        try {
          const requestedPromptFolder = validatedRequest.payload.promptFolder
          const requestedPrompt = validatedRequest.payload.prompt
          const promptFolder = data.promptFolder.committedStore.getEntry(requestedPromptFolder.id)
          const prompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!promptFolder || !prompt) {
            return { success: false, error: 'Prompt uncomplete data not loaded' }
          }

          if (!promptFolder.committed.completedPromptIds.includes(requestedPrompt.id)) {
            return buildCompletePromptConflictResponse(
              requestedPromptFolder.id,
              requestedPrompt.id
            )
          }

          const now = getCurrentIsoSecondTimestamp()
          const {
            completedAt: _completedAt,
            ...requestedActivePrompt
          } = requestedPrompt.data
          const activePrompt: PromptPersisted = {
            ...requestedActivePrompt,
            status: PromptStatus.ToDo,
            modifiedAt: now
          }

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.completedPromptIds = draft.completedPromptIds.filter(
                    (promptId) => promptId !== requestedPrompt.id
                  )
                  draft.entryIds = [
                    requestedPrompt.id,
                    ...draft.entryIds.filter((entryId) => entryId !== requestedPrompt.id)
                  ]
                  draft.promptCount += 1
                  draft.modifiedAt = now
                }
              }),
              prompt: tx.prompt.update({
                id: requestedPrompt.id,
                expectedRevision: requestedPrompt.expectedRevision,
                recipe: (draft) => {
                  Object.assign(draft, activePrompt)
                  delete draft.completedAt
                },
                persistenceFields: {
                  ...prompt.persistenceFields,
                  folderName: promptFolder.persistenceFields.folderName,
                  previousFolderName: resolveCompletedPromptFolderName(
                    promptFolder.persistenceFields.folderName
                  ),
                  promptFolderId: requestedPromptFolder.id
                }
              })
            }
          })

          if (transactionOutcome.status === 'conflict') {
            return buildCompletePromptConflictResponse(requestedPromptFolder.id, requestedPrompt.id)
          }

          const updatedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )
          const updatedPrompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!updatedPromptFolder || !updatedPrompt) {
            return { success: false, error: 'Prompt uncomplete commit did not complete' }
          }

          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(updatedPromptFolder),
              prompt: buildPromptSnapshot(updatedPrompt)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to uncomplete prompt' }
        }
      }
    )
  })
}
