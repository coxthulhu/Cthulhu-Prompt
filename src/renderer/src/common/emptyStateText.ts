import type { PromptCollectionContentKind } from '@shared/domain/prompt-collection/PromptCollection'

/** Compact sentence-case labels for empty sidebar content. */
export const emptyItemsLabel = (
  kind: PromptCollectionContentKind,
  statusLabel?: string
): string => {
  const items = kind === 'template' ? 'templates' : 'prompts'
  const status = statusLabel ? `${statusLabel.toLowerCase()} ` : ''
  return `No ${status}${items}`
}

/** Collection views add context to the same compact label used by the sidebar. */
export const emptyCollectionMessage = (
  kind: PromptCollectionContentKind,
  statusLabel?: string
): string => `${emptyItemsLabel(kind, statusLabel)} in this collection.`

/** Keep typed creation instructions identical apart from the element name. */
export const createFirstItemMessage = (kind: PromptCollectionContentKind): string => {
  const buttonLabel = kind === 'template' ? 'Template' : 'Prompt'
  return `Click the Add ${buttonLabel} button to create your first ${kind}.`
}

export const NO_TEMPLATE_LABEL = 'No template'
export const TEMPLATE_NOT_SELECTED_LABEL = 'Not selected'
