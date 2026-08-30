import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import {
  planCreatePromptDomainMutation,
  type CreatePromptDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import { promptEntryRef } from '@shared/OrderContainer'
import {
  createPromptFull,
  isPromptFull,
  PromptStatus,
  type PromptCategoryOrderPlacement,
  type PromptFull,
  type PromptPersisted
} from '@shared/Prompt'
import { planSetPromptStatusDomainMutation } from '@shared/PromptDomainMutations'
import { promptCollection } from '../Collections/PromptCollection'
import {
  markPromptClientStateEdited,
  promptClientStateCollection
} from '../Collections/PromptClientStateCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { runImmediateRendererDomainMutation } from '../IpcFramework/RendererDomainMutation'
import { upsertPromptClientState } from '../UiState/PromptClientState'
import { clearPromptEditorMeasuredHeight } from '../UiState/PromptEditorUiCache.svelte.ts'
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
  /** Canonical prompt present before authoritative reconciliation. */
  const currentPrompt = promptCollection.get(snapshot.id)
  if (
    !currentPrompt ||
    !isPromptFull(currentPrompt) ||
    currentPrompt.promptText !== snapshot.data.promptText
  ) {
    clearPromptEditorMeasuredHeight(snapshot.id)
  }
  const fullSnapshot = { ...snapshot, data: createPromptFull(snapshot.data) }
  promptCollection.utils.upsertAuthoritative(fullSnapshot)
  upsertPromptClientState(fullSnapshot.data)
}

const mutations = createMarkdownContentRendererMutations<
  PromptPersisted,
  PromptFull,
  CreatePromptDomainCommand
>({
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
  toPersisted,
  createEntity: (entities, promptId, prompt) => {
    const entity = entities.prompt({ id: promptId, data: createPromptFull(prompt) })
    return { ...entity, data: prompt }
  },
  createDomain: {
    plan: planCreatePromptDomainMutation,
    /** Builds the deterministic prompt-creation command sent through generic IPC. */
    createCommand: (promptFolderId, prompt, previousEntryId, categoryId) => ({
      promptFolderId,
      contentId: prompt.id,
      title: prompt.title,
      fallbackTitle: prompt.fallbackTitle,
      promptText: prompt.promptText,
      createdAt: getCurrentIsoSecondTimestamp(),
      categoryId,
      previousEntryId,
      ...(prompt.templates !== undefined ? { templates: prompt.templates } : {})
    })
  },
  insertClientStateOptimistically: (collections, promptId) => {
    collections.promptClientState.insert(
      markPromptClientStateEdited({ id: promptId, isEdited: false })
    )
  },
  deleteOptimistically: (collections, promptId) => {
    collections.prompt.delete(promptId)
    collections.promptClientState.delete(promptId)
  },
  markMoveClientStateEdited: (collections, promptId) => {
    collections.promptClientState.update(promptId, (clientState) => {
      markPromptClientStateEdited(clientState)
    })
  },
  acceptClientStateMutations: (transaction) =>
    promptClientStateCollection.utils.acceptMutations(transaction),
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
  sourcePromptFolderId: string,
  destinationPromptFolderId: string,
  promptId: string,
  targetStatus: PromptStatus,
  requestedCategoryOrderPlacement?: PromptCategoryOrderPlacement
): Promise<void> => {
  const sourcePromptFolder = promptFolderCollection.get(sourcePromptFolderId)
  if (!sourcePromptFolder || sourcePromptFolder.kind === 'template') {
    throw new Error('Source prompt folder not loaded')
  }
  /** Loaded destination root used for category placement and ownership transfer. */
  const destinationPromptFolder = promptFolderCollection.get(destinationPromptFolderId)
  if (!destinationPromptFolder || destinationPromptFolder.kind === 'template') {
    throw new Error('Destination prompt folder not loaded')
  }
  /** Canonical renderer prompt used for the optimistic status projection. */
  const prompt = promptCollection.get(promptId)
  if (!prompt) throw new Error('Prompt not loaded')
  /** Current Active-tree group used when a status-button change does not request a new placement. */
  const currentCategoryGroup = sourcePromptFolder.categoryOrder.categories.find((group) =>
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
        categoryId: currentCategoryGroup ? currentCategoryGroup.categoryId : (prompt.category ?? null),
        previousEntryId:
          currentEntryIndex > 0 ? currentCategoryGroup!.entries[currentEntryIndex - 1]!.id : null
      } satisfies PromptCategoryOrderPlacement)
    /** Whether the requested category still belongs to the destination root folder. */
    const hasCategory = destinationPromptFolder.categoryOrder.categories.some(
      (group) => group.categoryId === placement.categoryId
    )
    return hasCategory ? placement : { categoryId: null, previousEntryId: null }
  })()
  /** Shared prompt-status command projected in both processes. */
  const command = {
    sourcePromptFolderId,
    destinationPromptFolderId,
    promptId,
    status: targetStatus,
    categoryOrderPlacement,
    modifiedAt: getCurrentIsoSecondTimestamp()
  }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planSetPromptStatusDomainMutation },
    ipc: { channel: 'set-prompt-status' },
    renderer: {
      mutate: ({ collections }) => {
        collections.promptClientState.update(promptId, (clientState) => {
          markPromptClientStateEdited(clientState)
        })
      },
      clientStateCollections: [promptClientStateCollection]
    }
  })
}
