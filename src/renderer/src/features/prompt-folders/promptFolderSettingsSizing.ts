import {
  estimateMonacoHeightPx,
  MONACO_PADDING_PX,
  PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX,
  PROMPT_EDITOR_BODY_PADDING_TOP_PX,
  PROMPT_EDITOR_CARD_BORDER_WIDTH_PX,
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX,
  PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX,
  type PromptEditorSizingConfig
} from '../prompt-editor/promptEditorSizing'
import { PROMPT_FOLDER_SETTINGS_FIELDS, type PromptFolderSettingsField } from '@shared/PromptFolder'

export const PROMPT_FOLDER_EDITOR_ROW_PADDING_TOP_PX = 12
export const getPromptFolderEditorRowPaddingTopPx = (isRoot: boolean): number =>
  isRoot ? PROMPT_FOLDER_EDITOR_ROW_PADDING_TOP_PX : 0
export const PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX = PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX
const PROMPT_FOLDER_VIRTUAL_ROW_HEIGHT_GRID_PX = 4
export const EDITOR_CARD_SECTION_HEADER_HEIGHT_PX = 28
export const EDITOR_CARD_SECTION_SEPARATOR_HEIGHT_PX = 1
export const SETTINGS_EDITOR_SECTION_PADDING_TOP_PX = PROMPT_EDITOR_BODY_PADDING_TOP_PX
export const SETTINGS_EDITOR_SECTION_PADDING_RIGHT_PX = 10
export const SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX = PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX
export const SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX = 10

const SETTINGS_EDITOR_CHROME_PX =
  EDITOR_CARD_SECTION_HEADER_HEIGHT_PX +
  EDITOR_CARD_SECTION_SEPARATOR_HEIGHT_PX +
  SETTINGS_EDITOR_SECTION_PADDING_TOP_PX +
  SETTINGS_EDITOR_SECTION_PADDING_BOTTOM_PX +
  MONACO_PADDING_PX
const SETTINGS_EDITOR_VERTICAL_INSET_PX = MONACO_PADDING_PX / 2
export const PROMPT_FOLDER_SETTINGS_EDITOR_MIN_LINES = 1
export const PROMPT_FOLDER_SETTINGS_EDITOR_MAX_LINES = 30

export const SETTINGS_EDITOR_TOP_OFFSET_PX =
  SETTINGS_EDITOR_SECTION_PADDING_TOP_PX + SETTINGS_EDITOR_VERTICAL_INSET_PX

export const SETTINGS_EDITOR_LEFT_OFFSET_PX = SETTINGS_EDITOR_SECTION_PADDING_LEFT_PX
// The folder editor card is also a bordered border-box CardSurface, so its
// fixed chrome includes both card borders.
const FOLDER_EDITOR_CARD_FIXED_HEIGHT_PX =
  PROMPT_FOLDER_EDITOR_TITLE_AREA_HEIGHT_PX +
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX +
  PROMPT_EDITOR_CARD_BORDER_WIDTH_PX * 2

const normalizePromptFolderVirtualRowHeightPx = (heightPx: number): number => {
  if (heightPx <= 0) return 0
  return (
    Math.ceil(heightPx / PROMPT_FOLDER_VIRTUAL_ROW_HEIGHT_GRID_PX) *
    PROMPT_FOLDER_VIRTUAL_ROW_HEIGHT_GRID_PX
  )
}

export const getPromptFolderSettingsSizingConfig = (
  fontSize: number
): PromptEditorSizingConfig => ({
  fontSize,
  minLines: PROMPT_FOLDER_SETTINGS_EDITOR_MIN_LINES,
  maxLines: PROMPT_FOLDER_SETTINGS_EDITOR_MAX_LINES
})

export const estimatePromptFolderSettingsMonacoHeight = (
  text: string | null,
  fontSize: number
): number => {
  return estimateMonacoHeightPx(text ?? '', getPromptFolderSettingsSizingConfig(fontSize))
}

export const getPromptFolderSettingsFieldRowHeightPx = (monacoHeightPx: number): number => {
  return Math.ceil(SETTINGS_EDITOR_CHROME_PX + monacoHeightPx)
}

export const getPromptFolderSettingsFieldMonacoHeightFromRowPx = (rowHeightPx: number): number => {
  return rowHeightPx - SETTINGS_EDITOR_CHROME_PX
}

export const estimatePromptFolderSettingsFieldRowHeight = (
  text: string | null,
  fontSize: number
): number => {
  return getPromptFolderSettingsFieldRowHeightPx(
    estimatePromptFolderSettingsMonacoHeight(text, fontSize)
  )
}

export const getPromptFolderEditorCardHeightPx = (
  settingsFieldHeightsPx: Record<PromptFolderSettingsField, number>
): number => {
  return Math.ceil(
    FOLDER_EDITOR_CARD_FIXED_HEIGHT_PX +
      PROMPT_FOLDER_SETTINGS_FIELDS.reduce((sum, field) => sum + settingsFieldHeightsPx[field], 0)
  )
}

export const getPromptFolderEditorCollapsedCardRowHeightPx = (
  rowPaddingTopPx = PROMPT_FOLDER_EDITOR_ROW_PADDING_TOP_PX
): number => {
  return normalizePromptFolderVirtualRowHeightPx(
    rowPaddingTopPx + FOLDER_EDITOR_CARD_FIXED_HEIGHT_PX
  )
}

export const getPromptFolderEditorCardRowHeightPx = (
  settingsFieldHeightsPx: Record<PromptFolderSettingsField, number>,
  rowPaddingTopPx = PROMPT_FOLDER_EDITOR_ROW_PADDING_TOP_PX
): number => {
  return normalizePromptFolderVirtualRowHeightPx(
    rowPaddingTopPx + getPromptFolderEditorCardHeightPx(settingsFieldHeightsPx)
  )
}
