// Shared selectors for prompt collection Playwright tests.
export const PROMPT_COLLECTION_HOST_SELECTOR = '[data-testid="prompt-collection-virtual-window"]'
export const PROMPT_COLLECTION_SPACER_SELECTOR = '[data-testid="prompt-collection-virtual-window-spacer"]'
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

/** Shared trigger for the collection selector. */
export const promptCollectionSelectorTriggerSelector =
  '[data-testid="sidebar-prompt-collection-selector-trigger"]'

/** Selected collection remains visible in the quick list even outside the first three. */
export const selectedQuickCollectionSelector =
  '[data-testid^="sidebar-quick-collection-"][aria-current="true"]'

/** Direct collection drop target and navigation button. */
export const quickCollectionSelector = (collectionId: string): string =>
  `[data-testid="sidebar-quick-collection-${collectionId}"]`

/** Shared menu containing selectable collections. */
export const promptCollectionSelectorMenuSelector =
  '[data-testid="sidebar-prompt-collection-selector-menu"]'

/** Selects the dropdown row for a stable collection identity. */
export const promptCollectionSelectorDropdownItemSelector = (collectionId: string): string =>
  `[data-testid="sidebar-prompt-collection-dropdown-item-${collectionId}"]`
