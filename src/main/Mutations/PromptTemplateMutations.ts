import { promptTemplateEntryRef } from '@shared/OrderContainer'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import {
  parseCreatePromptTemplateDomainCommand,
  planCreatePromptTemplateDomainMutation,
  type CreatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import { DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE } from '@shared/promptFallbackTitle'
import { data } from '../Data/Data'
import { buildPromptTemplateSnapshot } from '../Data/DataSnapshotHelpers'
import { MarkdownContentUiStateDataAccess } from '../DataAccess/MarkdownContentUiStateDataAccess'
import {
  parseDeletePromptTemplateRequest,
  parseUpdatePromptTemplateRevisionRequest
} from '../IpcFramework/IpcValidation'
import { setupMarkdownContentMutationHandlers } from './MarkdownContentMutations'

export const setupPromptTemplateMutationHandlers = (): void => {
  setupMarkdownContentMutationHandlers<
    PromptTemplatePersisted,
    CreatePromptTemplateDomainCommand
  >({
    kind: 'template',
    label: 'Prompt template',
    channels: {
      create: 'create-prompt-template',
      update: 'update-prompt-template',
      delete: 'delete-prompt-template',
      move: 'move-prompt-template'
    },
    createDomain: {
      parseCommand: parseCreatePromptTemplateDomainCommand,
      plan: planCreatePromptTemplateDomainMutation
    },
    parsers: {
      update: parseUpdatePromptTemplateRevisionRequest,
      delete: parseDeletePromptTemplateRequest
    },
    defaultFallbackTitle: DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE,
    getContent: (templateId) => data.promptTemplate.committedStore.getEntry(templateId),
    buildSnapshot: buildPromptTemplateSnapshot,
    createEntryRef: promptTemplateEntryRef,
    updatePersisted: (requested, _current, titleFields) => ({
      id: requested.id,
      ...titleFields,
      createdAt: requested.createdAt,
      modifiedAt: requested.modifiedAt,
      templateText: requested.templateText,
      ...(requested.category !== undefined ? { category: requested.category } : {})
    }),
    canMove: () => true,
    updateContent: (tx, operation) =>
      tx.promptTemplate.update({
        id: operation.id,
        expectedRevision: operation.expectedRevision,
        recipe: (draft) => {
          Object.assign(draft, operation.data)
          if (operation.data.category === undefined) delete draft.category
        },
        persistenceFields: operation.persistenceFields
      }),
    updateFilename: (tx, templateId, persistenceFields) =>
      tx.promptTemplate.updatePersistenceFields({
        id: templateId,
        persistenceFields
      }),
    deleteContent: (tx, templateId, expectedRevision) =>
      tx.promptTemplate.delete({ id: templateId, expectedRevision }),
    onDeleted: (workspaceId, templateId) => {
      MarkdownContentUiStateDataAccess.deleteMarkdownContentUiState(workspaceId, templateId)
    }
  })
}
