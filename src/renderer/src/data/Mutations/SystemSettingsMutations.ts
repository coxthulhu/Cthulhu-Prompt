import {
  SYSTEM_SETTINGS_ID,
  type SystemSettings
} from '@shared/SystemSettings'
import { planSetSystemSettingsDomainMutation } from '@shared/SystemSettingsDomainMutations'
import { systemSettingsClientStateCollection } from '../Collections/SystemSettingsClientStateCollection'
import { mutatePacedRendererDomainMutation } from '../IpcFramework/RendererDomainMutation'

/** Inputs used to enqueue one paced system-settings replacement. */
type PacedSystemSettingsUpdateOptions = Pick<
  Parameters<typeof mutatePacedRendererDomainMutation<SystemSettings>>[0]['pacing'],
  'debounceMs' | 'validateBeforeEnqueue'
> & {
  systemSettings: SystemSettings
  mutateClientState: Parameters<
    typeof mutatePacedRendererDomainMutation<SystemSettings>
  >[0]['renderer']['mutate']
}

/** Enqueues a validated system-settings command and its renderer-only form changes. */
export const mutatePacedSystemSettingsAutosaveUpdate = ({
  systemSettings,
  debounceMs,
  mutateClientState,
  validateBeforeEnqueue
}: PacedSystemSettingsUpdateOptions): void => {
  mutatePacedRendererDomainMutation({
    mutation: {
      command: systemSettings,
      plan: planSetSystemSettingsDomainMutation
    },
    ipc: { channel: 'update-system-settings' },
    renderer: {
      mutate: mutateClientState,
      clientStateCollections: [systemSettingsClientStateCollection]
    },
    pacing: {
      target: { entityType: 'systemSettings', id: SYSTEM_SETTINGS_ID },
      debounceMs,
      validateBeforeEnqueue
    }
  })
}
