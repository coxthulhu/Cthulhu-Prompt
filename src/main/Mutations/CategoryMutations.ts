import {
  parseCreateCategoryDomainCommand,
  parseDeleteCategoryDomainCommand,
  parseMoveCategoryDomainCommand,
  parseRenameCategoryDomainCommand,
  parseSetCategoryDescriptionDomainCommand,
  planCreateCategoryDomainMutation,
  planDeleteCategoryDomainMutation,
  planMoveCategoryDomainMutation,
  planRenameCategoryDomainMutation,
  planSetCategoryDescriptionDomainMutation,
  selectCategoryDeletionExpectedTargets
} from '@shared/CategoryDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers create, rename, description, and deletion category mutation channels. */
export const setupCategoryMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: 'create-category' },
    mutation: {
      parseCommand: parseCreateCategoryDomainCommand,
      plan: planCreateCategoryDomainMutation
    }
  })

  handleMainDomainMutation({
    ipc: { channel: 'delete-category' },
    mutation: {
      parseCommand: parseDeleteCategoryDomainCommand,
      plan: planDeleteCategoryDomainMutation,
      selectExpectedTargets: selectCategoryDeletionExpectedTargets
    }
  })

  handleMainDomainMutation({
    ipc: { channel: 'rename-category' },
    mutation: {
      parseCommand: parseRenameCategoryDomainCommand,
      plan: planRenameCategoryDomainMutation
    }
  })

  handleMainDomainMutation({
    ipc: { channel: 'set-category-description' },
    mutation: {
      parseCommand: parseSetCategoryDescriptionDomainCommand,
      plan: planSetCategoryDescriptionDomainMutation
    }
  })

  handleMainDomainMutation({
    ipc: { channel: 'move-category' },
    mutation: {
      parseCommand: parseMoveCategoryDomainCommand,
      plan: planMoveCategoryDomainMutation
    }
  })
}
