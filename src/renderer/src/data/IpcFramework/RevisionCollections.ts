import {
  createPacedRevisionUpdateMutationRunner,
  createRevisionMutationRunner
} from './RevisionMutation'
import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import { promptCollectionClientStateCollection } from '@renderer/data/Collections/PromptCollectionClientStateCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { markdownContentUiStateCollection } from '@renderer/data/Collections/MarkdownContentUiStateCollection'
import { systemSettingsCollection } from '@renderer/data/Collections/SystemSettingsCollection'
import { systemSettingsClientStateCollection } from '@renderer/data/Collections/SystemSettingsClientStateCollection'
import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { workspacePromptCollectionUiStateCollection } from '@renderer/data/Collections/WorkspacePromptCollectionUiStateCollection'
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
  promptCollection: promptCollectionsCollection,
  category: categoryCollection,
  prompt: promptsCollection,
  promptTemplate: promptTemplatesCollection,
  markdownContentUiState: markdownContentUiStateCollection,
  workspaceUiState: workspaceUiStateCollection,
  workspacePromptCollectionUiState: workspacePromptCollectionUiStateCollection,
  accordionUiState: accordionUiStateCollection
}

const clientStateCollections = {
  promptClientState: promptClientStateCollection,
  promptTemplateClientState: promptTemplateClientStateCollection,
  promptCollectionClientState: promptCollectionClientStateCollection,
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
