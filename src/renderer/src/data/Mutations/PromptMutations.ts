import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import {
  planCreatePromptDomainMutation,
  planPromptUpdate,
  type CreatePromptDomainCommand,
  type UpdatePromptDomainCommand
} from '@shared/domain/markdown-content/MarkdownContentDomainMutations'
import {
  isPromptFull,
  getPromptStatusFolderDefinition,
  isFinalPromptStatus,
  type PromptFull,
  type PromptPersisted
} from '@shared/domain/prompt/Prompt'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import {
  markPromptClientStateEdited
} from '@renderer/data/Collections/PromptClientStateCollection'
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
    delete: 'delete-prompt'
  },
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
