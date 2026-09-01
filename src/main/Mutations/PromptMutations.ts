import {
  parseCreatePromptDomainCommand,
  parseUpdatePromptDomainCommand,
  planCreatePromptDomainMutation,
  planPromptUpdate,
  type CreatePromptDomainCommand,
  type UpdatePromptDomainCommand
} from '@shared/MarkdownContentDomainMutations'
import {
  parseSetPromptStatusDomainCommand,
  planSetPromptStatusDomainMutation
} from '@shared/PromptDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'
import { setupMarkdownContentMutationHandlers } from './MarkdownContentMutations'

/** Registers prompt creation, update, deletion, movement, and status mutations. */
export const setupPromptMutationHandlers = (): void => {
  setupMarkdownContentMutationHandlers<
    CreatePromptDomainCommand,
    UpdatePromptDomainCommand
  >({
    kind: 'prompt',
    channels: {
      create: 'create-prompt',
      update: 'update-prompt',
      delete: 'delete-prompt',
      move: 'move-prompt'
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
    ipc: { channel: 'set-prompt-status' },
    mutation: {
      parseCommand: parseSetPromptStatusDomainCommand,
      plan: planSetPromptStatusDomainMutation
    }
  })
}
