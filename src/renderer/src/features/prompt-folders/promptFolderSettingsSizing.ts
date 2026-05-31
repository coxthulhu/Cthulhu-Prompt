import {
  ADDITIONAL_GAP_PX,
  estimateMonacoHeightPx,
  MONACO_PADDING_PX,
  TITLE_BAR_HEIGHT_PX,
  type PromptEditorSizingConfig
} from '../prompt-editor/promptEditorSizing'

const SETTINGS_TOP_PADDING_PX = 24
const SETTINGS_TITLE_HEIGHT_PX = 32
const SETTINGS_SUBTITLE_MARGIN_TOP_PX = 8
const SETTINGS_SUBTITLE_HEIGHT_PX = 20
const SETTINGS_DESCRIPTION_CARD_MARGIN_TOP_PX = 24
const SETTINGS_CARD_GAP_PX = 24
export const SETTINGS_DESCRIPTION_CARD_PADDING_PX = 10
export const SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX = 1
const SETTINGS_INFO_ROW_HEIGHT_PX = 32
const SETTINGS_INFO_ROW_ADDITIONAL_GAP_PX = 8

const SETTINGS_EDITOR_CHROME_PX =
  SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX * 2 +
  SETTINGS_DESCRIPTION_CARD_PADDING_PX * 2 +
  TITLE_BAR_HEIGHT_PX +
  ADDITIONAL_GAP_PX +
  SETTINGS_INFO_ROW_HEIGHT_PX +
  SETTINGS_INFO_ROW_ADDITIONAL_GAP_PX +
  MONACO_PADDING_PX
const SETTINGS_EDITOR_VERTICAL_INSET_PX = MONACO_PADDING_PX / 2
export const PROMPT_FOLDER_SETTINGS_EDITOR_MIN_LINES = 1
export const PROMPT_FOLDER_SETTINGS_EDITOR_MAX_LINES = 40
const SETTINGS_HEADER_HEIGHT_PX =
  SETTINGS_TOP_PADDING_PX +
  SETTINGS_TITLE_HEIGHT_PX +
  SETTINGS_SUBTITLE_MARGIN_TOP_PX +
  SETTINGS_SUBTITLE_HEIGHT_PX

const SETTINGS_FIXED_HEIGHT_PX =
  SETTINGS_HEADER_HEIGHT_PX +
  SETTINGS_DESCRIPTION_CARD_MARGIN_TOP_PX +
  SETTINGS_EDITOR_CHROME_PX * 3 +
  SETTINGS_CARD_GAP_PX * 2

const PROMPT_HEADER_PADDING_TOP_PX = 24
const PROMPT_HEADER_TEXT_HEIGHT_PX = 32
const PROMPT_HEADER_SUBTITLE_MARGIN_TOP_PX = 8
const PROMPT_HEADER_SUBTITLE_HEIGHT_PX = 20
const PROMPT_HEADER_PADDING_BOTTOM_PX = 4

export const PROMPT_HEADER_ROW_HEIGHT_PX =
  PROMPT_HEADER_PADDING_TOP_PX +
  PROMPT_HEADER_TEXT_HEIGHT_PX +
  PROMPT_HEADER_SUBTITLE_MARGIN_TOP_PX +
  PROMPT_HEADER_SUBTITLE_HEIGHT_PX +
  PROMPT_HEADER_PADDING_BOTTOM_PX

export const SETTINGS_EDITOR_TOP_OFFSET_PX =
  SETTINGS_HEADER_HEIGHT_PX +
  SETTINGS_DESCRIPTION_CARD_MARGIN_TOP_PX +
  SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX +
  SETTINGS_DESCRIPTION_CARD_PADDING_PX +
  TITLE_BAR_HEIGHT_PX +
  ADDITIONAL_GAP_PX +
  SETTINGS_INFO_ROW_HEIGHT_PX +
  SETTINGS_INFO_ROW_ADDITIONAL_GAP_PX +
  SETTINGS_EDITOR_VERTICAL_INSET_PX

export const SETTINGS_EDITOR_LEFT_OFFSET_PX =
  SETTINGS_DESCRIPTION_CARD_BORDER_WIDTH_PX + SETTINGS_DESCRIPTION_CARD_PADDING_PX + 12

export const getPromptFolderSettingsSizingConfig = (
  fontSize: number
): PromptEditorSizingConfig => ({
  fontSize,
  minLines: PROMPT_FOLDER_SETTINGS_EDITOR_MIN_LINES,
  maxLines: PROMPT_FOLDER_SETTINGS_EDITOR_MAX_LINES
})

export const estimatePromptFolderSettingsMonacoHeight = (
  text: string,
  fontSize: number
): number => {
  return estimateMonacoHeightPx(text, getPromptFolderSettingsSizingConfig(fontSize))
}

export const getPromptFolderSettingsHeightPx = (monacoHeightPx: number[]): number => {
  return Math.ceil(
    SETTINGS_FIXED_HEIGHT_PX + monacoHeightPx.reduce((sum, heightPx) => sum + heightPx, 0)
  )
}

export const getPromptFolderSettingsMonacoHeightFromRowPx = (rowHeightPx: number): number => {
  return rowHeightPx - SETTINGS_FIXED_HEIGHT_PX
}

export const getPromptFolderSettingsEditorTopOffsetPx = (
  sectionIndex: number,
  previousMonacoHeightsPx: number[]
): number => {
  return (
    SETTINGS_EDITOR_TOP_OFFSET_PX +
    sectionIndex * (SETTINGS_EDITOR_CHROME_PX + SETTINGS_CARD_GAP_PX) +
    previousMonacoHeightsPx.reduce((sum, heightPx) => sum + heightPx, 0)
  )
}

export const estimatePromptFolderSettingsHeight = (
  texts: string[],
  fontSize: number
): number => {
  return getPromptFolderSettingsHeightPx(
    texts.map((text) => estimatePromptFolderSettingsMonacoHeight(text, fontSize))
  )
}
