import {
  parseCreatePromptTemplateDomainCommand,
  parseUpdatePromptTemplateDomainCommand,
  planCreatePromptTemplateDomainMutation,
  planPromptTemplateUpdate,
  type CreatePromptTemplateDomainCommand,
  type UpdatePromptTemplateDomainCommand
} from '@shared/domain/markdown-content/MarkdownContentDomainMutations'
import { setupMarkdownContentMutationHandlers } from './MarkdownContentMutations'

export const setupPromptTemplateMutationHandlers = (): void => {
  setupMarkdownContentMutationHandlers<
    CreatePromptTemplateDomainCommand,
    UpdatePromptTemplateDomainCommand
  >({
    kind: 'template',
    channels: {
      create: 'create-prompt-template',
      update: 'update-prompt-template',
      delete: 'delete-prompt-template'
    },
    createDomain: {
      parseCommand: parseCreatePromptTemplateDomainCommand,
      plan: planCreatePromptTemplateDomainMutation
    },
    updateDomain: {
      parseCommand: parseUpdatePromptTemplateDomainCommand,
      plan: planPromptTemplateUpdate
    },
  })
}
