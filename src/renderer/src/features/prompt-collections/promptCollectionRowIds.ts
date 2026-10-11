export const CATEGORY_DETAILS_ROW_ID = 'category-details'
export const PROMPT_COLLECTION_HEADER_ROW_ID = 'collection-header'

/** Returns the virtual-row ID for one category editor. */
export const categoryEditorRowId = (categoryId: string): string =>
  `${CATEGORY_DETAILS_ROW_ID}:${categoryId}`

export const promptEditorRowId = (promptId: string): string => `${promptId}-editor`

export const promptDividerRowId = (promptId: string): string => `${promptId}-divider`

export const promptCollectionDividerRowId = (
  screenCollectionId: string,
  contentOwnerId: string,
  previousEntryId: string | null
): string => {
  if (previousEntryId !== null) return promptDividerRowId(previousEntryId)
  return contentOwnerId === screenCollectionId
    ? 'divider-initial'
    : `divider:${contentOwnerId}:initial`
}
