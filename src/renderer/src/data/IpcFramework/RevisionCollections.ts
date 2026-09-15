import {
  createPacedRevisionUpdateMutationRunner,
  createRevisionMutationRunner
} from './RevisionMutation'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import { promptFolderClientStateCollection } from '@renderer/data/Collections/PromptFolderClientStateCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { markdownContentUiStateCollection } from '@renderer/data/Collections/MarkdownContentUiStateCollection'
import { systemSettingsCollection } from '@renderer/data/Collections/SystemSettingsCollection'
import { systemSettingsClientStateCollection } from '@renderer/data/Collections/SystemSettingsClientStateCollection'
import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { workspacePromptFolderUiStateCollection } from '@renderer/data/Collections/WorkspacePromptFolderUiStateCollection'
import { accordionUiStateCollection } from '@renderer/data/Collections/AccordionUiStateCollection'

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
  accordionUiState: accordionUiStateCollection
}

const clientStateCollections = {
  promptClientState: promptClientStateCollection,
  promptTemplateClientState: promptTemplateClientStateCollection,
  promptFolderClientState: promptFolderClientStateCollection,
  systemSettingsClientState: systemSettingsClientStateCollection
}

const optimisticCollections = {
  ...revisionCollections,
  ...clientStateCollections
}

export const mutatePacedRevisionUpdateTransaction = createPacedRevisionUpdateMutationRunner(
  revisionCollections,
  optimisticCollections,
  clientStateCollections
)

export const runRevisionMutation = createRevisionMutationRunner(
  revisionCollections,
  optimisticCollections,
  clientStateCollections
)
