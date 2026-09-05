import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import {
  planCreatePromptDomainMutation,
  planPromptUpdate,
  type CreatePromptDomainCommand,
  type UpdatePromptDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import {
  isPromptFull,
  getPromptStatusFolderDefinition,
  isFinalPromptStatus,
  PromptStatus,
  PromptStatusFolderId,
  type PromptCategoryOrderPlacement,
  type PromptFull,
  type PromptPersisted
} from '@shared/Prompt'
import { planSetPromptStatusDomainMutation } from '@shared/PromptDomainMutations'
import { promptCollection } from '../Collections/PromptCollection'
import {
  markPromptClientStateEdited
} from '../Collections/PromptClientStateCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { runImmediateRendererDomainMutation } from '../IpcFramework/RendererDomainMutation'
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
  ...(isFinalPromptStatus(prompt.status) && prompt.finalizedAt
    ? { finalizedAt: prompt.finalizedAt }
    : {})
})

const mutations = createMarkdownContentRendererMutations<
  PromptPersisted,
  PromptFull,
  CreatePromptDomainCommand,
  UpdatePromptDomainCommand
>({
  kind: 'prompt',
  label: 'Prompt',
  channels: {
    create: 'create-prompt',
    update: 'update-prompt',
    delete: 'delete-prompt',
    move: 'move-prompt'
  },
  getContent: (promptId) => promptCollection.get(promptId),
  getFullPersisted: (promptId) => {
    const prompt = promptCollection.get(promptId)
    return prompt && isPromptFull(prompt) ? toPersisted(prompt) : null
  },
  createDomain: {
    plan: planCreatePromptDomainMutation,
    /** Builds the deterministic prompt-creation command sent through generic IPC. */
    createCommand: (promptFolderId, prompt, previousEntryId, categoryId) => ({
      promptFolderId,
      statusFolderId: getPromptStatusFolderDefinition(prompt.status).id,
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
  updateDomain: {
    plan: planPromptUpdate,
    /** Builds the complete editable prompt replacement command. */
    createCommand: (prompt) => ({
      contentId: prompt.id,
      title: prompt.title,
      fallbackTitle: prompt.fallbackTitle,
      modifiedAt: prompt.modifiedAt,
      promptText: prompt.promptText,
      ...(prompt.templates !== undefined ? { templates: prompt.templates } : {})
    })
  },
  insertClientStateOptimistically: (collections, promptId) => {
    collections.promptClientState.insert(
      markPromptClientStateEdited({ id: promptId, isEdited: false })
    )
  },
  markClientStateEdited: (collections, promptId) => {
    collections.promptClientState.update(promptId, (clientState) => {
      markPromptClientStateEdited(clientState)
    })
  }
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
  /** Source status-folder layout selected from the prompt's canonical current status. */
  const sourceStatusLayout =
    sourcePromptFolder.statusFolders[getPromptStatusFolderDefinition(prompt.status).id]
  /** Current ordered group used when a status change does not request a new placement. */
  const currentCategoryGroup =
    sourceStatusLayout.ordering === 'category'
      ? sourceStatusLayout.categoryOrder.categories.find((group) =>
          group.entries.some((entry) => entry.kind === 'prompt' && entry.id === promptId)
        )
      : undefined
  /** Explicit drop placement or default entry position; same-folder updates ignore placement. */
  const categoryOrderPlacement: PromptCategoryOrderPlacement = (() => {
    /** Category supplied by a drop or retained from the prompt's current ownership. */
    const categoryId = requestedCategoryOrderPlacement
      ? requestedCategoryOrderPlacement.categoryId
      : currentCategoryGroup ? currentCategoryGroup.categoryId : (prompt.category ?? null)
    /** Workflow receiving the prompt and defining its default entry position. */
    const destinationStatusFolderId = getPromptStatusFolderDefinition(targetStatus).id
    /** Destination status-folder layout selected from the requested status. */
    const destinationStatusLayout =
      destinationPromptFolder.statusFolders[destinationStatusFolderId]
    if (destinationStatusLayout.ordering !== 'category') {
      return { categoryId: null, previousEntryId: null }
    }
    /** Destination category, falling back to Uncategorized when the original was deleted. */
    const destinationCategory = destinationStatusLayout.categoryOrder.categories.find(
      (group) => group.categoryId === categoryId
    ) ?? destinationStatusLayout.categoryOrder.categories[0]!
    if (requestedCategoryOrderPlacement) {
      return destinationCategory.categoryId === categoryId
        ? requestedCategoryOrderPlacement
        : { categoryId: null, previousEntryId: null }
    }
    return {
      categoryId: destinationCategory.categoryId,
      previousEntryId: destinationStatusFolderId === PromptStatusFolderId.Active
        ? (destinationCategory.entries.at(-1)?.id ?? null)
        : null
    }
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
      }
    }
  })
}
