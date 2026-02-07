import { createTanstackRevisionMutationRunner } from './TanstackRevisionMutation'
import { tanstackPromptCollection } from './TanstackPromptCollection'
import { tanstackPromptFolderCollection } from './TanstackPromptFolderCollection'
import { tanstackSystemSettingsCollection } from './TanstackSystemSettingsCollection'
import { tanstackWorkspaceCollection } from './TanstackWorkspaceCollection'

export const runTanstackRevisionMutation = createTanstackRevisionMutationRunner({
  systemSettings: tanstackSystemSettingsCollection,
  workspace: tanstackWorkspaceCollection,
  promptFolder: tanstackPromptFolderCollection,
  prompt: tanstackPromptCollection
})
