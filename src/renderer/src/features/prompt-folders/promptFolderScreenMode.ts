import { PROMPT_STATUS_FOLDER_REGISTRY, PromptStatusFolderId } from '@shared/Prompt'

/** Screen modes use the same identities as persisted status groups. */
export const PromptFolderScreenMode = PromptStatusFolderId

/** Status group selected by the prompt-folder screen. */
export type PromptFolderScreenMode = PromptStatusFolderId

/** Returns registry metadata for a finalized view, or null for a category-ordered view. */
export const getFinalPromptFolderScreenModeDefinition = (mode: PromptFolderScreenMode) => {
  /** Shared group definition that owns the selected screen. */
  const definition = PROMPT_STATUS_FOLDER_REGISTRY[mode]
  return definition.ordering === 'finalizedAt'
    ? { ...definition, status: definition.entryStatus }
    : null
}
