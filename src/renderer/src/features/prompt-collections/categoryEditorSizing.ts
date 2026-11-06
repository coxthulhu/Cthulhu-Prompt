import { PROMPT_EDITOR_CARD_BORDER_WIDTH_PX } from '../prompt-editor/promptEditorSizing'

/** Fixed title-area height for a category card. */
export const CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX = 56
/** Height of a category navigation card in the prompt-collection screen. */
const CATEGORY_EDITOR_COLLAPSED_HEIGHT_PX =
  CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX + PROMPT_EDITOR_CARD_BORDER_WIDTH_PX * 2

/** Returns the fixed virtual-row height for a category navigation card. */
export const getCategoryEditorCollapsedRowHeightPx = (): number =>
  Math.ceil(CATEGORY_EDITOR_COLLAPSED_HEIGHT_PX)
