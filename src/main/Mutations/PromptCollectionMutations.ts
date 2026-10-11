import {
  parseCreatePromptCollectionDomainCommand,
  parseDeletePromptCollectionDomainCommand,
  parseRenamePromptCollectionDomainCommand,
  planCreatePromptCollectionDomainMutation,
  planDeletePromptCollectionDomainMutation,
  planRenamePromptCollectionDomainMutation
} from '@shared/domain/prompt-collection/PromptCollectionDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers prompt-collection creation, deletion, and rename mutations. */
export const setupPromptCollectionMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: 'rename-prompt-collection' },
    mutation: {
      parseCommand: parseRenamePromptCollectionDomainCommand,
      plan: planRenamePromptCollectionDomainMutation
    }
  })
  handleMainDomainMutation({
    ipc: { channel: 'create-prompt-collection' },
    mutation: {
      parseCommand: parseCreatePromptCollectionDomainCommand,
      plan: planCreatePromptCollectionDomainMutation
    }
  })
  handleMainDomainMutation({
    ipc: { channel: 'delete-prompt-collection' },
    mutation: {
      parseCommand: parseDeletePromptCollectionDomainCommand,
      plan: planDeletePromptCollectionDomainMutation
    }
  })
}
