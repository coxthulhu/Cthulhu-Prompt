import {
  createPacedRevisionUpdateMutationRunner,
  createRevisionMutationRunner
} from './RevisionMutation'
import { promptCollection } from '../Collections/PromptCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { promptTemplateDraftCollection } from '../Collections/PromptTemplateDraftCollection'
import { promptDraftCollection } from '../Collections/PromptDraftCollection'
import { promptFolderDraftCollection } from '../Collections/PromptFolderDraftCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { markdownContentUiStateCollection } from '../Collections/MarkdownContentUiStateCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { systemSettingsFormDataCollection } from '../Collections/SystemSettingsFormDataCollection'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { categoryCollection } from '../Collections/CategoryCollection'

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
  category: categoryCollection,
  prompt: promptCollection,
  promptTemplate: promptTemplateCollection,
  markdownContentUiState: markdownContentUiStateCollection
}

const optimisticCollections = {
  ...revisionCollections,
  promptDraft: promptDraftCollection,
  promptTemplateDraft: promptTemplateDraftCollection,
  promptFolderDraft: promptFolderDraftCollection,
  systemSettingsFormData: systemSettingsFormDataCollection
}

export const mutatePacedRevisionUpdateTransaction = createPacedRevisionUpdateMutationRunner(
  revisionCollections,
  optimisticCollections
)

export const runRevisionMutation = createRevisionMutationRunner(
  revisionCollections,
  optimisticCollections
)
