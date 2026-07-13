import { ipcMain } from 'electron'
import { PromptStatus } from '@shared/Prompt'
import type {
  MovePromptResponsePayload,
  PromptPersisted,
  SetPromptStatusResponsePayload
} from '@shared/Prompt'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import {
  getPromptDisplayTitle,
  resolvePromptTitleUpdateForPromptIds
} from '@shared/promptFallbackTitle'
import { buildPromptStem, sanitizePromptTitleForFilename } from '@shared/promptFilename'
import { PromptUiStateDataAccess } from '../DataAccess/PromptUiStateDataAccess'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildPromptFolderSnapshot, buildPromptSnapshot } from '../Data/DataSnapshotHelpers'
import type { PromptFolder } from '@shared/PromptFolder'
import { promptEntryRef, removeEntry, type EntryRef } from '@shared/OrderContainer'
import {
  parseCreatePromptRequest,
  parseDeletePromptRequest,
  parseMovePromptRequest,
  parseSetPromptStatusRequest,
  parseUpdatePromptRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { buildConflictResponseFromLatest } from './MutationResponseHelpers'
import { resolveCompletedPromptFolderName } from '../Persistence/PromptPersistencePaths'
import type { PromptPersistenceFields } from '../Persistence/PromptPersistence'

type AtomicDataTransactionBuilder = Parameters<typeof runAtomicDataTransaction>[0]
type AtomicDataTransactionTx = Parameters<AtomicDataTransactionBuilder>[0]

type PromptFilenameTarget = {
  promptId: string
  prompt: PromptPersisted
  persistenceFields: PromptPersistenceFields
}

type PromptFilenameTargetOverride = {
  prompt: PromptPersisted
  persistenceFields: PromptPersistenceFields
}

const resolvePromptInsertIndex = (
  entries: readonly EntryRef[],
  previousEntryId: string | null
): number | null => {
  if (previousEntryId === null) {
    return 0
  }

  const previousIndex = entries.findIndex((entry) => entry.id === previousEntryId)
  return previousIndex === -1 ? null : previousIndex + 1
}

const lookupCommittedPrompt = (promptId: string): PromptPersisted | null => {
  return data.prompt.committedStore.getEntry(promptId)?.committed ?? null
}

const getPromptFolderPromptIds = (promptFolder: PromptFolder): string[] => {
  return promptFolder.entries
    .filter((entry) => entry.kind === 'prompt')
    .map((entry) => entry.id)
}

const getPromptFolderPromptIdsByStatus = (
  promptFolder: PromptFolder,
  completed: boolean
): string[] =>
  getPromptFolderPromptIds(promptFolder).filter((promptId) => {
    const prompt = data.prompt.committedStore.getEntry(promptId)?.committed
    return prompt ? (prompt.status === PromptStatus.Completed) === completed : false
  })

const getPromptFilenameBoundary = (prompt: PromptPersisted): string => {
  return sanitizePromptTitleForFilename(getPromptDisplayTitle(prompt)).toLowerCase()
}

const collectPromptFilenameTargets = (
  promptIds: string[],
  overridesByPromptId: Map<string, PromptFilenameTargetOverride> = new Map()
): PromptFilenameTarget[] => {
  const targets: PromptFilenameTarget[] = []

  for (const promptId of promptIds) {
    const override = overridesByPromptId.get(promptId)
    if (override) {
      targets.push({ promptId, ...override })
      continue
    }

    const promptEntry = data.prompt.committedStore.getEntry(promptId)
    if (promptEntry) {
      targets.push({
        promptId,
        prompt: promptEntry.committed,
        persistenceFields: promptEntry.persistenceFields
      })
    }
  }

  return targets
}

const planPromptFilenamePersistenceFields = (
  promptIds: string[],
  overridesByPromptId?: Map<string, PromptFilenameTargetOverride>
): PromptFilenameTarget[] => {
  const targets = collectPromptFilenameTargets(promptIds, overridesByPromptId)
  const boundaryCounts = new Map<string, number>()

  for (const target of targets) {
    const boundary = getPromptFilenameBoundary(target.prompt)
    boundaryCounts.set(boundary, (boundaryCounts.get(boundary) ?? 0) + 1)
  }

  return targets.map((target) => ({
    ...target,
    persistenceFields: {
      ...target.persistenceFields,
      needsFilenameIdSuffix:
        (boundaryCounts.get(getPromptFilenameBoundary(target.prompt)) ?? 0) > 1
    }
  }))
}

const getPlannedPromptPersistenceFields = (
  plans: PromptFilenameTarget[],
  promptId: string
): PromptPersistenceFields => {
  return plans.find((plan) => plan.promptId === promptId)!.persistenceFields
}

const shouldUpdatePromptFilename = (plan: PromptFilenameTarget): boolean => {
  const expectedStem = buildPromptStem(
    getPromptDisplayTitle(plan.prompt),
    plan.promptId,
    plan.persistenceFields.needsFilenameIdSuffix
  )

  return (
    plan.persistenceFields.promptStem !== expectedStem ||
    plan.persistenceFields.needsFilenameIdSuffix !==
      data.prompt.committedStore.getEntry(plan.promptId)?.persistenceFields.needsFilenameIdSuffix
  )
}

const createPromptFilenameUpdateHandles = (
  tx: AtomicDataTransactionTx,
  plans: PromptFilenameTarget[],
  excludedPromptIds: Set<string>
): Record<string, ReturnType<typeof tx.prompt.update>> => {
  const handles: Record<string, ReturnType<typeof tx.prompt.update>> = {}

  for (const plan of plans) {
    if (excludedPromptIds.has(plan.promptId) || !shouldUpdatePromptFilename(plan)) {
      continue
    }

    handles[`promptFilename:${plan.promptId}`] = tx.prompt.update({
      id: plan.promptId,
      recipe: () => {},
      persistenceFields: plan.persistenceFields
    })
  }

  return handles
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

const buildSetPromptStatusConflictResponse = (
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
      payload: SetPromptStatusResponsePayload
    } => {
  const latestPromptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)
  const latestPrompt = data.prompt.committedStore.getEntry(promptId)

  if (!latestPromptFolder || !latestPrompt) {
    return { success: false, error: 'Prompt status conflict data not loaded' }
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

          let insertIndex = committedPromptFolder.committed.entries.length
          if (payload.previousEntryId === null) {
            insertIndex = 0
          } else {
            const previousIndex = committedPromptFolder.committed.entries.findIndex(
              (entry) => entry.id === payload.previousEntryId
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
            status: PromptStatus.Todo,
            promptText: requestedPrompt.data.promptText
          }
          const nextEntries = [...committedPromptFolder.committed.entries]
          nextEntries.splice(insertIndex, 0, promptEntryRef(promptId))
          const basePromptPersistenceFields: PromptPersistenceFields = {
            workspaceId: committedPromptFolder.persistenceFields.workspaceId,
            workspacePath: committedPromptFolder.persistenceFields.workspacePath,
            folderPath: committedPromptFolder.persistenceFields.folderPath,
            promptFolderId: requestedPromptFolder.id,
            promptId,
            promptStem: promptId,
            needsFilenameIdSuffix: false
          }
          const filenamePlans = planPromptFilenamePersistenceFields(
            [...getPromptFolderPromptIdsByStatus(committedPromptFolder.committed, false), promptId],
            new Map([[promptId, { prompt, persistenceFields: basePromptPersistenceFields }]])
          )

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.entries = nextEntries
                }
              }),
              prompt: tx.prompt.create({
                id: promptId,
                data: prompt,
                persistenceFields: getPlannedPromptPersistenceFields(filenamePlans, promptId)
              }),
              ...createPromptFilenameUpdateHandles(tx, filenamePlans, new Set([promptId]))
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
            !committedPromptFolder.committed.entries.some(
              (entry) => entry.kind === 'prompt' && entry.id === promptId
            )
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
          const nextEntries = removeEntry(committedPromptFolder.committed.entries, 'prompt', promptId)
          const filenamePlans = [
            ...planPromptFilenamePersistenceFields(
              getPromptFolderPromptIdsByStatus(committedPromptFolder.committed, false).filter(
                (currentPromptId) => currentPromptId !== promptId
              )
            ),
            ...planPromptFilenamePersistenceFields(
              getPromptFolderPromptIdsByStatus(committedPromptFolder.committed, true).filter(
                (currentPromptId) => currentPromptId !== promptId
              )
            )
          ]
          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              promptFolder: tx.promptFolder.update({
                id: requestedPromptFolder.id,
                expectedRevision: requestedPromptFolder.expectedRevision,
                recipe: (draft) => {
                  draft.entries = nextEntries
                }
              }),
              prompt: tx.prompt.delete({
                id: promptId,
                expectedRevision: requestedPrompt.expectedRevision
              }),
              ...createPromptFilenameUpdateHandles(tx, filenamePlans, new Set([promptId]))
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

          const promptIds = getPromptFolderPromptIds(promptFolder.committed)
          const promptTitleFields = resolvePromptTitleUpdateForPromptIds({
            promptIds,
            lookupPrompt: lookupCommittedPrompt,
            promptId: requestedPrompt.id,
            currentTitle: committedPrompt.committed.title,
            currentFallbackTitle: requestedPrompt.data.fallbackTitle,
            nextTitle: requestedPrompt.data.title
          })
          const updatedPromptData: PromptPersisted = {
            id: requestedPrompt.id,
            title: promptTitleFields.title,
            fallbackTitle: promptTitleFields.fallbackTitle,
            createdAt: requestedPrompt.data.createdAt,
            modifiedAt: requestedPrompt.data.modifiedAt,
            promptText: requestedPrompt.data.promptText,
            status: requestedPrompt.data.status,
            ...(requestedPrompt.data.status === PromptStatus.Completed &&
            requestedPrompt.data.completedAt
              ? { completedAt: requestedPrompt.data.completedAt }
              : {})
          }
          const filenamePromptIds = getPromptFolderPromptIdsByStatus(
            promptFolder.committed,
            committedPrompt.committed.status === PromptStatus.Completed
          )
          const filenamePlans = planPromptFilenamePersistenceFields(
            filenamePromptIds,
            new Map([
              [
                requestedPrompt.id,
                { prompt: updatedPromptData, persistenceFields: committedPrompt.persistenceFields }
              ]
            ])
          )

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              prompt: tx.prompt.update({
                id: requestedPrompt.id,
                expectedRevision: requestedPrompt.expectedRevision,
                recipe: (draft) => {
                  Object.assign(draft, updatedPromptData)
                  if (!updatedPromptData.completedAt) {
                    delete draft.completedAt
                  }
                },
                persistenceFields: getPlannedPromptPersistenceFields(
                  filenamePlans,
                  requestedPrompt.id
                )
              }),
              ...createPromptFilenameUpdateHandles(
                tx,
                filenamePlans,
                new Set([requestedPrompt.id])
              )
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
            previousEntryId
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

          if (
            prompt.committed.status === PromptStatus.Completed ||
            !sourcePromptFolder.committed.entries.some(
              (entry) => entry.kind === 'prompt' && entry.id === requestedPrompt.id
            )
          ) {
            return buildMovePromptConflictResponse(
              requestedSourcePromptFolder.id,
              requestedDestinationPromptFolder.id,
              requestedPrompt.id
            )
          }

          const isSameFolder =
            requestedSourcePromptFolder.id === requestedDestinationPromptFolder.id
          const destinationEntryIds = isSameFolder
            ? removeEntry(sourcePromptFolder.committed.entries, 'prompt', requestedPrompt.id)
            : destinationPromptFolder.committed.entries
          const insertIndex = resolvePromptInsertIndex(destinationEntryIds, previousEntryId)

          if (insertIndex === null) {
            return { success: false, error: 'Order-after prompt not found' }
          }

          const nextSourceEntries = removeEntry(
            sourcePromptFolder.committed.entries,
            'prompt',
            requestedPrompt.id
          )
          const nextDestinationEntries = [...destinationEntryIds]
          nextDestinationEntries.splice(insertIndex, 0, promptEntryRef(requestedPrompt.id))
          const movedPrompt =
            !isSameFolder && prompt.committed.title.trim().length === 0
              ? {
                  ...prompt.committed,
                  fallbackTitle: resolvePromptTitleUpdateForPromptIds({
                    promptIds: destinationEntryIds
                      .filter((entry) => entry.kind === 'prompt')
                      .map((entry) => entry.id),
                    lookupPrompt: lookupCommittedPrompt,
                    promptId: requestedPrompt.id,
                    currentTitle: prompt.committed.title,
                    currentFallbackTitle: prompt.committed.fallbackTitle,
                    nextTitle: prompt.committed.title
                  }).fallbackTitle
                }
              : prompt.committed
          const movedPromptPersistenceFields: PromptPersistenceFields = isSameFolder
            ? prompt.persistenceFields
            : {
                ...prompt.persistenceFields,
                folderPath: destinationPromptFolder.persistenceFields.folderPath,
                previousFolderPath: sourcePromptFolder.persistenceFields.folderPath,
                promptFolderId: requestedDestinationPromptFolder.id
              }
          const filenamePlans = isSameFolder
            ? planPromptFilenamePersistenceFields(
                getPromptFolderPromptIdsByStatus(sourcePromptFolder.committed, false)
              )
            : [
                ...planPromptFilenamePersistenceFields(
                  getPromptFolderPromptIdsByStatus(sourcePromptFolder.committed, false).filter(
                    (promptId) => promptId !== requestedPrompt.id
                  )
                ),
                ...planPromptFilenamePersistenceFields(
                  [
                    ...getPromptFolderPromptIdsByStatus(
                      destinationPromptFolder.committed,
                      false
                    ),
                    requestedPrompt.id
                  ],
                  new Map([
                    [
                      requestedPrompt.id,
                      {
                        prompt: movedPrompt,
                        persistenceFields: movedPromptPersistenceFields
                      }
                    ]
                  ])
                )
              ]
          const transactionOutcome = isSameFolder
            ? await runAtomicDataTransaction((tx) => {
                return {
                  sourcePromptFolder: tx.promptFolder.update({
                    id: requestedSourcePromptFolder.id,
                    expectedRevision: requestedSourcePromptFolder.expectedRevision,
                    recipe: (draft) => {
                      draft.entries = nextDestinationEntries
                    }
                  }),
                  ...createPromptFilenameUpdateHandles(tx, filenamePlans, new Set())
                }
              })
            : await runAtomicDataTransaction((tx) => {
                return {
                  sourcePromptFolder: tx.promptFolder.update({
                    id: requestedSourcePromptFolder.id,
                    expectedRevision: requestedSourcePromptFolder.expectedRevision,
                    recipe: (draft) => {
                      draft.entries = nextSourceEntries
                    }
                  }),
                  destinationPromptFolder: tx.promptFolder.update({
                    id: requestedDestinationPromptFolder.id,
                    expectedRevision: requestedDestinationPromptFolder.expectedRevision,
                    recipe: (draft) => {
                      draft.entries = nextDestinationEntries
                    }
                  }),
                  prompt: tx.prompt.update({
                    id: requestedPrompt.id,
                    expectedRevision: requestedPrompt.expectedRevision,
                    recipe: (draft) => {
                      draft.fallbackTitle = movedPrompt.fallbackTitle
                    },
                    persistenceFields: getPlannedPromptPersistenceFields(
                      filenamePlans,
                      requestedPrompt.id
                    )
                  }),
                  ...createPromptFilenameUpdateHandles(
                    tx,
                    filenamePlans,
                    new Set([requestedPrompt.id])
                  )
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

  ipcMain.handle('set-prompt-status', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseSetPromptStatusRequest,
      async (validatedRequest) => {
        try {
          const requestedPromptFolder = validatedRequest.payload.promptFolder
          const requestedPrompt = validatedRequest.payload.prompt
          const targetStatus = validatedRequest.payload.status
          const promptFolder = data.promptFolder.committedStore.getEntry(requestedPromptFolder.id)
          const prompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!promptFolder || !prompt) {
            return { success: false, error: 'Prompt status data not loaded' }
          }

          const hasPromptEntry = promptFolder.committed.entries.some(
            (entry) => entry.kind === 'prompt' && entry.id === requestedPrompt.id
          )
          const isCompletedPrompt = prompt.committed.status === PromptStatus.Completed

          if (!hasPromptEntry) {
            return buildSetPromptStatusConflictResponse(
              requestedPromptFolder.id,
              requestedPrompt.id
            )
          }

          const now = getCurrentIsoSecondTimestamp()
          const { completedAt: _completedAt, ...activePromptBase } = requestedPrompt.data
          const targetPrompt: PromptPersisted =
            targetStatus === PromptStatus.Completed
              ? {
                  ...activePromptBase,
                  status: PromptStatus.Completed,
                  completedAt: now,
                  modifiedAt: now
                }
              : {
                  ...activePromptBase,
                  status: targetStatus,
                  modifiedAt: now
                }
          const activeFolderPath = promptFolder.persistenceFields.folderPath
          const completedFolderPath = resolveCompletedPromptFolderName(activeFolderPath)
          const persistenceFields =
            targetStatus === PromptStatus.Completed && !isCompletedPrompt
              ? {
                  ...prompt.persistenceFields,
                  folderPath: completedFolderPath,
                  previousFolderPath: activeFolderPath,
                  promptFolderId: requestedPromptFolder.id
                }
              : targetStatus !== PromptStatus.Completed && isCompletedPrompt
                ? {
                    ...prompt.persistenceFields,
                    folderPath: activeFolderPath,
                    previousFolderPath: completedFolderPath,
                    promptFolderId: requestedPromptFolder.id
                  }
                : prompt.persistenceFields
          const activePromptIds = getPromptFolderPromptIdsByStatus(
            promptFolder.committed,
            false
          ).filter((promptId) => promptId !== requestedPrompt.id)
          const completedPromptIds = getPromptFolderPromptIdsByStatus(
            promptFolder.committed,
            true
          ).filter((promptId) => promptId !== requestedPrompt.id)
          if (targetStatus === PromptStatus.Completed) completedPromptIds.push(requestedPrompt.id)
          else activePromptIds.push(requestedPrompt.id)
          const targetPromptOverride = new Map([
            [
              requestedPrompt.id,
              {
                prompt: targetPrompt,
                persistenceFields
              }
            ]
          ])
          const filenamePlans = [
            ...planPromptFilenamePersistenceFields(
              activePromptIds,
              targetStatus === PromptStatus.Completed ? undefined : targetPromptOverride
            ),
            ...planPromptFilenamePersistenceFields(
              completedPromptIds,
              targetStatus === PromptStatus.Completed ? targetPromptOverride : undefined
            )
          ]

          const transactionOutcome = await runAtomicDataTransaction((tx) => {
            return {
              prompt: tx.prompt.update({
                id: requestedPrompt.id,
                expectedRevision: requestedPrompt.expectedRevision,
                recipe: (draft) => {
                  Object.assign(draft, targetPrompt)
                  if (targetStatus !== PromptStatus.Completed) {
                    delete draft.completedAt
                  }
                },
                persistenceFields: getPlannedPromptPersistenceFields(
                  filenamePlans,
                  requestedPrompt.id
                )
              }),
              ...createPromptFilenameUpdateHandles(
                tx,
                filenamePlans,
                new Set([requestedPrompt.id])
              )
            }
          })

          if (transactionOutcome.status === 'conflict') {
            return buildSetPromptStatusConflictResponse(
              requestedPromptFolder.id,
              requestedPrompt.id
            )
          }

          const updatedPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )
          const updatedPrompt = data.prompt.committedStore.getEntry(requestedPrompt.id)

          if (!updatedPromptFolder || !updatedPrompt) {
            return { success: false, error: 'Prompt status commit did not complete' }
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
          return { success: false, error: message || 'Failed to set prompt status' }
        }
      }
    )
  })
}
