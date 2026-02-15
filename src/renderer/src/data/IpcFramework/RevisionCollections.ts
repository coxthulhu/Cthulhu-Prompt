import {
  createOpenRevisionUpdateMutationRunner,
  createRevisionMutationRunner
} from './RevisionMutation'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { systemSettingsDraftCollection } from '../Collections/SystemSettingsDraftCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'

export {
  mutateOpenUpdateTransaction,
  sendOpenUpdateTransactionIfPresent,
  submitOpenUpdateTransactionAndWait,
  submitAllOpenUpdateTransactionsAndWait
} from './RevisionMutationTransactionRegistry'

const revisionCollections = {
  systemSettings: systemSettingsCollection,
  workspace: workspaceCollection,
  promptFolder: promptFolderCollection,
  prompt: promptCollection
}

const optimisticCollections = {
  ...revisionCollections,
  systemSettingsDraft: systemSettingsDraftCollection
}

export const mutateOpenRevisionUpdateTransaction =
  createOpenRevisionUpdateMutationRunner(revisionCollections, optimisticCollections)

export const runRevisionMutation = createRevisionMutationRunner(
  revisionCollections,
  optimisticCollections
)
