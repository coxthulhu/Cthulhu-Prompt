import {
  estimateMonacoHeightPx,
  EDITOR_CARD_SECTION_HEADER_HEIGHT_PX,
  EDITOR_SUBTITLE_BAR_HEIGHT_PX,
  MONACO_PADDING_PX,
  PROMPT_EDITOR_BODY_PADDING_TOP_PX,
  PROMPT_EDITOR_CARD_BORDER_WIDTH_PX,
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX,
  type PromptEditorSizingConfig
} from '../prompt-editor/promptEditorSizing'

/** Fixed title-area height for a category card. */
export const CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX = 56
/** Separator height between a category section header and editor. */
export const EDITOR_CARD_SECTION_SEPARATOR_HEIGHT_PX = 1
/** Top padding around the category description editor. */
export const SETTINGS_EDITOR_SECTION_PADDING_TOP_PX = PROMPT_EDITOR_BODY_PADDING_TOP_PX
/** Right padding around the category description editor. */
export const SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX = 10
/** Bottom padding around the category description editor. */
export const SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX = PROMPT_EDITOR_BODY_PADDING_TOP_PX
/** Left padding around the category description editor. */
export const SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX = 10

/** Fixed vertical chrome surrounding category description Monaco content. */
const SETTINGS_EDITOR_CHROME_PX =
  EDITOR_CARD_SECTION_HEADER_HEIGHT_PX +
  EDITOR_CARD_SECTION_SEPARATOR_HEIGHT_PX +
  SETTINGS_EDITOR_SECTION_PADDING_TOP_PX +
  SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX +
  MONACO_PADDING_PX
/** Vertical inset applied inside the category description editor. */
const SETTINGS_EDITOR_VERTICAL_INSET_PX = MONACO_PADDING_PX / 2
/** Minimum visible Monaco line count for a category description. */
export const CATEGORY_DESCRIPTION_EDITOR_MIN_LINES = 1
/** Maximum visible Monaco line count for a category description. */
export const CATEGORY_DESCRIPTION_EDITOR_MAX_LINES = 35

/** Top offset of category description Monaco content. */
export const SETTINGS_EDITOR_TOP_OFFSET_PX =
  SETTINGS_EDITOR_SECTION_PADDING_TOP_PX + SETTINGS_EDITOR_VERTICAL_INSET_PX

/** Left offset of category description Monaco content. */
export const SETTINGS_EDITOR_LEFT_OFFSET_PX = SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX
// The category editor card is also a bordered border-box CardSurface, so its
// fixed chrome includes both card borders.
/** Fixed expanded category-card chrome outside its description section. */
const CATEGORY_EDITOR_CARD_FIXED_HEIGHT_PX =
  CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX +
  EDITOR_SUBTITLE_BAR_HEIGHT_PX +
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX +
  PROMPT_EDITOR_CARD_BORDER_WIDTH_PX * 2
/** Height of a category card with its details collapsed. */
const CATEGORY_EDITOR_COLLAPSED_HEIGHT_PX =
  CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX + PROMPT_EDITOR_CARD_BORDER_WIDTH_PX * 2

/** Creates the Monaco sizing configuration for category descriptions. */
export const getCategoryDescriptionSizingConfig = (
  fontSize: number
): PromptEditorSizingConfig => ({
  fontSize,
  minLines: CATEGORY_DESCRIPTION_EDITOR_MIN_LINES,
  maxLines: CATEGORY_DESCRIPTION_EDITOR_MAX_LINES
})

/** Estimates the Monaco height required by a category description. */
export const estimateCategoryDescriptionMonacoHeight = (
  text: string | null,
  fontSize: number
): number => {
  return estimateMonacoHeightPx(text ?? '', getCategoryDescriptionSizingConfig(fontSize))
}

/** Converts a Monaco height to the full category-description section height. */
export const getCategoryDescriptionRowHeightPx = (monacoHeightPx: number): number => {
  return Math.ceil(SETTINGS_EDITOR_CHROME_PX + monacoHeightPx)
}

/** Extracts Monaco height from a measured category-description section height. */
export const getCategoryDescriptionMonacoHeightFromRowPx = (rowHeightPx: number): number => {
  return rowHeightPx - SETTINGS_EDITOR_CHROME_PX
}

/** Estimates the full category-description section height. */
export const estimateCategoryDescriptionRowHeight = (
  text: string | null,
  fontSize: number
): number => {
  return getCategoryDescriptionRowHeightPx(
    estimateCategoryDescriptionMonacoHeight(text, fontSize)
  )
}

/** Calculates an expanded category card height from its description section. */
export const getCategoryEditorCardHeightPx = (descriptionHeightPx: number): number => {
  return Math.ceil(
    CATEGORY_EDITOR_CARD_FIXED_HEIGHT_PX +
      descriptionHeightPx +
      (descriptionHeightPx > 0 ? PROMPT_EDITOR_SEPARATOR_HEIGHT_PX : 0)
  )
}

/** Returns the virtual-row height for a collapsed category card. */
export const getCategoryEditorCollapsedRowHeightPx = (): number =>
  Math.ceil(CATEGORY_EDITOR_COLLAPSED_HEIGHT_PX)

/** Returns the virtual-row height for an expanded category card. */
export const getCategoryEditorRowHeightPx = (descriptionHeightPx: number): number =>
  Math.ceil(getCategoryEditorCardHeightPx(descriptionHeightPx))
