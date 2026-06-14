import type { PromptFolder } from '@shared/PromptFolder'

const getFolderTestKey = (folder: PromptFolder): string => folder.folderName.replace(/\s+/g, '')

export const folderSettingsTestId = (folder: PromptFolder): string =>
  `prompt-tree-folder-settings-menu-item-${getFolderTestKey(folder)}`

export const folderToggleTestId = (folder: PromptFolder): string =>
  `prompt-tree-folder-toggle-button-${getFolderTestKey(folder)}`

export const folderOpenTestId = (folder: PromptFolder): string =>
  `prompt-tree-folder-open-button-${getFolderTestKey(folder)}`

export const folderOptionsTestId = (folder: PromptFolder): string =>
  `prompt-tree-folder-options-button-${getFolderTestKey(folder)}`

export const folderPromptTestId = (promptId: string): string => `prompt-tree-prompt-${promptId}`

export const folderPromptShowAllTestId = (folder: PromptFolder): string =>
  `prompt-tree-folder-show-all-prompts-${getFolderTestKey(folder)}`

export const folderPromptShowLessTestId = (folder: PromptFolder): string =>
  `prompt-tree-folder-show-less-prompts-${getFolderTestKey(folder)}`

export const folderPromptMenuShowAllTestId = (folder: PromptFolder): string =>
  `prompt-tree-folder-menu-show-all-prompts-${getFolderTestKey(folder)}`

export const folderPromptMenuShowLessTestId = (folder: PromptFolder): string =>
  `prompt-tree-folder-menu-show-less-prompts-${getFolderTestKey(folder)}`

export const folderPromptDropIndicatorTestId = (promptId: string): string =>
  `prompt-tree-drop-indicator-prompt-${promptId}`

export const folderPromptVisibilityDropIndicatorTestId = (folder: PromptFolder): string =>
  `prompt-tree-drop-indicator-prompt-visibility-${getFolderTestKey(folder)}`
