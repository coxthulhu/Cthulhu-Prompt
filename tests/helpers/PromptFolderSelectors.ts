// Shared selectors for prompt folder Playwright tests.
export const PROMPT_FOLDER_HOST_SELECTOR = '[data-testid="prompt-folder-virtual-window"]'
export const PROMPT_FOLDER_SPACER_SELECTOR = '[data-testid="prompt-folder-virtual-window-spacer"]'
export const PROMPT_EDITOR_PREFIX_SELECTOR = '[data-testid^="prompt-editor-"]'
export const PROMPT_TITLE_SELECTOR = '[data-testid="prompt-title"]'
export const PROMPT_TOKEN_COUNT_SELECTOR = '[data-testid="prompt-token-count"]'
export const PROMPT_MODIFIED_TIME_SELECTOR = '[data-testid="prompt-modified-time"]'
export const MONACO_PLACEHOLDER_SELECTOR = '[data-testid="monaco-placeholder"]'

export const promptEditorSelector = (promptId: string): string =>
  `[data-testid="prompt-editor-${promptId}"]`

/** Selects a prompt row in one explicit workflow or template tree. */
export const promptTreePromptSelector = (promptId: string, group: 'active' | 'completed' | 'archived' | 'backlog' | 'template' = 'active'): string =>
  `[data-testid="prompt-tree-${group}-prompt-${promptId}"]`

/** Returns the sidebar toggle selector for one category name. */
export const promptTreeCategorySelector = (categoryName: string, group: 'active' | 'backlog' | 'template' = 'active'): string =>
  `[data-testid="prompt-tree-${group}-category-toggle-button-${categoryName.replace(/\s+/g, '')}"]`

/** Shared trigger for the root-folder selector. */
export const promptFolderSelectorTriggerSelector =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'

/** Shared menu containing selectable root folders. */
export const promptFolderSelectorMenuSelector =
  '[data-testid="sidebar-prompt-folder-selector-menu"]'

/** Selects the dropdown row for a stable root-folder identity. */
export const promptFolderSelectorDropdownItemSelector = (folderId: string): string =>
  `[data-testid="sidebar-prompt-folder-dropdown-item-${folderId}"]`
