export const PROMPT_FOLDER_SECTION_GUTTER_LINE_WIDTH_PX = 2
export const PROMPT_FOLDER_SECTION_GUTTER_FIRST_LINE_OFFSET_PX = 10
export const PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX = 24
export const PROMPT_FOLDER_SECTION_GUTTER_GAP_PX =
  PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX -
  PROMPT_FOLDER_SECTION_GUTTER_FIRST_LINE_OFFSET_PX -
  PROMPT_FOLDER_SECTION_GUTTER_LINE_WIDTH_PX
export const PROMPT_FOLDER_EDITOR_SIDE_RAIL_WIDTH_PX = 36

export const getPromptFolderSectionGutterWidthPx = (indentLevel: number): number => {
  if (indentLevel === 0) return 0

  return (
    PROMPT_FOLDER_SECTION_GUTTER_FIRST_LINE_OFFSET_PX +
    PROMPT_FOLDER_SECTION_GUTTER_LINE_WIDTH_PX +
    PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX * (indentLevel - 1)
  )
}

export const getPromptFolderSectionGutterGapPx = (indentLevel: number): number =>
  indentLevel === 0 ? 0 : PROMPT_FOLDER_SECTION_GUTTER_GAP_PX

export const getPromptFolderSectionContentOffsetPx = (indentLevel: number): number =>
  getPromptFolderSectionGutterWidthPx(indentLevel) + getPromptFolderSectionGutterGapPx(indentLevel)

export const getPromptFolderSectionContentWidthPx = (
  containerWidthPx: number,
  indentLevel: number,
  reservedWidthPx = 0
): number =>
  Math.max(
    0,
    containerWidthPx - getPromptFolderSectionContentOffsetPx(indentLevel) - reservedWidthPx
  )
