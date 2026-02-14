import {
  createOpenRevisionUpdateMutationRunner,
  createRevisionMutationRunner
} from './RevisionMutation'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'

export {
  mutateOpenUpdateTransaction,
  sendOpenUpdateTransactionIfPresent,
  submitAllOpenUpdateTransactionsAndWait,
  getTransactionsForElement,
  type TransactionEntry
} from './RevisionMutationTransactionRegistry'

const revisionCollections = {
  systemSettings: systemSettingsCollection,
  workspace: workspaceCollection,
  promptFolder: promptFolderCollection,
  prompt: promptCollection
}

export const runRevisionMutation = createRevisionMutationRunner(revisionCollections)

export const mutateOpenRevisionUpdateTransaction =
  createOpenRevisionUpdateMutationRunner(revisionCollections)
