import type { PromptStatusFolderId } from '@shared/Prompt'

/** Namespace identifying one prompt workflow or the status-free template tree. */
export type PromptTreeTestIdGroup = `${PromptStatusFolderId}` | 'template'

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
export const categorySettingsTestId = (category: PromptTreeCategoryIdentity, group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-category-settings-menu-item-${getCategoryTestKey(category)}`

/** Returns the open-menu test ID for one category. */
export const categoryOpenMenuItemTestId = (category: PromptTreeCategoryIdentity, group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-category-open-menu-item-${getCategoryTestKey(category)}`

/** Returns the expansion-toggle test ID for one category. */
export const categoryToggleTestId = (category: PromptTreeCategoryIdentity, group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-category-toggle-button-${getCategoryTestKey(category)}`

/** Returns the add-to-top button test ID for one category. */
export const categoryAddToTopTestId = (category: PromptTreeCategoryIdentity, group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-category-add-to-top-button-${getCategoryTestKey(category)}`

/** Returns a prompt or template row's group-qualified identity. */
export const folderPromptTestId = (promptId: string, group: PromptTreeTestIdGroup): string => `prompt-tree-${group}-prompt-${promptId}`

/** Returns the show-all action identity in one tree. */
export const folderPromptMenuShowAllTestId = (folder: PromptTreeFolderIdentity, group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-folder-menu-show-all-prompts-${getFolderTestKey(folder)}`

/** Returns the show-less action identity in one tree. */
export const folderPromptMenuShowLessTestId = (folder: PromptTreeFolderIdentity, group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-folder-menu-show-less-prompts-${getFolderTestKey(folder)}`

/** Returns a group-qualified prompt placement indicator. */
export const folderPromptDropIndicatorTestId = (promptId: string, group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-drop-indicator-prompt-${promptId}`

/** Returns the reorder drop-indicator test ID for one category. */
export const categoryDropIndicatorTestId = (category: PromptTreeCategoryIdentity, group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-drop-indicator-category-${getCategoryTestKey(category)}`

/** Returns the bottom drop target in one tree namespace. */
export const promptTreeBottomSpacerDropTargetTestId = (group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-bottom-spacer-drop-target`

/** Returns the bottom drop indicator in one tree namespace. */
export const promptTreeBottomSpacerDropIndicatorTestId = (group: PromptTreeTestIdGroup): string =>
  `prompt-tree-${group}-bottom-spacer-drop-indicator`
