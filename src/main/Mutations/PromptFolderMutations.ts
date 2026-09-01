import {
  parseCreatePromptFolderDomainCommand,
  parseDeletePromptFolderDomainCommand,
  parseRenamePromptFolderDomainCommand,
  planCreatePromptFolderDomainMutation,
  planDeletePromptFolderDomainMutation,
  planRenamePromptFolderDomainMutation,
  selectPromptFolderDeletionExpectedTargets
} from '@shared/PromptFolderDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers root prompt-folder creation, deletion, and rename mutations. */
export const setupPromptFolderMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: 'rename-prompt-folder' },
    mutation: {
      parseCommand: parseRenamePromptFolderDomainCommand,
      plan: planRenamePromptFolderDomainMutation
    }
  })
  handleMainDomainMutation({
    ipc: { channel: 'create-prompt-folder' },
    mutation: {
      parseCommand: parseCreatePromptFolderDomainCommand,
      plan: planCreatePromptFolderDomainMutation
    }
  })
  handleMainDomainMutation({
    ipc: { channel: 'delete-prompt-folder' },
    mutation: {
      parseCommand: parseDeletePromptFolderDomainCommand,
      plan: planDeletePromptFolderDomainMutation,
      selectExpectedTargets: selectPromptFolderDeletionExpectedTargets
    }
  })
}
