import {
  createPacedRevisionUpdateMutationRunner,
  createRevisionMutationRunner
} from './RevisionMutation'
import { promptCollection } from '../Collections/PromptCollection'
import { promptDraftCollection } from '../Collections/PromptDraftCollection'
import { promptFolderDraftCollection } from '../Collections/PromptFolderDraftCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { systemSettingsDraftCollection } from '../Collections/SystemSettingsDraftCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'

export {
  mutatePacedUpdateTransaction,
  sendPacedUpdateTransactionIfPresent,
  submitPacedUpdateTransactionAndWait,
  submitAllPacedUpdateTransactionsAndWait
} from './RevisionMutationTransactionRegistry'

const revisionCollections = {
  systemSettings: systemSettingsCollection,
  workspace: workspaceCollection,
  promptFolder: promptFolderCollection,
  prompt: promptCollection
}

const optimisticCollections = {
  ...revisionCollections,
  promptDraft: promptDraftCollection,
  promptFolderDraft: promptFolderDraftCollection,
  systemSettingsDraft: systemSettingsDraftCollection
}

export const mutatePacedRevisionUpdateTransaction = createPacedRevisionUpdateMutationRunner(
  revisionCollections,
  optimisticCollections
)

export const runRevisionMutation = createRevisionMutationRunner(
  revisionCollections,
  optimisticCollections
)
