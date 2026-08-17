/** Minimal folder-style identity shared by roots and category rows. */
type PromptTreeFolderIdentity = { displayName: string; folderName?: string }

/** Produces the stable readable key used by existing prompt-tree selectors. */
const getFolderTestKey = (folder: PromptTreeFolderIdentity): string =>
  (folder.folderName ?? folder.displayName).replace(/\s+/g, '')

export const folderSettingsTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-folder-settings-menu-item-${getFolderTestKey(folder)}`

export const folderToggleTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-folder-toggle-button-${getFolderTestKey(folder)}`

export const folderOpenTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-folder-open-button-${getFolderTestKey(folder)}`

export const folderPromptTestId = (promptId: string): string => `prompt-tree-prompt-${promptId}`

export const folderPromptShowAllTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-folder-show-all-prompts-${getFolderTestKey(folder)}`

export const folderPromptShowLessTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-folder-show-less-prompts-${getFolderTestKey(folder)}`

export const folderPromptMenuShowAllTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-folder-menu-show-all-prompts-${getFolderTestKey(folder)}`

export const folderPromptMenuShowLessTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-folder-menu-show-less-prompts-${getFolderTestKey(folder)}`

export const folderPromptDropIndicatorTestId = (promptId: string): string =>
  `prompt-tree-drop-indicator-prompt-${promptId}`

export const folderDropIndicatorTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-drop-indicator-folder-${getFolderTestKey(folder)}`

export const promptTreeBottomSpacerDropTargetTestId = 'prompt-tree-bottom-spacer-drop-target'

export const promptTreeBottomSpacerDropIndicatorTestId = 'prompt-tree-bottom-spacer-drop-indicator'

export const folderPromptVisibilityDropIndicatorTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-drop-indicator-prompt-visibility-${getFolderTestKey(folder)}`
