import type { PromptFolderContentKind } from '@shared/PromptFolder'

/** Compact sentence-case labels for empty sidebar content. */
export const emptyItemsLabel = (
  kind: PromptFolderContentKind,
  statusLabel?: string
): string => {
  const items = kind === 'template' ? 'templates' : 'prompts'
  const status = statusLabel ? `${statusLabel.toLowerCase()} ` : ''
  return `No ${status}${items}`
}

/** Folder views add context to the same compact label used by the sidebar. */
export const emptyFolderMessage = (
  kind: PromptFolderContentKind,
  statusLabel?: string
): string => `${emptyItemsLabel(kind, statusLabel)} in this folder.`

/** Keep typed creation instructions identical apart from the element name. */
export const createFirstItemMessage = (kind: PromptFolderContentKind): string => {
  const buttonLabel = kind === 'template' ? 'Template' : 'Prompt'
  return `Click the Add ${buttonLabel} button to create your first ${kind}.`
}

export const NO_TEMPLATE_LABEL = 'No template'
export const TEMPLATE_NOT_SELECTED_LABEL = 'Not selected'
