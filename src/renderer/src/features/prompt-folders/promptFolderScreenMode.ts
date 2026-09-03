import { PromptStatus, PromptStatusFolderId } from '@shared/Prompt'

export enum PromptFolderScreenMode {
  Active = 'active',
  Completed = 'completed',
  Archived = 'archived'
}

/** Metadata for one automatically ordered final-status screen mode. */
export type FinalPromptFolderScreenModeDefinition = {
  status: PromptStatus.Completed | PromptStatus.Archived
  statusFolderId: PromptStatusFolderId.Completed | PromptStatusFolderId.Archived
  label: 'Completed' | 'Archived'
}

/** Final-status screen definitions keyed by their matching renderer mode. */
export const FINAL_PROMPT_FOLDER_SCREEN_MODES = {
  [PromptFolderScreenMode.Completed]: {
    status: PromptStatus.Completed,
    statusFolderId: PromptStatusFolderId.Completed,
    label: 'Completed'
  },
  [PromptFolderScreenMode.Archived]: {
    status: PromptStatus.Archived,
    statusFolderId: PromptStatusFolderId.Archived,
    label: 'Archived'
  }
} as const satisfies Partial<
  Record<PromptFolderScreenMode, FinalPromptFolderScreenModeDefinition>
>

/** Returns final-status metadata for a final screen mode, or null for Active. */
export const getFinalPromptFolderScreenModeDefinition = (
  mode: PromptFolderScreenMode
): FinalPromptFolderScreenModeDefinition | null =>
  mode === PromptFolderScreenMode.Active ? null : FINAL_PROMPT_FOLDER_SCREEN_MODES[mode]
