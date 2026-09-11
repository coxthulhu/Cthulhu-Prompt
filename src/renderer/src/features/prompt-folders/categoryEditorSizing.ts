import {
  estimateMonacoHeightPx,
  PROMPT_EDITOR_CARD_BORDER_WIDTH_PX,
  type PromptEditorSizingConfig
} from '../prompt-editor/promptEditorSizing'

/** Fixed title-area height for a category card. */
export const CATEGORY_EDITOR_TITLE_AREA_HEIGHT_PX = 56
/** Minimum visible Monaco line count in the management dialog. */
export const CATEGORY_DESCRIPTION_EDITOR_MIN_LINES = 1
/** Maximum visible Monaco line count in the management dialog. */
export const CATEGORY_DESCRIPTION_EDITOR_MAX_LINES = 35
/** Height of a category navigation card in the prompt-folder screen. */
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

/** Estimates Monaco content height for category-description dialog fields. */
export const estimateCategoryDescriptionMonacoHeight = (
  text: string | null,
  fontSize: number
): number => estimateMonacoHeightPx(text ?? '', getCategoryDescriptionSizingConfig(fontSize))

/** Returns the fixed virtual-row height for a category navigation card. */
export const getCategoryEditorCollapsedRowHeightPx = (): number =>
  Math.ceil(CATEGORY_EDITOR_COLLAPSED_HEIGHT_PX)
