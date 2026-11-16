import { parseSetWorkspaceUiStateDomainCommand, planSetWorkspaceUiStateDomainMutation } from '@shared/domain/ui-state/UiStateDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers the unified workspace tab session mutation. */
export const setupUiStateMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: 'set-workspace-ui-state' },
    mutation: {
      parseCommand: parseSetWorkspaceUiStateDomainCommand,
      plan: planSetWorkspaceUiStateDomainMutation
    }
  })
}
