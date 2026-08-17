/** Minimal display identity used by category selectors. */
type PromptTreeCategoryIdentity = { displayName: string }

/** Minimal root-folder identity used by prompt visibility selectors. */
type PromptTreeFolderIdentity = { displayName: string; folderName?: string }

/** Produces the stable readable key used by existing prompt-tree selectors. */
const getFolderTestKey = (folder: PromptTreeFolderIdentity): string =>
  (folder.folderName ?? folder.displayName).replace(/\s+/g, '')

/** Produces the stable readable key used by category selectors. */
const getCategoryTestKey = (category: PromptTreeCategoryIdentity): string =>
  category.displayName.replace(/\s+/g, '')

/** Returns the settings-menu test ID for one category. */
export const categorySettingsTestId = (category: PromptTreeCategoryIdentity): string =>
  `prompt-tree-category-settings-menu-item-${getCategoryTestKey(category)}`

/** Returns the expansion-toggle test ID for one category. */
export const categoryToggleTestId = (category: PromptTreeCategoryIdentity): string =>
  `prompt-tree-category-toggle-button-${getCategoryTestKey(category)}`

/** Returns the open-button test ID for one category. */
export const categoryOpenTestId = (category: PromptTreeCategoryIdentity): string =>
  `prompt-tree-category-open-button-${getCategoryTestKey(category)}`

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

/** Returns the reorder drop-indicator test ID for one category. */
export const categoryDropIndicatorTestId = (category: PromptTreeCategoryIdentity): string =>
  `prompt-tree-drop-indicator-category-${getCategoryTestKey(category)}`

export const promptTreeBottomSpacerDropTargetTestId = 'prompt-tree-bottom-spacer-drop-target'

export const promptTreeBottomSpacerDropIndicatorTestId = 'prompt-tree-bottom-spacer-drop-indicator'

export const folderPromptVisibilityDropIndicatorTestId = (folder: PromptTreeFolderIdentity): string =>
  `prompt-tree-drop-indicator-prompt-visibility-${getFolderTestKey(folder)}`
