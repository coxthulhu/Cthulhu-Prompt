import { createTanstackRevisionMutationRunner } from './TanstackRevisionMutation'
import { tanstackPromptCollection } from '../Collections/TanstackPromptCollection'
import { tanstackPromptFolderCollection } from '../Collections/TanstackPromptFolderCollection'
import { tanstackSystemSettingsCollection } from '../Collections/TanstackSystemSettingsCollection'
import { tanstackWorkspaceCollection } from '../Collections/TanstackWorkspaceCollection'

export const runTanstackRevisionMutation = createTanstackRevisionMutationRunner({
  systemSettings: tanstackSystemSettingsCollection,
  workspace: tanstackWorkspaceCollection,
  promptFolder: tanstackPromptFolderCollection,
  prompt: tanstackPromptCollection
})
