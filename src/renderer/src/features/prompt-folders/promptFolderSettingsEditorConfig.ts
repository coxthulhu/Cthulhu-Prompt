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
  },
  folderPrefix: {
    title: 'Prompt Folder Prefix',
    toggleText: 'Prefix',
    description:
      'Text to add before each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
    deleteLabel: 'prompt folder prefix',
    viewStateCapturePrefix: 'prompt-folder-prefix'
  },
  folderSuffix: {
    title: 'Prompt Folder Suffix',
    toggleText: 'Suffix',
    description:
      'Text to add after each prompt copied from this folder. Two line breaks are added between this and the prompt text.',
    deleteLabel: 'prompt folder suffix',
    viewStateCapturePrefix: 'prompt-folder-suffix'
  }
}
