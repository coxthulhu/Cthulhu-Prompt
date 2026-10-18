import { noteData } from './NoteData'
import type { Draft } from 'immer'
import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import type { CommittedStore } from './CommittedStore'
import { promptData } from './PromptData'
import { promptCollectionData } from './PromptCollectionData'
import { promptTemplateData } from './PromptTemplateData'
import { systemSettingsData } from './SystemSettingsData'
import { workspaceData } from './WorkspaceData'
import { categoryData } from './CategoryData'
import type { DomainTargetPolicy } from '@shared/domain/DomainChanges'
import {
  accordionUiStateData,
  markdownContentUiStateData,
  userPersistenceData,
  workspacePromptCollectionUiStateData,
  workspaceUiStateData
} from './UiStateData'

export type DataRecipe<TData> = (draft: Draft<TData>) => void

export type RevisionData<TData, TPersistenceFields> = {
  committedStore: CommittedStore<TData, TPersistenceFields>
  persistence: PersistenceLayer<TData, TPersistenceFields>
  loadDataFromPersistence: (id: string, persistenceFields: TPersistenceFields) => Promise<void>
  emitCommittedRevisionChanged: (id: string) => void
  /** Missing-target deletion behavior for this authoritative collection. */
  targetPolicy: DomainTargetPolicy
}

export const data = {
  systemSettings: systemSettingsData,
  workspace: workspaceData,
  promptCollection: promptCollectionData,
  category: categoryData,
  note: noteData,
  prompt: promptData,
  promptTemplate: promptTemplateData,
  userPersistence: userPersistenceData,
  markdownContentUiState: markdownContentUiStateData,
  workspaceUiState: workspaceUiStateData,
  workspacePromptCollectionUiState: workspacePromptCollectionUiStateData,
  accordionUiState: accordionUiStateData
}
