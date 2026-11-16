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

/** Returns the active tab to its collection browser. */
export const showAllCollectionsSelector =
  '[data-testid="sidebar-show-all-button"]'

/** Title of the collection displayed by the active tab. */
export const selectedCollectionTitleSelector =
  '[data-testid="sidebar-title"]'

/** New Tab screen containing selectable collections. */
export const collectionBrowserSelector =
  '[data-testid="new-tab-screen"]'

/** Selects a collection tile by its stable identity. */
export const collectionTileSelector = (collectionId: string): string =>
  `[data-testid="new-tab-collection-${collectionId}"]`
