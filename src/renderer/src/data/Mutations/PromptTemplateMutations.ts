import {
  createPromptTemplateFull,
  isPromptTemplateFull,
  type PromptTemplateFull,
  type PromptTemplatePersisted
} from '@shared/PromptTemplate'
import { promptTemplateEntryRef } from '@shared/OrderContainer'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import {
  planCreatePromptTemplateDomainMutation,
  type CreatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import {
  markPromptTemplateClientStateEdited,
  promptTemplateClientStateCollection
} from '../Collections/PromptTemplateClientStateCollection'
import { upsertPromptTemplateClientStates } from '../UiState/PromptTemplateClientStateMutations.svelte.ts'
import { clearPromptEditorMeasuredHeight } from '../UiState/PromptEditorUiCache.svelte.ts'
import { createMarkdownContentRendererMutations } from './MarkdownContentMutations'

const toPersisted = (template: PromptTemplateFull): PromptTemplatePersisted => ({
  id: template.id,
  title: template.title,
  fallbackTitle: template.fallbackTitle,
  createdAt: template.createdAt,
  modifiedAt: template.modifiedAt,
  ...(template.category !== undefined ? { category: template.category } : {}),
  templateText: template.templateText
})

const mutations = createMarkdownContentRendererMutations<
  PromptTemplatePersisted,
  PromptTemplateFull,
  CreatePromptTemplateDomainCommand
>({
  kind: 'template',
  label: 'Prompt template',
  collectionId: promptTemplateCollection.id,
  channels: {
    create: 'create-prompt-template',
    update: 'update-prompt-template',
    delete: 'delete-prompt-template',
    move: 'move-prompt-template'
  },
  createEntryRef: promptTemplateEntryRef,
  getContent: (templateId) => promptTemplateCollection.get(templateId),
  getFullPersisted: (templateId) => {
    const template = promptTemplateCollection.get(templateId)
    return template && isPromptTemplateFull(template) ? toPersisted(template) : null
  },
  toPersisted,
  createEntity: (entities, templateId, template) => {
    const entity = entities.promptTemplate({
      id: templateId,
      data: createPromptTemplateFull(template)
    })
    return { ...entity, data: template }
  },
  createDomain: {
    plan: planCreatePromptTemplateDomainMutation,
    /** Builds the deterministic template-creation command sent through generic IPC. */
    createCommand: (promptFolderId, template, previousEntryId, categoryId) => ({
      promptFolderId,
      contentId: template.id,
      title: template.title,
      fallbackTitle: template.fallbackTitle,
      templateText: template.templateText,
      createdAt: getCurrentIsoSecondTimestamp(),
      categoryId,
      previousEntryId
    })
  },
  insertClientStateOptimistically: (collections, templateId) => {
    collections.promptTemplateClientState.insert(
      markPromptTemplateClientStateEdited({ id: templateId, isEdited: false })
    )
  },
  deleteOptimistically: (collections, templateId) => {
    collections.promptTemplate.delete(templateId)
    collections.promptTemplateClientState.delete(templateId)
  },
  markMoveClientStateEdited: (collections, templateId) => {
    collections.promptTemplateClientState.update(templateId, (clientState) => {
      markPromptTemplateClientStateEdited(clientState)
    })
  },
  acceptClientStateMutations: (transaction) =>
    promptTemplateClientStateCollection.utils.acceptMutations(transaction),
  reconcile: (snapshot) => {
    /** Canonical template present before authoritative reconciliation. */
    const currentTemplate = promptTemplateCollection.get(snapshot.id)
    if (
      !currentTemplate ||
      !isPromptTemplateFull(currentTemplate) ||
      currentTemplate.templateText !== snapshot.data.templateText
    ) {
      clearPromptEditorMeasuredHeight(snapshot.id)
    }
    const fullSnapshot = { ...snapshot, data: createPromptTemplateFull(snapshot.data) }
    promptTemplateCollection.utils.upsertAuthoritative(fullSnapshot)
    upsertPromptTemplateClientStates([fullSnapshot.data])
  },
  deleteAuthoritative: (templateId) =>
    promptTemplateCollection.utils.deleteAuthoritative(templateId)
})

export const createPromptTemplate = mutations.create
export const mutatePacedPromptTemplateAutosaveUpdate = (
  options: Omit<Parameters<typeof mutations.mutatePacedAutosaveUpdate>[0], 'contentId'> & {
    templateId: string
  }
): void => {
  const { templateId, ...mutationOptions } = options
  mutations.mutatePacedAutosaveUpdate({ contentId: templateId, ...mutationOptions })
}
export const deletePromptTemplate = mutations.delete
export const movePromptTemplate = mutations.move
