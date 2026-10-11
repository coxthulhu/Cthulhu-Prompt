import {
  parseSetAccordionUiStateDomainCommand,
  parseSetWorkspacePromptCollectionUiStateDomainCommand,
  parseSetWorkspaceUiStateDomainCommand,
  planSetAccordionUiStateDomainMutation,
  planSetWorkspacePromptCollectionUiStateDomainMutation,
  planSetWorkspaceUiStateDomainMutation
} from '@shared/domain/ui-state/UiStateDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers mutations for every split workspace UI-state collection. */
export const setupUiStateMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: 'set-workspace-ui-state' },
    mutation: {
      parseCommand: parseSetWorkspaceUiStateDomainCommand,
      plan: planSetWorkspaceUiStateDomainMutation
    }
  })
  handleMainDomainMutation({
    ipc: { channel: 'set-workspace-prompt-collection-ui-state' },
    mutation: {
      parseCommand: parseSetWorkspacePromptCollectionUiStateDomainCommand,
      plan: planSetWorkspacePromptCollectionUiStateDomainMutation
    }
  })
  handleMainDomainMutation({
    ipc: { channel: 'set-accordion-ui-state' },
    mutation: {
      parseCommand: parseSetAccordionUiStateDomainCommand,
      plan: planSetAccordionUiStateDomainMutation
    }
  })
}
