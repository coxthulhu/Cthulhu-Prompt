import { estimateMonacoHeightPx, MONACO_PADDING_PX } from '../prompt-editor/promptEditorSizing'

const SETTINGS_TOP_PADDING_PX = 24
const SETTINGS_TITLE_HEIGHT_PX = 28
const SETTINGS_TITLE_MARGIN_BOTTOM_PX = 8
const SETTINGS_LABEL_HEIGHT_PX = 20
const SETTINGS_EDITOR_MARGIN_TOP_PX = 8

const SETTINGS_EDITOR_CHROME_PX = MONACO_PADDING_PX
const SETTINGS_EDITOR_VERTICAL_INSET_PX = MONACO_PADDING_PX / 2

const SETTINGS_FIXED_HEIGHT_PX =
  SETTINGS_TOP_PADDING_PX +
  SETTINGS_TITLE_HEIGHT_PX +
  SETTINGS_TITLE_MARGIN_BOTTOM_PX +
  SETTINGS_LABEL_HEIGHT_PX +
  SETTINGS_EDITOR_MARGIN_TOP_PX +
  SETTINGS_EDITOR_CHROME_PX

const PROMPT_HEADER_PADDING_TOP_PX = 24
const PROMPT_HEADER_TEXT_HEIGHT_PX = 28
const PROMPT_HEADER_PADDING_BOTTOM_PX = 16

export const PROMPT_HEADER_ROW_HEIGHT_PX =
  PROMPT_HEADER_PADDING_TOP_PX + PROMPT_HEADER_TEXT_HEIGHT_PX + PROMPT_HEADER_PADDING_BOTTOM_PX

export const SETTINGS_EDITOR_TOP_OFFSET_PX =
  SETTINGS_TOP_PADDING_PX +
  SETTINGS_TITLE_HEIGHT_PX +
  SETTINGS_TITLE_MARGIN_BOTTOM_PX +
  SETTINGS_LABEL_HEIGHT_PX +
  SETTINGS_EDITOR_MARGIN_TOP_PX +
  SETTINGS_EDITOR_VERTICAL_INSET_PX

export const SETTINGS_EDITOR_LEFT_OFFSET_PX = 13

export const estimatePromptFolderSettingsMonacoHeight = (
  text: string,
  fontSize: number,
  minLines: number
): number => {
  return estimateMonacoHeightPx(text, fontSize, minLines)
}

export const getPromptFolderSettingsHeightPx = (monacoHeightPx: number): number => {
  return Math.ceil(SETTINGS_FIXED_HEIGHT_PX + monacoHeightPx)
}

export const getPromptFolderSettingsMonacoHeightFromRowPx = (rowHeightPx: number): number => {
  return rowHeightPx - SETTINGS_FIXED_HEIGHT_PX
}

export const estimatePromptFolderSettingsHeight = (
  text: string,
  fontSize: number,
  minLines: number
): number => {
  return getPromptFolderSettingsHeightPx(
    estimatePromptFolderSettingsMonacoHeight(text, fontSize, minLines)
  )
}
