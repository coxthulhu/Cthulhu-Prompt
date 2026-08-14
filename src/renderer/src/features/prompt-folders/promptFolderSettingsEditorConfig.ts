import type { PromptFolderSettingsField } from '@shared/PromptFolder'

export type PromptFolderSettingsEditorConfig = {
  title: string
  toggleText: string
  description: string
  deleteLabel: string
  viewStateCapturePrefix: string
}

export const PROMPT_FOLDER_SETTINGS_EDITOR_CONFIG: Record<
  PromptFolderSettingsField,
  PromptFolderSettingsEditorConfig
> = {
  folderDescription: {
    title: 'Folder Description',
    toggleText: 'Description',
    description:
      'A general description of this folder and the types of prompts that are within it. For informational use only.',
    deleteLabel: 'folder description',
    viewStateCapturePrefix: 'prompt-folder-description'
  }
}
