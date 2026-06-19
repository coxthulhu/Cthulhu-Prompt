import {
  estimateMonacoHeightPx,
  MONACO_PADDING_PX,
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX,
  type PromptEditorSizingConfig
} from '../prompt-editor/promptEditorSizing'

const SETTINGS_TOP_PADDING_PX = 24
const TITLE_PAGE_LINE_HEIGHT_PX = 29
const SETTINGS_DESCRIPTION_CARD_MARGIN_TOP_PX = 16
const SETTINGS_CARD_GAP_PX = 24
export const PROMPT_FOLDER_SETTINGS_TITLE_AREA_HEIGHT_PX = 87
export const SETTINGS_EDITOR_SECTION_PADDING_TOP_PX = 8
export const SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX = 10
export const SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX = 10
export const SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX = 10

const SETTINGS_EDITOR_CHROME_PX =
  PROMPT_FOLDER_SETTINGS_TITLE_AREA_HEIGHT_PX +
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX +
  SETTINGS_EDITOR_SECTION_PADDING_TOP_PX +
  SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX +
  MONACO_PADDING_PX
const SETTINGS_EDITOR_VERTICAL_INSET_PX = MONACO_PADDING_PX / 2
export const PROMPT_FOLDER_SETTINGS_EDITOR_MIN_LINES = 1
export const PROMPT_FOLDER_SETTINGS_EDITOR_MAX_LINES = 30
const SETTINGS_HEADER_HEIGHT_PX = SETTINGS_TOP_PADDING_PX + TITLE_PAGE_LINE_HEIGHT_PX

export const PROMPT_FOLDER_SETTINGS_HEADER_ROW_HEIGHT_PX =
  SETTINGS_HEADER_HEIGHT_PX + SETTINGS_DESCRIPTION_CARD_MARGIN_TOP_PX
export const PROMPT_FOLDER_SETTINGS_COLLAPSED_HEADER_ROW_HEIGHT_PX = SETTINGS_HEADER_HEIGHT_PX

const SETTINGS_FIELD_ROW_FIXED_HEIGHT_PX = SETTINGS_EDITOR_CHROME_PX

const PROMPT_HEADER_PADDING_TOP_PX = 24

export const PROMPT_HEADER_ROW_HEIGHT_PX =
  PROMPT_HEADER_PADDING_TOP_PX + TITLE_PAGE_LINE_HEIGHT_PX
export const PROMPT_COLLAPSED_HEADER_ROW_HEIGHT_PX =
  PROMPT_HEADER_PADDING_TOP_PX + TITLE_PAGE_LINE_HEIGHT_PX

export const SETTINGS_EDITOR_TOP_OFFSET_PX =
  PROMPT_FOLDER_SETTINGS_TITLE_AREA_HEIGHT_PX +
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX +
  SETTINGS_EDITOR_SECTION_PADDING_TOP_PX +
  SETTINGS_EDITOR_VERTICAL_INSET_PX

export const SETTINGS_EDITOR_LEFT_OFFSET_PX = SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX

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

export const getPromptFolderSettingsFieldRowHeightPx = (
  monacoHeightPx: number,
  includeBottomGap: boolean
): number => {
  return Math.ceil(
    SETTINGS_FIELD_ROW_FIXED_HEIGHT_PX +
      monacoHeightPx +
      (includeBottomGap ? SETTINGS_CARD_GAP_PX : 0)
  )
}

export const getPromptFolderSettingsFieldMonacoHeightFromRowPx = (
  rowHeightPx: number,
  includeBottomGap: boolean
): number => {
  return (
    rowHeightPx - SETTINGS_FIELD_ROW_FIXED_HEIGHT_PX - (includeBottomGap ? SETTINGS_CARD_GAP_PX : 0)
  )
}

export const getPromptFolderSettingsCardHeightFromRowPx = (
  rowHeightPx: number,
  includeBottomGap: boolean
): number => rowHeightPx - (includeBottomGap ? SETTINGS_CARD_GAP_PX : 0)

export const estimatePromptFolderSettingsFieldRowHeight = (
  text: string,
  fontSize: number,
  includeBottomGap: boolean
): number => {
  return getPromptFolderSettingsFieldRowHeightPx(
    estimatePromptFolderSettingsMonacoHeight(text, fontSize),
    includeBottomGap
  )
}
