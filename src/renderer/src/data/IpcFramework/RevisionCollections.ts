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
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { userPersistenceDraftCollection } from '../Collections/UserPersistenceDraftCollection'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'

export {
  mutatePacedUpdateTransaction,
  sendPacedUpdateTransactionIfPresent,
  submitPacedUpdateTransactionAndWait,
  submitAllPacedUpdateTransactionsAndWait
} from './RevisionMutationTransactionRegistry'

const revisionCollections = {
  userPersistence: userPersistenceCollection,
  workspacePersistence: workspacePersistenceCollection,
  systemSettings: systemSettingsCollection,
  workspace: workspaceCollection,
  promptFolder: promptFolderCollection,
  prompt: promptCollection
}

const optimisticCollections = {
  ...revisionCollections,
  promptDraft: promptDraftCollection,
  promptFolderDraft: promptFolderDraftCollection,
  systemSettingsDraft: systemSettingsDraftCollection,
  userPersistenceDraft: userPersistenceDraftCollection,
  workspacePersistenceDraft: workspacePersistenceDraftCollection
}

export const mutatePacedRevisionUpdateTransaction = createPacedRevisionUpdateMutationRunner(
  revisionCollections,
  optimisticCollections
)

export const runRevisionMutation = createRevisionMutationRunner(
  revisionCollections,
  optimisticCollections
)
