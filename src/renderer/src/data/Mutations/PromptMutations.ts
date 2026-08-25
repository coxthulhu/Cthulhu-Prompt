import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import { placeMarkdownContentInCategoryOrder } from '@shared/MarkdownContent'
import { promptEntryRef } from '@shared/OrderContainer'
import { removeCategoryOrderEntry } from '@shared/PromptFolder'
import {
  createPromptFull,
  isPromptFull,
  PromptStatus,
  type PromptCategoryOrderPlacement,
  type PromptFull,
  type PromptPersisted,
  type SetPromptStatusPayload,
  type SetPromptStatusResponsePayload
} from '@shared/Prompt'
import { promptCollection } from '../Collections/PromptCollection'
import {
  markPromptDraftEdited,
  promptDraftCollection
} from '../Collections/PromptDraftCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'
import { upsertPromptDraft } from '../UiState/PromptDraftHydration'
import { createMarkdownContentRendererMutations } from './MarkdownContentMutations'

const toPersisted = (prompt: PromptFull): PromptPersisted => ({
  id: prompt.id,
  title: prompt.title,
  fallbackTitle: prompt.fallbackTitle,
  createdAt: prompt.createdAt,
  modifiedAt: prompt.modifiedAt,
  ...(prompt.category !== undefined ? { category: prompt.category } : {}),
  promptText: prompt.promptText,
  ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
  status: prompt.status,
  ...(prompt.status === PromptStatus.Completed && prompt.completedAt
    ? { completedAt: prompt.completedAt }
    : {})
})

const reconcilePrompt = (snapshot: {
  id: string
  revision: number
  data: PromptPersisted
}): void => {
  const fullSnapshot = { ...snapshot, data: createPromptFull(snapshot.data) }
  promptCollection.utils.upsertAuthoritative(fullSnapshot)
  upsertPromptDraft(fullSnapshot.data)
}

const mutations = createMarkdownContentRendererMutations<PromptPersisted, PromptFull>({
  kind: 'prompt',
  label: 'Prompt',
  collectionId: promptCollection.id,
  channels: {
    create: 'create-prompt',
    update: 'update-prompt',
    delete: 'delete-prompt',
    move: 'move-prompt'
  },
  createEntryRef: promptEntryRef,
  getContent: (promptId) => promptCollection.get(promptId),
  getFullPersisted: (promptId) => {
    const prompt = promptCollection.get(promptId)
    return prompt && isPromptFull(prompt) ? toPersisted(prompt) : null
  },
  getDraftPersisted: (promptId) => {
    const draft = promptDraftCollection.get(promptId)
    return draft
      ? {
          id: draft.id,
          title: draft.title,
          fallbackTitle: draft.fallbackTitle,
          createdAt: draft.createdAt,
          modifiedAt: draft.modifiedAt,
          ...(draft.category !== undefined ? { category: draft.category } : {}),
          promptText: draft.promptText,
          ...(draft.templates !== undefined ? { templates: draft.templates } : {}),
          status: PromptStatus.Todo
        }
      : null
  },
  toPersisted,
  createEntity: (entities, promptId, prompt) => {
    const entity = entities.prompt({ id: promptId, data: createPromptFull(prompt) })
    return { ...entity, data: prompt }
  },
  insertOptimistically: (collections, prompt) => {
    collections.prompt.insert(prompt)
    collections.promptDraft.insert(
      markPromptDraftEdited({
        id: prompt.id,
        title: prompt.title,
        fallbackTitle: prompt.fallbackTitle,
        createdAt: prompt.createdAt,
        modifiedAt: prompt.modifiedAt,
        ...(prompt.category !== undefined ? { category: prompt.category } : {}),
        promptText: prompt.promptText,
        ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
        isEdited: false
      })
    )
  },
  deleteOptimistically: (collections, promptId) => {
    collections.prompt.delete(promptId)
    collections.promptDraft.delete(promptId)
  },
  updateContentOptimistically: (collections, promptId, update) => {
    collections.prompt.update(promptId, update)
    collections.promptDraft.update(promptId, (draft) => {
      update(draft)
      markPromptDraftEdited(draft)
    })
  },
  acceptDraftMutations: (transaction) => promptDraftCollection.utils.acceptMutations(transaction),
  reconcile: reconcilePrompt,
  deleteAuthoritative: (promptId) => promptCollection.utils.deleteAuthoritative(promptId)
})

