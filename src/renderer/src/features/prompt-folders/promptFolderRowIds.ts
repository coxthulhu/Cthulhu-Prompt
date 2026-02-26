export const PROMPT_FOLDER_SETTINGS_ROW_ID = 'folder-settings'
export const OUTLINER_FOLDER_SETTINGS_ROW_ID = 'outliner-folder-settings'

export const promptEditorRowId = (promptId: string): string => `${promptId}-editor`
export const outlinerPromptRowId = (promptId: string): string => `outliner-${promptId}`

export const persistedOutlinerEntryIdToPromptFolderRowId = (entryId: string): string => {
  return entryId === PROMPT_FOLDER_SETTINGS_ROW_ID ? PROMPT_FOLDER_SETTINGS_ROW_ID : promptEditorRowId(entryId)
}

export const persistedOutlinerEntryIdToOutlinerRowId = (entryId: string): string => {
  return entryId === PROMPT_FOLDER_SETTINGS_ROW_ID
    ? OUTLINER_FOLDER_SETTINGS_ROW_ID
    : outlinerPromptRowId(entryId)
}

export const promptFolderSettingsFindEntityId = (promptFolderId: string): string =>
  `folder-settings:${promptFolderId}`
