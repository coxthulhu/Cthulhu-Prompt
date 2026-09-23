import {
  parseCreatePromptDomainCommand,
  parseUpdatePromptDomainCommand,
  planCreatePromptDomainMutation,
  planPromptUpdate,
  type CreatePromptDomainCommand,
  type UpdatePromptDomainCommand
} from '@shared/domain/markdown-content/MarkdownContentDomainMutations'
import {
  parseSetPromptLocationDomainCommand,
  planSetPromptLocationDomainMutation
} from '@shared/domain/prompt/PromptDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'
import { setupMarkdownContentMutationHandlers } from './MarkdownContentMutations'

/** Registers prompt CRUD and the shared prompt/template location mutation. */
export const setupPromptMutationHandlers = (): void => {
  setupMarkdownContentMutationHandlers<
    CreatePromptDomainCommand,
    UpdatePromptDomainCommand
  >({
    kind: 'prompt',
    channels: {
      create: 'create-prompt',
      update: 'update-prompt',
      delete: 'delete-prompt'
    },
    createDomain: {
      parseCommand: parseCreatePromptDomainCommand,
      plan: planCreatePromptDomainMutation
    },
    updateDomain: {
      parseCommand: parseUpdatePromptDomainCommand,
      plan: planPromptUpdate
    },
  })

  handleMainDomainMutation({
    ipc: { channel: 'set-prompt-location' },
    mutation: {
      parseCommand: parseSetPromptLocationDomainCommand,
      plan: planSetPromptLocationDomainMutation
    }
  })
}
