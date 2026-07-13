import { resolvePromptTitleUpdateForPromptIds } from '@shared/promptFallbackTitle'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import {
  createPromptFull,
  isPromptFull,
  type CreatePromptPayload,
  type CreatePromptResponsePayload,
  type DeletePromptPayload,
  type DeletePromptResponsePayload,
  type MovePromptPayload,
  type MovePromptResponsePayload,
  type Prompt,
  type PromptFull,
  type PromptPersisted,
  type PromptRevisionResponsePayload,
  type PromptRevisionPayload,
  PromptStatus,
  type SetPromptStatusPayload,
  type SetPromptStatusResponsePayload
} from '@shared/Prompt'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import { promptEntryRef, removeEntry, type EntryRef } from '@shared/OrderContainer'
import type { Transaction } from '@tanstack/svelte-db'
import { promptDraftCollection } from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getPromptFolderPromptIds } from '../Collections/PromptFolderEntries'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from '../IpcFramework/RevisionCollections'

const toPersistedPrompt = (prompt: Prompt): PromptPersisted => {
  if (!isPromptFull(prompt)) {
    throw new Error('Prompt not fully loaded')
  }

  return {
    id: prompt.id,
    title: prompt.title,
    fallbackTitle: prompt.fallbackTitle,
    createdAt: prompt.createdAt,
    modifiedAt: prompt.modifiedAt,
    promptText: prompt.promptText,
    status: prompt.status,
    ...(prompt.status === PromptStatus.Completed && prompt.completedAt
      ? { completedAt: prompt.completedAt }
      : {})
  }
}

const toFullPromptSnapshot = (snapshot: {
  id: string
  revision: number
  data: PromptPersisted
}) => {
  return {
    ...snapshot,
    data: createPromptFull(snapshot.data)
  }
}

const upsertPromptDraftFromPrompt = (prompt: PromptFull): void => {
  const promptDraft = {
    id: prompt.id,
    title: prompt.title,
    fallbackTitle: prompt.fallbackTitle,
    createdAt: prompt.createdAt,
    modifiedAt: prompt.modifiedAt,
    promptText: prompt.promptText
  }

  if (!promptDraftCollection.get(prompt.id)) {
    promptDraftCollection.insert(promptDraft)
    return
  }

  promptDraftCollection.update(prompt.id, (draft) => {
    Object.assign(draft, promptDraft)
  })
}

const readLatestPromptFromTransaction = (
  transaction: Transaction<any>,
  promptId: string
): PromptPersisted => {
  const prompt = getLatestMutationModifiedRecord(
    transaction,
    promptCollection.id,
    promptId,
    () => promptCollection.get(promptId)!
  )

  return toPersistedPrompt(prompt)
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

export const createPrompt = async (
  promptFolderId: string,
  prompt: PromptFull,
  previousEntryId: string | null
): Promise<void> => {
  const promptFolder = promptFolderCollection.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  await runRevisionMutation<CreatePromptResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      const promptTitleFields = resolvePromptTitleUpdateForPromptIds({
        promptIds: getPromptFolderPromptIds(promptFolder),
        lookupPrompt: (currentPromptId) => promptCollection.get(currentPromptId),
        promptId: prompt.id,
        currentFallbackTitle: prompt.fallbackTitle,
        nextTitle: prompt.title
      })
      const optimisticPrompt = {
        ...prompt,
        title: promptTitleFields.title,
        fallbackTitle: promptTitleFields.fallbackTitle
      }

      collections.prompt.insert(optimisticPrompt)
      collections.promptDraft.insert(optimisticPrompt)

      collections.promptFolder.update(promptFolderId, (draft) => {
        let insertIndex = draft.entries.length

        if (previousEntryId === null) {
          insertIndex = 0
        } else {
          const previousIndex = draft.entries.findIndex(
            (entry) => entry.id === previousEntryId
          )
          if (previousIndex !== -1) {
            insertIndex = previousIndex + 1
          }
        }

        const entries = [...draft.entries]
        entries.splice(insertIndex, 0, promptEntryRef(prompt.id))
        draft.entries = entries
      })
    },
    persistMutations: async ({ entities, transaction }) => {
      const promptEntity = entities.prompt({
        id: prompt.id,
        data: prompt
      })
      const mutationResult = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<CreatePromptResponsePayload>,
        CreatePromptPayload
      >('create-prompt', {
        promptFolder: entities.promptFolder({
          id: promptFolderId,
          data: promptFolder
        }),
        prompt: {
          ...promptEntity,
          data: toPersistedPrompt(promptEntity.data)
        },
        previousEntryId
      })

      if (mutationResult.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)

      if (!payload.prompt) {
        return
      }

      const promptSnapshot = toFullPromptSnapshot(payload.prompt)
      promptCollection.utils.upsertAuthoritative(promptSnapshot)
      upsertPromptDraftFromPrompt(promptSnapshot.data)
    },
    conflictMessage: 'Prompt create conflict'
  })
}

type PacedPromptMutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<PromptRevisionResponsePayload>
>[0]

type PacedPromptAutosaveUpdateOptions = Pick<
  PacedPromptMutationOptions,
  'debounceMs' | 'mutateOptimistically'
> & {
  promptId: string
}

export const mutatePacedPromptAutosaveUpdate = ({
  promptId,
  debounceMs,
  mutateOptimistically
}: PacedPromptAutosaveUpdateOptions): void => {
  mutatePacedRevisionUpdateTransaction<PromptRevisionResponsePayload>({
    collectionId: promptCollection.id,
    elementId: promptId,
    debounceMs,
    mutateOptimistically,
    persistMutations: async ({ entities, transaction }) => {
      const latestPrompt = readLatestPromptFromTransaction(transaction, promptId)
      const promptEntity = entities.prompt({
        id: promptId,
        data: createPromptFull(latestPrompt)
      })
      const mutationResult = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<PromptRevisionResponsePayload>,
        PromptRevisionPayload
      >('update-prompt', {
        prompt: {
          ...promptEntity,
          data: toPersistedPrompt(promptEntity.data)
        }
      })

      if (mutationResult.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      const promptSnapshot = toFullPromptSnapshot(payload.prompt)
      if (payload.promptFolder) {
        promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
      }
      promptCollection.utils.upsertAuthoritative(promptSnapshot)
      upsertPromptDraftFromPrompt(promptSnapshot.data)
    },
    conflictMessage: 'Prompt update conflict'
  })
}

export const deletePrompt = async (promptFolderId: string, promptId: string): Promise<void> => {
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  const prompt = promptCollection.get(promptId)
  if (!prompt) {
    throw new Error('Prompt not loaded')
  }

  const persistedPrompt = toPersistedPrompt(prompt)
  await runRevisionMutation<DeletePromptResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.prompt.delete(promptId)
      collections.promptDraft.delete(promptId)
      collections.promptFolder.update(promptFolderId, (draft) => {
        draft.entries = removeEntry(draft.entries, 'prompt', promptId)
        draft.completedPromptIds = draft.completedPromptIds.filter(
          (currentPromptId) => currentPromptId !== promptId
        )
      })
    },
    persistMutations: async ({ entities, transaction }) => {
      const promptEntity = entities.prompt({
        id: promptId,
        data: createPromptFull(persistedPrompt)
      })
      const mutationResult = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<DeletePromptResponsePayload>,
        DeletePromptPayload
      >('delete-prompt', {
        promptFolder: entities.promptFolder({
          id: promptFolderId,
          data: promptFolder
        }),
        prompt: {
          ...promptEntity,
          data: toPersistedPrompt(promptEntity.data)
        }
      })

      if (mutationResult.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt delete conflict',
    onSuccess: () => {
      // Side effect: clear the prompt revision cache after the delete commit succeeds.
      promptCollection.utils.deleteAuthoritative(promptId)
    }
  })
}

