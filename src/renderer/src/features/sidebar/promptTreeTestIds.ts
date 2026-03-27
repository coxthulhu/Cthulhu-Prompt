import type { PromptFolder } from '@shared/PromptFolder'

const getFolderTestKey = (folder: PromptFolder): string => folder.folderName.replace(/\s+/g, '')

export const folderSettingsTestId = (folder: PromptFolder): string =>
  `prompt-folder-settings-${getFolderTestKey(folder)}`

export const folderToggleTestId = (folder: PromptFolder): string =>
  `prompt-folder-toggle-${getFolderTestKey(folder)}`

export const folderOpenTestId = (folder: PromptFolder): string =>
  `regular-prompt-folder-${getFolderTestKey(folder)}`

export const folderIconTestId = (folder: PromptFolder): string =>
  `prompt-folder-icon-${getFolderTestKey(folder)}`

export const folderSettingsIconTestId = (folder: PromptFolder): string =>
  `prompt-folder-settings-icon-${getFolderTestKey(folder)}`

export const folderPromptTestId = (promptId: string): string => `prompt-folder-prompt-${promptId}`

export const folderSettingsDropIndicatorTestId = (folder: PromptFolder): string =>
  `prompt-tree-drop-indicator-settings-${getFolderTestKey(folder)}`

export const folderPromptDropIndicatorTestId = (promptId: string): string =>
  `prompt-tree-drop-indicator-prompt-${promptId}`
