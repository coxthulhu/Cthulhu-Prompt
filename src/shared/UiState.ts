import type {
  WorkspaceAccordionSectionViewEntry,
  WorkspaceScreenSelection
} from './UserPersistence'

/** Persisted screen selection and last-root state for one workspace. */
export type WorkspaceUiState = WorkspaceScreenSelection & {
  workspaceId: string
  lastPromptFolderId: string | null
}

/** Persisted prompt-folder screen state for one root or category content owner. */
export type WorkspacePromptFolderUiState = {
  workspaceId: string
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded: boolean
  detailsSectionIsExpanded: boolean
  contentSectionIsExpanded: boolean
}

/** Persisted section state for one accordion instance in one workspace. */
export type AccordionUiState = {
  workspaceId: string
  persistenceId: string
  sections: WorkspaceAccordionSectionViewEntry[]
}

/** Persisted Monaco state for one category-description editor. */
export type CategoryDescriptionEditorUiState = {
  workspaceId: string
  categoryId: string
  editorViewStateJson: string
}

/** Builds the authoritative key for one workspace prompt-folder UI-state record. */
export const createWorkspacePromptFolderUiStateKey = (
  workspaceId: string,
  contentOwnerId: string
): string => `${workspaceId}:${contentOwnerId}`

/** Builds the authoritative key for one workspace accordion UI-state record. */
export const createAccordionUiStateKey = (
  workspaceId: string,
  persistenceId: string
): string => `${workspaceId}:${persistenceId}`

/** Builds the authoritative key for one category-description editor UI-state record. */
export const createCategoryDescriptionEditorUiStateKey = (
  workspaceId: string,
  categoryId: string
): string => `${workspaceId}:${categoryId}`