export const setPromptStatus = async (
  promptFolderId: string,
  promptId: string,
  targetStatus: PromptStatus
): Promise<void> => {
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  const prompt = promptCollection.get(promptId)
  const isCompletedPrompt = prompt?.status === PromptStatus.Completed
  const promptDraft = promptDraftCollection.get(promptId)
  if (!promptDraft) {
    throw new Error('Prompt draft not loaded')
  }

  const currentPrompt =
    prompt && isPromptFull(prompt)
      ? toPersistedPrompt(prompt)
      : {
          id: promptDraft.id,
          title: promptDraft.title,
          fallbackTitle: promptDraft.fallbackTitle,
          createdAt: promptDraft.createdAt,
          modifiedAt: promptDraft.modifiedAt,
          status: PromptStatus.Todo,
          promptText: promptDraft.promptText
        }
  const modifiedAt = getCurrentIsoSecondTimestamp()
  const { completedAt: _completedAt, ...activePromptBase } = currentPrompt
  const nextPrompt: PromptPersisted =
    targetStatus === PromptStatus.Completed
      ? {
          ...activePromptBase,
          title: promptDraft.title,
          fallbackTitle: promptDraft.fallbackTitle,
          promptText: promptDraft.promptText,
          status: PromptStatus.Completed,
          completedAt: modifiedAt,
          modifiedAt
        }
      : {
          ...activePromptBase,
          title: promptDraft.title,
          fallbackTitle: promptDraft.fallbackTitle,
          promptText: promptDraft.promptText,
          status: targetStatus,
          modifiedAt
        }
  await runRevisionMutation<SetPromptStatusResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.prompt.update(promptId, (draft) => {
        if (draft.loadingState === 'full') {
          Object.assign(draft, nextPrompt)
          if (targetStatus !== PromptStatus.Completed) {
            delete draft.completedAt
          }
        }
      })
      collections.promptDraft.update(promptId, (draft) => {
        draft.title = nextPrompt.title
        draft.fallbackTitle = nextPrompt.fallbackTitle
        draft.createdAt = nextPrompt.createdAt
        draft.modifiedAt = nextPrompt.modifiedAt
        draft.promptText = nextPrompt.promptText
      })
      collections.promptFolder.update(promptFolderId, (draft) => {
        if (targetStatus === PromptStatus.Completed) {
          draft.entries = removeEntry(draft.entries, 'prompt', promptId)
          if (!draft.completedPromptIds.includes(promptId)) {
            draft.completedPromptIds = [...draft.completedPromptIds, promptId]
          }
          return
        }

        draft.completedPromptIds = draft.completedPromptIds.filter(
          (currentPromptId) => currentPromptId !== promptId
        )
        if (isCompletedPrompt) {
          draft.entries = [promptEntryRef(promptId), ...draft.entries]
        }
      })
    },
    persistMutations: async ({ entities, transaction }) => {
      const promptEntity = entities.prompt({
        id: promptId,
        data: createPromptFull(nextPrompt)
      })
      const mutationResult = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<SetPromptStatusResponsePayload>,
        SetPromptStatusPayload
      >('set-prompt-status', {
        promptFolder: entities.promptFolder({
          id: promptFolderId,
          data: promptFolder
        }),
        prompt: {
          ...promptEntity,
          data: toPersistedPrompt(promptEntity.data)
        },
        status: targetStatus
      })

      if (mutationResult.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
      const promptSnapshot = toFullPromptSnapshot(payload.prompt)
      promptCollection.utils.upsertAuthoritative(promptSnapshot)
      upsertPromptDraftFromPrompt(promptSnapshot.data)
    },
    conflictMessage: 'Prompt status conflict'
  })
}

