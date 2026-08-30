import {
  parseSetSystemSettingsDomainCommand,
  planSetSystemSettingsDomainMutation
} from '@shared/SystemSettingsDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers the paced system-settings domain mutation channel. */
export const setupSystemSettingsMutationHandlers = (): void => {
  handleMainDomainMutation({
    ipc: { channel: 'update-system-settings' },
    mutation: {
      parseCommand: parseSetSystemSettingsDomainCommand,
      plan: planSetSystemSettingsDomainMutation
    }
  })
}
