import {
  isPromptTemplateFull,
  type PromptTemplateFull,
  type PromptTemplatePersisted
} from '@shared/PromptTemplate'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import {
  planCreatePromptTemplateDomainMutation,
  planPromptTemplateUpdate,
  type CreatePromptTemplateDomainCommand,
  type UpdatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import {
  markPromptTemplateClientStateEdited
} from '../Collections/PromptTemplateClientStateCollection'
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
  CreatePromptTemplateDomainCommand,
  UpdatePromptTemplateDomainCommand
>({
  kind: 'template',
  label: 'Prompt template',
  channels: {
    create: 'create-prompt-template',
    update: 'update-prompt-template',
    delete: 'delete-prompt-template',
    move: 'move-prompt-template'
  },
  getContent: (templateId) => promptTemplateCollection.get(templateId),
  getFullPersisted: (templateId) => {
    const template = promptTemplateCollection.get(templateId)
    return template && isPromptTemplateFull(template) ? toPersisted(template) : null
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
  updateDomain: {
    plan: planPromptTemplateUpdate,
    /** Builds the complete editable template replacement command. */
    createCommand: (template) => ({
      contentId: template.id,
      title: template.title,
      fallbackTitle: template.fallbackTitle,
      modifiedAt: template.modifiedAt,
      templateText: template.templateText
    })
  },
  insertClientStateOptimistically: (collections, templateId) => {
    collections.promptTemplateClientState.insert(
      markPromptTemplateClientStateEdited({ id: templateId, isEdited: false })
    )
  },
  markClientStateEdited: (collections, templateId) => {
    collections.promptTemplateClientState.update(templateId, (clientState) => {
      markPromptTemplateClientStateEdited(clientState)
    })
  }
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
