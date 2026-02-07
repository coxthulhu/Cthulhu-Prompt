import { runTanstackRevisionMutation as createTanstackRevisionMutationRunner } from './TanstackRevisionMutation'
import { tanstackSystemSettingsCollection } from './TanstackSystemSettingsCollection'

export const tanstackRevisionCollections = {
  systemSettings: tanstackSystemSettingsCollection
}

export const runTanstackRevisionMutation = createTanstackRevisionMutationRunner(
  tanstackRevisionCollections
)
