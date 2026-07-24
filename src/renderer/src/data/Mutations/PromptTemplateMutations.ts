import {
  createPromptTemplateFull,
  isPromptTemplateFull,
  type PromptTemplateFull,
  type PromptTemplatePersisted
} from '@shared/PromptTemplate'
import { promptTemplateEntryRef } from '@shared/OrderContainer'
import { DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE } from '@shared/promptFallbackTitle'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import {
  markPromptTemplateDraftEdited,
  promptTemplateDraftCollection
} from '../Collections/PromptTemplateDraftCollection'
import { upsertPromptTemplateDrafts } from '../UiState/PromptTemplateDraftMutations.svelte.ts'
import { createMarkdownContentRendererMutations } from './MarkdownContentMutations'

const toPersisted = (template: PromptTemplateFull): PromptTemplatePersisted => ({
  id: template.id,
  title: template.title,
  fallbackTitle: template.fallbackTitle,
  createdAt: template.createdAt,
  modifiedAt: template.modifiedAt,
  templateText: template.templateText
})

const mutations = createMarkdownContentRendererMutations<
  PromptTemplatePersisted,
  PromptTemplateFull
>({
  kind: 'template',
  label: 'Prompt template',
  collectionId: promptTemplateCollection.id,
  defaultFallbackTitle: DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE,
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
  getDraftPersisted: (templateId) => {
    const draft = promptTemplateDraftCollection.get(templateId)
    if (!draft) return null
    const { isEdited: _isEdited, ...persisted } = draft
    return persisted
  },
  toPersisted,
  createEntity: (entities, templateId, template) => {
    const entity = entities.promptTemplate({
      id: templateId,
      data: createPromptTemplateFull(template)
    })
    return { ...entity, data: template }
  },
  insertOptimistically: (collections, template) => {
    collections.promptTemplate.insert(template)
    collections.promptTemplateDraft.insert(
      markPromptTemplateDraftEdited({ ...toPersisted(template), isEdited: false })
    )
  },
  deleteOptimistically: (collections, templateId) => {
    collections.promptTemplate.delete(templateId)
    collections.promptTemplateDraft.delete(templateId)
  },
  updateFallbackTitleOptimistically: (collections, templateId, update) => {
    collections.promptTemplate.update(templateId, update)
    collections.promptTemplateDraft.update(templateId, update)
  },
  acceptDraftMutations: (transaction) =>
    promptTemplateDraftCollection.utils.acceptMutations(transaction),
  reconcile: (snapshot) => {
    const fullSnapshot = { ...snapshot, data: createPromptTemplateFull(snapshot.data) }
    promptTemplateCollection.utils.upsertAuthoritative(fullSnapshot)
    upsertPromptTemplateDrafts([fullSnapshot.data])
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
