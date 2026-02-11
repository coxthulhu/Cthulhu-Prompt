import { createRevisionMutationRunner } from './RevisionMutation'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'

export const runRevisionMutation = createRevisionMutationRunner({
  systemSettings: systemSettingsCollection,
  workspace: workspaceCollection,
  promptFolder: promptFolderCollection,
  prompt: promptCollection
})
