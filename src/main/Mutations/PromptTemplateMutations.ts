import { promptTemplateEntryRef } from '@shared/OrderContainer'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import {
  parseCreatePromptTemplateDomainCommand,
  parseUpdatePromptTemplateDomainCommand,
  planCreatePromptTemplateDomainMutation,
  planPromptTemplateUpdate,
  type CreatePromptTemplateDomainCommand,
  type UpdatePromptTemplateDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import { data } from '../Data/Data'
import { buildPromptTemplateSnapshot } from '../Data/DataSnapshotHelpers'
import { parseDeletePromptTemplateRequest } from '../IpcFramework/IpcValidation'
import { setupMarkdownContentMutationHandlers } from './MarkdownContentMutations'

export const setupPromptTemplateMutationHandlers = (): void => {
  setupMarkdownContentMutationHandlers<
    PromptTemplatePersisted,
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
    createDomain: {
      parseCommand: parseCreatePromptTemplateDomainCommand,
      plan: planCreatePromptTemplateDomainMutation
    },
    updateDomain: {
      parseCommand: parseUpdatePromptTemplateDomainCommand,
      plan: planPromptTemplateUpdate
    },
    parsers: {
      delete: parseDeletePromptTemplateRequest
    },
    getContent: (templateId) => data.promptTemplate.committedStore.getEntry(templateId),
    buildSnapshot: buildPromptTemplateSnapshot,
    createEntryRef: promptTemplateEntryRef,
    updateFilename: (tx, templateId, persistenceFields) =>
      tx.promptTemplate.updatePersistenceFields({
        id: templateId,
        persistenceFields
      }),
    deleteContent: (tx, templateId, expectedRevision) =>
      tx.promptTemplate.delete({ id: templateId, expectedRevision })
  })
}
