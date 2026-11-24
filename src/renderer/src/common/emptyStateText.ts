import { collectionItemLabel, type PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'

/** Compact sentence-case labels for empty sidebar content. */
export const emptyItemsLabel = (
  kind: PromptCollectionKind,
  statusLabel?: string
): string => {
  const items = `${kind}s`
  const status = statusLabel ? `${statusLabel.toLowerCase()} ` : ''
  return `No ${status}${items}`
}

/** Collection views add context to the same compact label used by the sidebar. */
export const emptyCollectionMessage = (
  kind: PromptCollectionKind,
  statusLabel?: string
): string => `${emptyItemsLabel(kind, statusLabel)} in this collection.`

/** Keep typed creation instructions identical apart from the element name. */
export const createFirstItemMessage = (kind: PromptCollectionKind): string => {
  const buttonLabel = collectionItemLabel[kind]
  return `Click the Add ${buttonLabel} button to create your first ${kind}.`
}

export const NO_TEMPLATE_LABEL = 'No template'
export const TEMPLATE_NOT_SELECTED_LABEL = 'Not selected'
