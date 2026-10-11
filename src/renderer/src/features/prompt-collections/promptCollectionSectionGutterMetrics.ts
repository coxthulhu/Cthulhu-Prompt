export const PROMPT_COLLECTION_SECTION_INSET_PX = 12
/** Width reserved for a category editor's drag rail and border. */
export const CATEGORY_EDITOR_SIDE_RAIL_WIDTH_PX = 36

export const getPromptCollectionSectionContentOffsetPx = (indentLevel: number): number =>
  PROMPT_COLLECTION_SECTION_INSET_PX * indentLevel

export const getPromptCollectionSectionContentWidthPx = (
  containerWidthPx: number,
  indentLevel: number,
  reservedWidthPx = 0
): number =>
  Math.max(
    0,
    containerWidthPx - getPromptCollectionSectionContentOffsetPx(indentLevel) * 2 - reservedWidthPx
  )
