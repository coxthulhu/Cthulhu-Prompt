import {
  createPacedRevisionUpdateMutationRunner,
  createRevisionMutationRunner
} from './RevisionMutation'
import { promptCollection } from '../Collections/PromptCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { promptTemplateClientStateCollection } from '../Collections/PromptTemplateClientStateCollection'
import { promptClientStateCollection } from '../Collections/PromptClientStateCollection'
import { promptFolderClientStateCollection } from '../Collections/PromptFolderClientStateCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { markdownContentUiStateCollection } from '../Collections/MarkdownContentUiStateCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { systemSettingsClientStateCollection } from '../Collections/SystemSettingsClientStateCollection'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { categoryCollection } from '../Collections/CategoryCollection'
import { workspaceUiStateCollection } from '../Collections/WorkspaceUiStateCollection'
import { workspacePromptFolderUiStateCollection } from '../Collections/WorkspacePromptFolderUiStateCollection'
import { accordionUiStateCollection } from '../Collections/AccordionUiStateCollection'
import { categoryDescriptionEditorUiStateCollection } from '../Collections/CategoryDescriptionEditorUiStateCollection'

export {
  mutatePacedUpdateTransaction,
  sendPacedUpdateTransactionIfPresent,
  submitPacedUpdateTransactionAndWait,
  submitAllPacedUpdateTransactionsAndWait
} from './RevisionMutationTransactionRegistry'

const revisionCollections = {
  userPersistence: userPersistenceCollection,
  systemSettings: systemSettingsCollection,
  workspace: workspaceCollection,
  promptFolder: promptFolderCollection,
  category: categoryCollection,
  prompt: promptCollection,
  promptTemplate: promptTemplateCollection,
  markdownContentUiState: markdownContentUiStateCollection,
  workspaceUiState: workspaceUiStateCollection,
  workspacePromptFolderUiState: workspacePromptFolderUiStateCollection,
  accordionUiState: accordionUiStateCollection,
  categoryDescriptionEditorUiState: categoryDescriptionEditorUiStateCollection
}

const optimisticCollections = {
  ...revisionCollections,
  promptClientState: promptClientStateCollection,
  promptTemplateClientState: promptTemplateClientStateCollection,
  promptFolderClientState: promptFolderClientStateCollection,
  systemSettingsClientState: systemSettingsClientStateCollection
}

export const mutatePacedRevisionUpdateTransaction = createPacedRevisionUpdateMutationRunner(
  revisionCollections,
  optimisticCollections
)

export const runRevisionMutation = createRevisionMutationRunner(
  revisionCollections,
  optimisticCollections
)
