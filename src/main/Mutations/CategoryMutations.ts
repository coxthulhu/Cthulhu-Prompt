import {
  parseCreateCategoryDomainCommand,
  parseDeleteCategoryDomainCommand,
  parseMoveCategoryDomainCommand,
  parseSaveCategoriesDomainCommand,
  parseSetCategoryDescriptionDomainCommand,
  parseUpdateCategoryDetailsDomainCommand,
  planCreateCategoryDomainMutation,
  planDeleteCategoryDomainMutation,
  planMoveCategoryDomainMutation,
  planSaveCategoriesDomainMutation,
  planSetCategoryDescriptionDomainMutation,
  planUpdateCategoryDetailsDomainMutation
} from '@shared/CategoryDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers atomic management and focused category mutation channels. */
export const setupCategoryMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: 'save-categories' },
    mutation: {
      parseCommand: parseSaveCategoriesDomainCommand,
      plan: planSaveCategoriesDomainMutation
    }
  })

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
      plan: planDeleteCategoryDomainMutation
    }
  })

  handleMainDomainMutation({
    ipc: { channel: 'update-category-details' },
    mutation: {
      parseCommand: parseUpdateCategoryDetailsDomainCommand,
      plan: planUpdateCategoryDetailsDomainMutation
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
