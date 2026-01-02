// Shared selectors for prompt folder Playwright tests.
export const PROMPT_FOLDER_HOST_SELECTOR =
  '[data-testid="prompt-folder-screen"] [data-testid="virtual-window"]'
export const PROMPT_EDITOR_PREFIX_SELECTOR = '[data-testid^="prompt-editor-"]'
export const PROMPT_TITLE_SELECTOR = '[data-testid="prompt-title"]'
export const MONACO_PLACEHOLDER_SELECTOR = '[data-testid="monaco-placeholder"]'

export const promptEditorSelector = (promptId: string): string =>
  `[data-testid="prompt-editor-${promptId}"]`
