import {
  UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL,
  parseSetMarkdownContentUiStateDomainCommand,
  planSetMarkdownContentUiStateDomainMutation
} from '@shared/MarkdownContentUiState'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers the paced markdown editor UI-state domain mutation. */
export const setupMarkdownContentUiStateMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL },
    mutation: {
      parseCommand: parseSetMarkdownContentUiStateDomainCommand,
      plan: planSetMarkdownContentUiStateDomainMutation
    }
  })
}
