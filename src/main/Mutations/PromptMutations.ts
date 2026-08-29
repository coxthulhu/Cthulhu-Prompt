import { ipcMain } from 'electron'
import {
  PromptStatus,
  type PromptPersisted,
  type SetPromptStatusResponsePayload
} from '@shared/Prompt'
import {
  getActiveMarkdownContentIds,
  placeMarkdownContentInCategoryOrder
} from '@shared/MarkdownContent'
import { promptEntryRef } from '@shared/OrderContainer'
import type { PromptFolder } from '@shared/PromptFolder'
import { removeCategoryOrderEntry } from '@shared/PromptFolder'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import type { AtomicDataBuilder } from '../Data/AtomicDataTransaction'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildPromptFolderSnapshot, buildPromptSnapshot } from '../Data/DataSnapshotHelpers'
import { MarkdownContentUiStateDataAccess } from '../DataAccess/MarkdownContentUiStateDataAccess'
import {
  parseCreatePromptRequest,
  parseDeletePromptRequest,
  parseSetPromptStatusRequest,
  parseUpdatePromptRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import type { MarkdownPersistenceFields } from '../Persistence/MarkdownPersistence'
import {
  resolveActivePromptFolderName,
  resolveCompletedPromptFolderName
} from '../Persistence/PromptPersistencePaths'
import { setupMarkdownContentMutationHandlers } from './MarkdownContentMutations'
import {
  getPlannedMarkdownPersistenceFields,
  planMarkdownFilenamePersistenceFields,
  shouldUpdateMarkdownFilename,
  type MarkdownFilenameTarget
} from './MarkdownContentMutationHelpers'

type PromptFilenameTarget = MarkdownFilenameTarget<PromptPersisted, MarkdownPersistenceFields>

const getPromptFolderPromptIdsByStatus = (
  promptFolder: PromptFolder,
  completed: boolean
): string[] =>
  completed
    ? [...promptFolder.completedPromptIds]
    : getActiveMarkdownContentIds(promptFolder, 'prompt')

const planPromptFilenames = (
  promptIds: string[],
  overridesByPromptId?: Map<
    string,
    { content: PromptPersisted; persistenceFields: MarkdownPersistenceFields }
  >
): PromptFilenameTarget[] =>
  planMarkdownFilenamePersistenceFields({
    contentIds: promptIds,
    lookupContent: (promptId) => data.prompt.committedStore.getEntry(promptId),
    overridesByContentId: overridesByPromptId
  })

const createPromptFilenameUpdateHandles = (
  tx: AtomicDataBuilder,
  plans: PromptFilenameTarget[],
  excludedPromptIds: Set<string>
): Record<string, ReturnType<typeof tx.prompt.update>> => {
  const handles: Record<string, ReturnType<typeof tx.prompt.update>> = {}
  for (const plan of plans) {
    if (
      excludedPromptIds.has(plan.contentId) ||
      !shouldUpdateMarkdownFilename(plan, (promptId) =>
        data.prompt.committedStore.getEntry(promptId)
      )
    ) {
      continue
    }
    handles[`promptFilename:${plan.contentId}`] = tx.prompt.updatePersistenceFields({
      id: plan.contentId,
      persistenceFields: plan.persistenceFields
    })
  }
  return handles
}

const buildSetPromptStatusConflictResponse = (
  sourcePromptFolderId: string,
  rootPromptFolderId: string,
  promptId: string
):
  | { success: false; error: string }
  | { success: false; conflict: true; payload: SetPromptStatusResponsePayload } => {
  const promptFolders = [...new Set([sourcePromptFolderId, rootPromptFolderId])].flatMap(
    (promptFolderId) => {
      const promptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)
      return promptFolder ? [buildPromptFolderSnapshot(promptFolder)] : []
    }
  )
  const prompt = data.prompt.committedStore.getEntry(promptId)
  if (promptFolders.length !== new Set([sourcePromptFolderId, rootPromptFolderId]).size || !prompt) {
    return { success: false, error: 'Prompt status conflict data not loaded' }
  }
  return {
    success: false,
    conflict: true,
    payload: {
      promptFolders,
      prompt: buildPromptSnapshot(prompt)
    }
  }
}