export const movePrompt = async (
  sourcePromptFolderId: string,
  destinationPromptFolderId: string,
  promptId: string,
  previousEntryId: string | null
): Promise<void> => {
  const sourcePromptFolder = promptFolderCollection.get(sourcePromptFolderId)
  if (!sourcePromptFolder) {
    throw new Error('Source prompt folder not loaded')
  }

  const destinationPromptFolder = promptFolderCollection.get(destinationPromptFolderId)
  if (!destinationPromptFolder) {
    throw new Error('Destination prompt folder not loaded')
  }

  const prompt = promptCollection.get(promptId)
  const promptDraft = promptDraftCollection.get(promptId)
  const persistedPrompt =
    prompt && isPromptFull(prompt)
      ? toPersistedPrompt(prompt)
      : promptDraft
        ? {
            id: promptDraft.id,
            title: promptDraft.title,
            fallbackTitle: promptDraft.fallbackTitle,
            createdAt: promptDraft.createdAt,
            modifiedAt: promptDraft.modifiedAt,
            status: PromptStatus.Todo,
            promptText: promptDraft.promptText
          }
        : null
  if (!persistedPrompt) {
    throw new Error('Prompt data not loaded')
  }
  const isSameFolder = sourcePromptFolderId === destinationPromptFolderId
  const destinationEntries = isSameFolder
    ? removeEntry(sourcePromptFolder.entries, 'prompt', promptId)
    : destinationPromptFolder.entries
  const destinationPromptIds = isSameFolder
    ? getPromptFolderPromptIds(sourcePromptFolder).filter(
        (currentPromptId) => currentPromptId !== promptId
      )
    : getPromptFolderPromptIds(destinationPromptFolder)
  const insertIndex = resolvePromptInsertIndex(destinationEntries, previousEntryId)

  if (insertIndex === null) {
    throw new Error('Order-after entry not found')
  }
  await runRevisionMutation<MovePromptResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      if (isSameFolder) {
        collections.promptFolder.update(sourcePromptFolderId, (draft) => {
          // Resolve the insert index after removing the moved prompt so a downward
          // move is not offset by the prompt's own vacated slot.
          const entries = removeEntry(draft.entries, 'prompt', promptId)
          const targetIndex =
            previousEntryId === null
              ? 0
              : entries.findIndex((entry) => entry.id === previousEntryId) + 1
          entries.splice(targetIndex, 0, promptEntryRef(promptId))
          draft.entries = entries
        })
        return
      }

      collections.promptFolder.update(sourcePromptFolderId, (draft) => {
        draft.entries = removeEntry(draft.entries, 'prompt', promptId)
      })
      collections.promptFolder.update(destinationPromptFolderId, (draft) => {
        const targetIndex =
          previousEntryId === null
            ? 0
            : draft.entries.findIndex((entry) => entry.id === previousEntryId) + 1
        const entries = [...draft.entries]
        entries.splice(targetIndex, 0, promptEntryRef(promptId))
        draft.entries = entries
      })
      collections.prompt.update(promptId, (draft) => {
        if (draft.title.trim().length === 0) {
          draft.fallbackTitle = resolvePromptTitleUpdateForPromptIds({
            promptIds: destinationPromptIds,
            lookupPrompt: (currentPromptId) => promptCollection.get(currentPromptId),
            promptId,
            currentTitle: draft.title,
            currentFallbackTitle: draft.fallbackTitle,
            nextTitle: draft.title
          }).fallbackTitle
        }
      })
      collections.promptDraft.update(promptId, (draft) => {
        if (draft.title.trim().length === 0) {
          draft.fallbackTitle = resolvePromptTitleUpdateForPromptIds({
            promptIds: destinationPromptIds,
            lookupPrompt: (currentPromptId) => promptCollection.get(currentPromptId),
            promptId,
            currentTitle: draft.title,
            currentFallbackTitle: draft.fallbackTitle,
            nextTitle: draft.title
          }).fallbackTitle
        }
      })
    },
    persistMutations: async ({ entities, transaction }) => {
      const promptEntity = entities.prompt({
        id: promptId,
        data: createPromptFull(persistedPrompt)
      })
      const mutationResult = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<MovePromptResponsePayload>,
        MovePromptPayload
      >('move-prompt', {
        sourcePromptFolder: entities.promptFolder({
          id: sourcePromptFolderId,
          data: sourcePromptFolder
        }),
        destinationPromptFolder: entities.promptFolder({
          id: destinationPromptFolderId,
          data: destinationPromptFolder
        }),
        prompt: {
          ...promptEntity,
          data: toPersistedPrompt(promptEntity.data)
        },
        previousEntryId
      })

      if (mutationResult.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.sourcePromptFolder)
      promptFolderCollection.utils.upsertAuthoritative(payload.destinationPromptFolder)
      const promptSnapshot = toFullPromptSnapshot(payload.prompt)
      promptCollection.utils.upsertAuthoritative(promptSnapshot)
      upsertPromptDraftFromPrompt(promptSnapshot.data)
    },
    conflictMessage: 'Prompt move conflict'
  })
}
