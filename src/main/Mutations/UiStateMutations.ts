import {
  parseSetAccordionUiStateDomainCommand,
  parseSetCategoryDescriptionEditorUiStateDomainCommand,
  parseSetWorkspacePromptFolderUiStateDomainCommand,
  parseSetWorkspaceUiStateDomainCommand,
  planSetAccordionUiStateDomainMutation,
  planSetCategoryDescriptionEditorUiStateDomainMutation,
  planSetWorkspacePromptFolderUiStateDomainMutation,
  planSetWorkspaceUiStateDomainMutation
} from '@shared/UiStateDomainMutations'
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
    ipc: { channel: 'set-workspace-prompt-folder-ui-state' },
    mutation: {
      parseCommand: parseSetWorkspacePromptFolderUiStateDomainCommand,
      plan: planSetWorkspacePromptFolderUiStateDomainMutation
    }
  })
  handleMainDomainMutation({
    ipc: { channel: 'set-accordion-ui-state' },
    mutation: {
      parseCommand: parseSetAccordionUiStateDomainCommand,
      plan: planSetAccordionUiStateDomainMutation
    }
  })
  handleMainDomainMutation({
    ipc: { channel: 'set-category-description-editor-ui-state' },
    mutation: {
      parseCommand: parseSetCategoryDescriptionEditorUiStateDomainCommand,
      plan: planSetCategoryDescriptionEditorUiStateDomainMutation
    }
  })
}