const setupPromptStatusMutationHandler = (): void => {
  ipcMain.handle('set-prompt-status', async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseSetPromptStatusRequest,
      async (validatedRequest) => {
        try {
          const requestedSourcePromptFolder = validatedRequest.payload.sourcePromptFolder
          const requestedRootPromptFolder = validatedRequest.payload.rootPromptFolder
          const requestedPrompt = validatedRequest.payload.prompt
          const targetStatus = validatedRequest.payload.status
          const sourcePromptFolder = data.promptFolder.committedStore.getEntry(
            requestedSourcePromptFolder.id
          )
          const rootPromptFolder = data.promptFolder.committedStore.getEntry(
            requestedRootPromptFolder.id
          )
          const prompt = data.prompt.committedStore.getEntry(requestedPrompt.id)
          if (!sourcePromptFolder || !rootPromptFolder || !prompt) {
            return { success: false, error: 'Prompt status data not loaded' }
          }

          if (requestedSourcePromptFolder.id !== requestedRootPromptFolder.id) {
            return { success: false, error: 'Root prompt folder did not match' }
          }

          const hasActivePromptEntry = getActiveMarkdownContentIds(
            sourcePromptFolder.committed,
            'prompt'
          ).includes(requestedPrompt.id)
          const hasCompletedPromptEntry = rootPromptFolder.committed.completedPromptIds.includes(
            requestedPrompt.id
          )
          const isCompletedPrompt = prompt.committed.status === PromptStatus.Completed
          if (
            (isCompletedPrompt && !hasCompletedPromptEntry) ||
            (!isCompletedPrompt && !hasActivePromptEntry)
          ) {
            return buildSetPromptStatusConflictResponse(
              requestedSourcePromptFolder.id,
              requestedRootPromptFolder.id,
              requestedPrompt.id
            )
          }

          /** Requested category-order placement normalized to a group owned by the root folder. */
          const categoryOrderPlacement = rootPromptFolder.committed.categoryOrder.categories.some(
            (category) =>
              category.categoryId === validatedRequest.payload.categoryOrderPlacement.categoryId
          )
            ? validatedRequest.payload.categoryOrderPlacement
            : { categoryId: null, previousEntryId: null }
          const now = getCurrentIsoSecondTimestamp()
          const { completedAt: _completedAt, ...activePromptBase } = prompt.committed
          /** Prompt with its requested status fields before optional Active-tree placement. */
          const statusPrompt: PromptPersisted =
            targetStatus === PromptStatus.Completed
              ? {
                  ...activePromptBase,
                  status: PromptStatus.Completed,
                  completedAt: now,
                  modifiedAt: now
                }
              : { ...activePromptBase, status: targetStatus, modifiedAt: now }
          /** Category-order reference removed on completion and restored on activation. */
          const categoryOrderEntry = promptEntryRef(requestedPrompt.id)
          /** Prompt whose category metadata matches its Active-tree placement. */
          const targetPrompt =
            targetStatus === PromptStatus.Completed
              ? statusPrompt
              : placeMarkdownContentInCategoryOrder(
                  rootPromptFolder.committed.categoryOrder,
                  statusPrompt,
                  categoryOrderEntry,
                  categoryOrderPlacement.categoryId,
                  categoryOrderPlacement.previousEntryId
                ).content
          const sourcePromptFolderPath = sourcePromptFolder.persistenceFields.folderPath
          const rootPromptFolderPath = rootPromptFolder.persistenceFields.folderPath
          const activeFolderPath = resolveActivePromptFolderName(
            sourcePromptFolderPath,
            sourcePromptFolder.committed.kind
          )
          const completedFolderPath = resolveCompletedPromptFolderName(
            rootPromptFolderPath,
            rootPromptFolder.committed.kind
          )
          const persistenceFields =
            targetStatus === PromptStatus.Completed && !isCompletedPrompt
              ? {
                  ...prompt.persistenceFields,
                  folderPath: completedFolderPath,
                  previousFolderPath: activeFolderPath,
                  promptFolderId: requestedRootPromptFolder.id
                }
              : targetStatus !== PromptStatus.Completed && isCompletedPrompt
                ? {
                    ...prompt.persistenceFields,
                    folderPath: activeFolderPath,
                    previousFolderPath: completedFolderPath,
                    promptFolderId: requestedRootPromptFolder.id
                  }
                : prompt.persistenceFields
          /** Existing completed IDs excluding the prompt currently changing status. */
          const remainingCompletedPromptIds = getPromptFolderPromptIdsByStatus(
            rootPromptFolder.committed,
            true
          ).filter((promptId) => promptId !== requestedPrompt.id)
          /** Completed IDs ordered newest-first to break equal completion-timestamp ties. */
          const completedPromptIds =
            targetStatus === PromptStatus.Completed
              ? [requestedPrompt.id, ...remainingCompletedPromptIds]
              : remainingCompletedPromptIds
          /** Active prompt IDs after the requested status transition. */
          const currentActivePromptIds = getActiveMarkdownContentIds(
            rootPromptFolder.committed,
            'prompt'
          )
          const activePromptIds =
            targetStatus === PromptStatus.Completed
              ? currentActivePromptIds.filter((promptId) => promptId !== requestedPrompt.id)
              : isCompletedPrompt
                ? [requestedPrompt.id, ...currentActivePromptIds]
                : currentActivePromptIds
          const targetPromptOverride = new Map([
            [requestedPrompt.id, { content: targetPrompt, persistenceFields }]
          ])
          const filenamePlans = [
            ...planPromptFilenames(
              activePromptIds,
              targetStatus === PromptStatus.Completed ? undefined : targetPromptOverride
            ),
            ...planPromptFilenames(
              completedPromptIds,
              targetStatus === PromptStatus.Completed ? targetPromptOverride : undefined
            )
          ]

          const outcome = (await runAtomicDataTransaction((tx) => ({
            sourcePromptFolder: tx.promptFolder.update({
              id: requestedSourcePromptFolder.id,
              expectedRevision: requestedSourcePromptFolder.expectedRevision,
              recipe: (draft) => {
                draft.completedPromptIds = completedPromptIds
                if (targetStatus === PromptStatus.Completed) {
                  draft.categoryOrder = removeCategoryOrderEntry(
                    draft.categoryOrder,
                    categoryOrderEntry
                  )
                } else if (isCompletedPrompt) {
                  draft.categoryOrder = placeMarkdownContentInCategoryOrder(
                    draft.categoryOrder,
                    targetPrompt,
                    categoryOrderEntry,
                    categoryOrderPlacement.categoryId,
                    categoryOrderPlacement.previousEntryId
                  ).categoryOrder
                }
              }
            }),
            prompt: tx.prompt.update({
              id: requestedPrompt.id,
              expectedRevision: requestedPrompt.expectedRevision,
              recipe: (draft) => {
                Object.assign(draft, targetPrompt)
                if (targetStatus !== PromptStatus.Completed) delete draft.completedAt
                if (targetPrompt.templates === undefined) delete draft.templates
              },
              persistenceFields: getPlannedMarkdownPersistenceFields(
                filenamePlans,
                requestedPrompt.id
              )
            }),
            ...createPromptFilenameUpdateHandles(
              tx,
              filenamePlans,
              new Set([requestedPrompt.id])
            )
          })))!
          if (outcome.status === 'conflict') {
            return buildSetPromptStatusConflictResponse(
              requestedSourcePromptFolder.id,
              requestedRootPromptFolder.id,
              requestedPrompt.id
            )
          }

          const updatedPromptFolders = [
            ...new Set([requestedSourcePromptFolder.id, requestedRootPromptFolder.id])
          ].flatMap((promptFolderId) => {
            const promptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)
            return promptFolder ? [buildPromptFolderSnapshot(promptFolder)] : []
          })
          const updatedPrompt = data.prompt.committedStore.getEntry(requestedPrompt.id)
          if (
            updatedPromptFolders.length !==
              new Set([requestedSourcePromptFolder.id, requestedRootPromptFolder.id]).size ||
            !updatedPrompt
          ) {
            return { success: false, error: 'Prompt status commit did not complete' }
          }
          return {
            success: true,
            payload: {
              promptFolders: updatedPromptFolders,
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

export const setupPromptMutationHandlers = (): void => {
  setupMarkdownContentMutationHandlers<PromptPersisted>({
    kind: 'prompt',
    label: 'Prompt',
    channels: {
      create: 'create-prompt',
      update: 'update-prompt',
      delete: 'delete-prompt',
      move: 'move-prompt'
    },
    parsers: {
      create: parseCreatePromptRequest,
      update: parseUpdatePromptRevisionRequest,
      delete: parseDeletePromptRequest
    },
    getContent: (promptId) => data.prompt.committedStore.getEntry(promptId),
    buildSnapshot: buildPromptSnapshot,
    createEntryRef: promptEntryRef,
    createPersisted: (requested, titleFields, now) => ({
      id: requested.id,
      ...titleFields,
      createdAt: now,
      modifiedAt: now,
      status: PromptStatus.Todo,
      promptText: requested.promptText,
      ...(requested.category !== undefined ? { category: requested.category } : {}),
      ...(requested.templates !== undefined ? { templates: requested.templates } : {})
    }),
    updatePersisted: (requested, _current, titleFields) => ({
      id: requested.id,
      ...titleFields,
      createdAt: requested.createdAt,
      modifiedAt: requested.modifiedAt,
      promptText: requested.promptText,
      ...(requested.category !== undefined ? { category: requested.category } : {}),
      ...(requested.templates !== undefined ? { templates: requested.templates } : {}),
      status: requested.status,
      ...(requested.status === PromptStatus.Completed && requested.completedAt
        ? { completedAt: requested.completedAt }
        : {})
    }),
    canMove: (prompt) => prompt.status !== PromptStatus.Completed,
    createContent: (tx, operation) =>
      tx.prompt.create({
        id: operation.id,
        data: operation.data,
        persistenceFields: operation.persistenceFields
      }),
    updateContent: (tx, operation) =>
      tx.prompt.update({
        id: operation.id,
        expectedRevision: operation.expectedRevision,
        recipe: (draft) => {
          Object.assign(draft, operation.data)
          if (!operation.data.completedAt) delete draft.completedAt
          if (operation.data.templates === undefined) delete draft.templates
          if (operation.data.category === undefined) delete draft.category
        },
        persistenceFields: operation.persistenceFields
      }),
    updateFilename: (tx, promptId, persistenceFields) =>
      tx.prompt.updatePersistenceFields({ id: promptId, persistenceFields }),
    deleteContent: (tx, promptId, expectedRevision) =>
      tx.prompt.delete({ id: promptId, expectedRevision }),
    onDeleted: (workspaceId, promptId) => {
      // Side effect: remove persisted Monaco view state for deleted prompts.
      MarkdownContentUiStateDataAccess.deleteMarkdownContentUiState(workspaceId, promptId)
    }
  })
  setupPromptStatusMutationHandler()
}
