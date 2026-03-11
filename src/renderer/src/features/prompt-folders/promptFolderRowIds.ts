export const PROMPT_FOLDER_SETTINGS_ROW_ID = 'folder-settings'

export const promptEditorRowId = (promptId: string): string => `${promptId}-editor`

export const promptFolderSettingsFindEntityId = (promptFolderId: string): string =>
  `folder-settings:${promptFolderId}`
