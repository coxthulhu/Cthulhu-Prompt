import { ipcMain } from 'electron'
import {
  PromptStatus,
  type PromptPersisted,
  type SetPromptStatusResponsePayload
} from '@shared/Prompt'
import { getActiveMarkdownContentIds } from '@shared/MarkdownContent'
import { promptEntryRef, removeEntry } from '@shared/OrderContainer'
import type { PromptFolder } from '@shared/PromptFolder'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import type { AtomicDataBuilder } from '../Data/AtomicDataTransaction'
import { runAtomicDataTransaction } from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'
import { buildPromptFolderSnapshot, buildPromptSnapshot } from '../Data/DataSnapshotHelpers'
import { PromptUiStateDataAccess } from '../DataAccess/PromptUiStateDataAccess'
import {
  parseCreatePromptRequest,
  parseDeletePromptRequest,
  parseMovePromptRequest,
  parseSetPromptStatusRequest,
  parseUpdatePromptRevisionRequest
} from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import type { MarkdownPersistenceFields } from '../Persistence/MarkdownPersistence'
import { resolveCompletedPromptFolderName } from '../Persistence/PromptPersistencePaths'
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
    handles[`promptFilename:${plan.contentId}`] = tx.prompt.update({
      id: plan.contentId,
      recipe: () => {},
      persistenceFields: plan.persistenceFields
    })
  }
  return handles
}

const buildSetPromptStatusConflictResponse = (
  promptFolderId: string,
  promptId: string
):
  | { success: false; error: string }
  | { success: false; conflict: true; payload: SetPromptStatusResponsePayload } => {
  const promptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)
  const prompt = data.prompt.committedStore.getEntry(promptId)
  if (!promptFolder || !prompt) {
    return { success: false, error: 'Prompt status conflict data not loaded' }
  }
  return {
    success: false,
    conflict: true,
    payload: {
      promptFolder: buildPromptFolderSnapshot(promptFolder),
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
          const requestedPromptFolder = validatedRequest.payload.promptFolder
          const requestedPrompt = validatedRequest.payload.prompt
          const targetStatus = validatedRequest.payload.status
          const promptFolder = data.promptFolder.committedStore.getEntry(requestedPromptFolder.id)
          const prompt = data.prompt.committedStore.getEntry(requestedPrompt.id)
          if (!promptFolder || !prompt) {
            return { success: false, error: 'Prompt status data not loaded' }
          }

          const hasActivePromptEntry = getActiveMarkdownContentIds(
            promptFolder.committed,
            'prompt'
          ).includes(requestedPrompt.id)
          const hasCompletedPromptEntry = promptFolder.committed.completedPromptIds.includes(
            requestedPrompt.id
          )
          const isCompletedPrompt = prompt.committed.status === PromptStatus.Completed
          if (
            (isCompletedPrompt && !hasCompletedPromptEntry) ||
            (!isCompletedPrompt && !hasActivePromptEntry)
          ) {
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
              : { ...activePromptBase, status: targetStatus, modifiedAt: now }
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
          const completedPromptIds = getPromptFolderPromptIdsByStatus(
            promptFolder.committed,
            true
          ).filter((promptId) => promptId !== requestedPrompt.id)
          if (targetStatus === PromptStatus.Completed) completedPromptIds.push(requestedPrompt.id)
          const nextEntries =
            targetStatus === PromptStatus.Completed
              ? removeEntry(promptFolder.committed.entries, 'prompt', requestedPrompt.id)
              : isCompletedPrompt
                ? [promptEntryRef(requestedPrompt.id), ...promptFolder.committed.entries]
                : promptFolder.committed.entries
          const activePromptIds = nextEntries.flatMap((entry) =>
            entry.kind === 'prompt' ? [entry.id] : []
          )
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

          const outcome = await runAtomicDataTransaction((tx) => ({
            promptFolder: tx.promptFolder.update({
              id: requestedPromptFolder.id,
              expectedRevision: requestedPromptFolder.expectedRevision,
              recipe: (draft) => {
                draft.entries = nextEntries
                draft.completedPromptIds = completedPromptIds
              }
            }),
            prompt: tx.prompt.update({
              id: requestedPrompt.id,
              expectedRevision: requestedPrompt.expectedRevision,
              recipe: (draft) => {
                Object.assign(draft, targetPrompt)
                if (targetStatus !== PromptStatus.Completed) delete draft.completedAt
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
          }))
          if (outcome.status === 'conflict') {
            return buildSetPromptStatusConflictResponse(
              requestedPromptFolder.id,
              requestedPrompt.id
            )
          }

          const updatedFolder = data.promptFolder.committedStore.getEntry(
            requestedPromptFolder.id
          )
          const updatedPrompt = data.prompt.committedStore.getEntry(requestedPrompt.id)
          if (!updatedFolder || !updatedPrompt) {
            return { success: false, error: 'Prompt status commit did not complete' }
          }
          return {
            success: true,
            payload: {
              promptFolder: buildPromptFolderSnapshot(updatedFolder),
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
      delete: parseDeletePromptRequest,
      move: parseMovePromptRequest
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
      promptText: requested.promptText
    }),
    updatePersisted: (requested, _current, titleFields) => ({
      id: requested.id,
      ...titleFields,
      createdAt: requested.createdAt,
      modifiedAt: requested.modifiedAt,
      promptText: requested.promptText,
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
        },
        persistenceFields: operation.persistenceFields
      }),
    updateFilename: (tx, promptId, persistenceFields) =>
      tx.prompt.update({ id: promptId, recipe: () => {}, persistenceFields }),
    deleteContent: (tx, promptId, expectedRevision) =>
      tx.prompt.delete({ id: promptId, expectedRevision }),
    onDeleted: (workspaceId, promptId) => {
      // Side effect: remove persisted Monaco view state for deleted prompts.
      PromptUiStateDataAccess.deletePromptUiState(workspaceId, promptId)
    }
  })
  setupPromptStatusMutationHandler()
}
