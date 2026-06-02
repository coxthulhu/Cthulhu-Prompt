import type { PromptFolder } from '@shared/PromptFolder'

const getFolderTestKey = (folder: PromptFolder): string => folder.folderName.replace(/\s+/g, '')

export const folderSettingsTestId = (folder: PromptFolder): string =>
  `prompt-folder-settings-${getFolderTestKey(folder)}`

export const folderToggleTestId = (folder: PromptFolder): string =>
  `prompt-folder-toggle-${getFolderTestKey(folder)}`

export const folderOpenTestId = (folder: PromptFolder): string =>
  `regular-prompt-folder-${getFolderTestKey(folder)}`

export const folderOptionsTestId = (folder: PromptFolder): string =>
  `prompt-folder-options-${getFolderTestKey(folder)}`

export const folderPromptTestId = (promptId: string): string => `prompt-folder-prompt-${promptId}`

export const folderPromptShowAllTestId = (folder: PromptFolder): string =>
  `prompt-folder-show-all-${getFolderTestKey(folder)}`

export const folderPromptShowLessTestId = (folder: PromptFolder): string =>
  `prompt-folder-show-less-${getFolderTestKey(folder)}`

export const folderPromptMenuShowAllTestId = (folder: PromptFolder): string =>
  `prompt-folder-menu-show-all-${getFolderTestKey(folder)}`

export const folderPromptMenuShowLessTestId = (folder: PromptFolder): string =>
  `prompt-folder-menu-show-less-${getFolderTestKey(folder)}`

export const folderPromptDropIndicatorTestId = (promptId: string): string =>
  `prompt-tree-drop-indicator-prompt-${promptId}`

export const folderPromptVisibilityDropIndicatorTestId = (folder: PromptFolder): string =>
  `prompt-tree-drop-indicator-prompt-visibility-${getFolderTestKey(folder)}`

export const folderDropIndicatorTestId = (folder: PromptFolder): string =>
  `prompt-tree-drop-indicator-folder-${getFolderTestKey(folder)}`