export const createPrompt = mutations.create
export const mutatePacedPromptAutosaveUpdate = (
  options: Omit<Parameters<typeof mutations.mutatePacedAutosaveUpdate>[0], 'contentId'> & {
    promptId: string
  }
): void => {
  const { promptId, ...mutationOptions } = options
  mutations.mutatePacedAutosaveUpdate({ contentId: promptId, ...mutationOptions })
}
export const deletePrompt = mutations.delete
export const movePrompt = mutations.move

/** Changes prompt status and optionally restores it at an exact category-order placement. */
export const setPromptStatus = async (
  promptFolderId: string,
  rootPromptFolderId: string,
  promptId: string,
  targetStatus: PromptStatus,
  requestedCategoryOrderPlacement?: PromptCategoryOrderPlacement
): Promise<void> => {
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!promptFolder || promptFolder.kind === 'template') {
    throw new Error('Prompt folder not loaded')
  }
  const rootPromptFolder = promptFolderCollection.get(rootPromptFolderId)
  if (!rootPromptFolder || rootPromptFolder.kind === 'template') {
    throw new Error('Root prompt folder not loaded')
  }
  const prompt = promptCollection.get(promptId)
  const isCompletedPrompt = prompt?.status === PromptStatus.Completed
  const promptDraft = promptDraftCollection.get(promptId)
  if (!promptDraft) throw new Error('Prompt draft not loaded')

  const currentPrompt =
    prompt && isPromptFull(prompt)
      ? toPersisted(prompt)
      : {
          id: promptDraft.id,
          title: promptDraft.title,
          fallbackTitle: promptDraft.fallbackTitle,
          createdAt: promptDraft.createdAt,
          modifiedAt: promptDraft.modifiedAt,
          status: PromptStatus.Todo,
          promptText: promptDraft.promptText,
          ...(promptDraft.category !== undefined ? { category: promptDraft.category } : {}),
          ...(promptDraft.templates !== undefined
            ? { templates: promptDraft.templates }
            : {})
        }
  /** Current Active-tree group used when a status-button change does not request a new placement. */
  const currentCategoryGroup = rootPromptFolder.categoryOrder.categories.find((group) =>
    group.entries.some((entry) => entry.kind === 'prompt' && entry.id === promptId)
  )
  /** Current prompt index used to retain its exact Active-tree predecessor. */
  const currentEntryIndex =
    currentCategoryGroup?.entries.findIndex(
      (entry) => entry.kind === 'prompt' && entry.id === promptId
    ) ?? -1
  /** Requested or retained category-order placement normalized against the loaded groups. */
  const categoryOrderPlacement: PromptCategoryOrderPlacement = (() => {
    /** Placement supplied by a Completed-to-Active drop or inferred from current prompt ownership. */
    const placement =
      requestedCategoryOrderPlacement ??
      ({
        categoryId: currentCategoryGroup
          ? currentCategoryGroup.categoryId
          : (currentPrompt.category ?? null),
        previousEntryId:
          currentEntryIndex > 0 ? currentCategoryGroup!.entries[currentEntryIndex - 1]!.id : null
      } satisfies PromptCategoryOrderPlacement)
    /** Whether the requested category still belongs to the destination root folder. */
    const hasCategory = rootPromptFolder.categoryOrder.categories.some(
      (group) => group.categoryId === placement.categoryId
    )
    return hasCategory ? placement : { categoryId: null, previousEntryId: null }
  })()
  const modifiedAt = getCurrentIsoSecondTimestamp()
  const { completedAt: _completedAt, ...activePromptBase } = currentPrompt
  /** Prompt with its requested status fields before optional Active-tree placement. */
  const statusPrompt: PromptPersisted =
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
  /** Category-order reference removed on completion and restored on activation. */
  const categoryOrderEntry = promptEntryRef(promptId)
  /** Prompt whose category metadata matches its Active-tree placement. */
  const nextPrompt =
    targetStatus === PromptStatus.Completed
      ? statusPrompt
      : placeMarkdownContentInCategoryOrder(
          rootPromptFolder.categoryOrder,
          statusPrompt,
          categoryOrderEntry,
          categoryOrderPlacement.categoryId,
          categoryOrderPlacement.previousEntryId
        ).content

  await runRevisionMutation<SetPromptStatusResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.prompt.update(promptId, (draft) => {
        if (draft.loadingState !== 'full') return
        Object.assign(draft, nextPrompt)
        if (targetStatus !== PromptStatus.Completed) delete draft.completedAt
      })
      collections.promptDraft.update(promptId, (draft) => {
        draft.title = nextPrompt.title
        draft.fallbackTitle = nextPrompt.fallbackTitle
        draft.createdAt = nextPrompt.createdAt
        draft.modifiedAt = nextPrompt.modifiedAt
        draft.promptText = nextPrompt.promptText
        draft.templates = nextPrompt.templates
        if (nextPrompt.category === undefined) delete draft.category
        else draft.category = nextPrompt.category
        markPromptDraftEdited(draft)
      })
      collections.promptFolder.update(promptFolderId, (draft) => {
        if (targetStatus === PromptStatus.Completed) {
          if (
            promptFolderId === rootPromptFolderId &&
            !draft.completedPromptIds.includes(promptId)
          ) {
            draft.completedPromptIds = [promptId, ...draft.completedPromptIds]
          }
          if (promptFolderId === rootPromptFolderId) {
            draft.categoryOrder = removeCategoryOrderEntry(
              draft.categoryOrder,
              categoryOrderEntry
            )
          }
          return
        }
        draft.completedPromptIds = draft.completedPromptIds.filter((id) => id !== promptId)
        if (promptFolderId === rootPromptFolderId && isCompletedPrompt) {
          draft.categoryOrder = placeMarkdownContentInCategoryOrder(
            draft.categoryOrder,
            nextPrompt,
            categoryOrderEntry,
            categoryOrderPlacement.categoryId,
            categoryOrderPlacement.previousEntryId
          ).categoryOrder
        }
      })
      if (promptFolderId !== rootPromptFolderId) {
        collections.promptFolder.update(rootPromptFolderId, (draft) => {
          if (
            targetStatus === PromptStatus.Completed &&
            !draft.completedPromptIds.includes(promptId)
          ) {
            draft.completedPromptIds = [promptId, ...draft.completedPromptIds]
          } else if (targetStatus !== PromptStatus.Completed) {
            draft.completedPromptIds = draft.completedPromptIds.filter((id) => id !== promptId)
          }
          if (targetStatus === PromptStatus.Completed) {
            draft.categoryOrder = removeCategoryOrderEntry(
              draft.categoryOrder,
              categoryOrderEntry
            )
          } else if (isCompletedPrompt) {
            draft.categoryOrder = placeMarkdownContentInCategoryOrder(
              draft.categoryOrder,
              nextPrompt,
              categoryOrderEntry,
              categoryOrderPlacement.categoryId,
              categoryOrderPlacement.previousEntryId
            ).categoryOrder
          }
        })
      }
    },
    persistMutations: async ({ entities, transaction }) => {
      const promptEntity = entities.prompt({ id: promptId, data: createPromptFull(nextPrompt) })
      const result = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<SetPromptStatusResponsePayload>,
        SetPromptStatusPayload
      >('set-prompt-status', {
        sourcePromptFolder: entities.promptFolder({ id: promptFolderId, data: promptFolder }),
        rootPromptFolder: entities.promptFolder({
          id: rootPromptFolderId,
          data: rootPromptFolder
        }),
        prompt: { ...promptEntity, data: nextPrompt },
        status: targetStatus,
        categoryOrderPlacement
      })
      if (result.success) promptDraftCollection.utils.acceptMutations(transaction)
      return result
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertManyAuthoritative(payload.promptFolders)
      reconcilePrompt(payload.prompt)
    },
    conflictMessage: 'Prompt status conflict'
  })
}
