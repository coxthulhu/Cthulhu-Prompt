import { promptTemplateEntryRef } from '@shared/OrderContainer'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import { DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE } from '@shared/promptFallbackTitle'
import { data } from '../Data/Data'
import { buildPromptTemplateSnapshot } from '../Data/DataSnapshotHelpers'
import { MarkdownContentUiStateDataAccess } from '../DataAccess/MarkdownContentUiStateDataAccess'
import {
  parseCreatePromptTemplateRequest,
  parseDeletePromptTemplateRequest,
  parseMovePromptTemplateDomainMutationRequest,
  parseUpdatePromptTemplateRevisionRequest
} from '../IpcFramework/IpcValidation'
import { setupMarkdownContentMutationHandlers } from './MarkdownContentMutations'

export const setupPromptTemplateMutationHandlers = (): void => {
  setupMarkdownContentMutationHandlers<PromptTemplatePersisted>({
    kind: 'template',
    label: 'Prompt template',
    channels: {
      create: 'create-prompt-template',
      update: 'update-prompt-template',
      delete: 'delete-prompt-template',
      move: 'move-prompt-template'
    },
    parsers: {
      create: parseCreatePromptTemplateRequest,
      update: parseUpdatePromptTemplateRevisionRequest,
      delete: parseDeletePromptTemplateRequest,
      move: parseMovePromptTemplateDomainMutationRequest
    },
    defaultFallbackTitle: DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE,
    getContent: (templateId) => data.promptTemplate.committedStore.getEntry(templateId),
    buildSnapshot: buildPromptTemplateSnapshot,
    createEntryRef: promptTemplateEntryRef,
    createPersisted: (requested, titleFields, now) => ({
      id: requested.id,
      ...titleFields,
      createdAt: now,
      modifiedAt: now,
      templateText: requested.templateText,
      ...(requested.category !== undefined ? { category: requested.category } : {})
    }),
    updatePersisted: (requested, _current, titleFields) => ({
      id: requested.id,
      ...titleFields,
      createdAt: requested.createdAt,
      modifiedAt: requested.modifiedAt,
      templateText: requested.templateText,
      ...(requested.category !== undefined ? { category: requested.category } : {})
    }),
    canMove: () => true,
    createContent: (tx, operation) =>
      tx.promptTemplate.create({
        id: operation.id,
        data: operation.data,
        persistenceFields: operation.persistenceFields
      }),
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
