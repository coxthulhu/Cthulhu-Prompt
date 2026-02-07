import { createTanstackRevisionMutationRunner } from './TanstackRevisionMutation'
import { tanstackSystemSettingsCollection } from './TanstackSystemSettingsCollection'

export const runTanstackRevisionMutation = createTanstackRevisionMutationRunner({
  systemSettings: tanstackSystemSettingsCollection
})
