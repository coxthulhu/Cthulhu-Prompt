import type { Draft } from 'immer'
import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import type { CommittedStore } from './CommittedStore'
import { promptData } from './PromptData'
import { promptFolderData } from './PromptFolderData'
import { promptTemplateData } from './PromptTemplateData'
import { systemSettingsData } from './SystemSettingsData'
import { workspaceData } from './WorkspaceData'
import { categoryData } from './CategoryData'
import type { DomainTargetPolicy } from '@shared/DomainChanges'
import {
  accordionUiStateData,
  categoryDescriptionEditorUiStateData,
  markdownContentUiStateData,
  userPersistenceData,
  workspacePromptFolderUiStateData,
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
  promptFolder: promptFolderData,
  category: categoryData,
  prompt: promptData,
  promptTemplate: promptTemplateData,
  userPersistence: userPersistenceData,
  markdownContentUiState: markdownContentUiStateData,
  workspaceUiState: workspaceUiStateData,
  workspacePromptFolderUiState: workspacePromptFolderUiStateData,
  accordionUiState: accordionUiStateData,
  categoryDescriptionEditorUiState: categoryDescriptionEditorUiStateData
}
