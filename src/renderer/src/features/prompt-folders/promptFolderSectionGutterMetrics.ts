export const PROMPT_FOLDER_SECTION_INSET_PX = 12
export const PROMPT_FOLDER_EDITOR_SIDE_RAIL_WIDTH_PX = 36

export const getPromptFolderSectionContentOffsetPx = (indentLevel: number): number =>
  PROMPT_FOLDER_SECTION_INSET_PX * indentLevel

export const getPromptFolderSectionContentWidthPx = (
  containerWidthPx: number,
  indentLevel: number,
  reservedWidthPx = 0
): number =>
  Math.max(
    0,
    containerWidthPx - getPromptFolderSectionContentOffsetPx(indentLevel) * 2 - reservedWidthPx
  )
