export const CATEGORY_DETAILS_ROW_ID = 'category-details'
export const PROMPT_FOLDER_ROOT_HEADER_ROW_ID = 'root-header'

/** Returns the virtual-row ID for one category editor. */
export const categoryEditorRowId = (categoryId: string): string =>
  `${CATEGORY_DETAILS_ROW_ID}:${categoryId}`

export const promptEditorRowId = (promptId: string): string => `${promptId}-editor`

export const promptDividerRowId = (promptId: string): string => `${promptId}-divider`

export const promptFolderDividerRowId = (
  screenRootFolderId: string,
  contentOwnerId: string,
  previousEntryId: string | null
): string => {
  if (previousEntryId !== null) return promptDividerRowId(previousEntryId)
  return contentOwnerId === screenRootFolderId
    ? 'divider-initial'
    : `divider:${contentOwnerId}:initial`
}

/** Returns the find entity ID for one category description. */
export const categoryDescriptionFindEntityId = (categoryId: string): string =>
  `category-description:${categoryId}`
