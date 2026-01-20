import {
  estimateMonacoHeightPx,
  MONACO_PADDING_PX,
} from '../prompt-editor/promptEditorSizing'

const HEADER_TOP_PADDING_PX = 24
const HEADER_TITLE_HEIGHT_PX = 32
const HEADER_LABEL_MARGIN_TOP_PX = 16
const HEADER_LABEL_HEIGHT_PX = 20
const HEADER_EDITOR_MARGIN_TOP_PX = 8
const HEADER_PROMPT_COUNT_MARGIN_TOP_PX = 24
const HEADER_PROMPT_COUNT_HEIGHT_PX = 28
const HEADER_PROMPT_COUNT_MARGIN_BOTTOM_PX = 16

const HEADER_EDITOR_CHROME_PX = MONACO_PADDING_PX
const HEADER_EDITOR_VERTICAL_INSET_PX = MONACO_PADDING_PX / 2

const HEADER_FIXED_HEIGHT_PX =
  HEADER_TOP_PADDING_PX +
  HEADER_TITLE_HEIGHT_PX +
  HEADER_LABEL_MARGIN_TOP_PX +
  HEADER_LABEL_HEIGHT_PX +
  HEADER_EDITOR_MARGIN_TOP_PX +
  HEADER_EDITOR_CHROME_PX +
  HEADER_PROMPT_COUNT_MARGIN_TOP_PX +
  HEADER_PROMPT_COUNT_HEIGHT_PX +
  HEADER_PROMPT_COUNT_MARGIN_BOTTOM_PX

export const HEADER_EDITOR_TOP_OFFSET_PX =
  HEADER_TOP_PADDING_PX +
  HEADER_TITLE_HEIGHT_PX +
  HEADER_LABEL_MARGIN_TOP_PX +
  HEADER_LABEL_HEIGHT_PX +
  HEADER_EDITOR_MARGIN_TOP_PX +
  HEADER_EDITOR_VERTICAL_INSET_PX

export const HEADER_EDITOR_LEFT_OFFSET_PX = 13

export const estimatePromptFolderDescriptionMonacoHeight = (text: string): number => {
  return estimateMonacoHeightPx(text)
}

export const getPromptFolderHeaderHeightPx = (monacoHeightPx: number): number => {
  return Math.ceil(HEADER_FIXED_HEIGHT_PX + monacoHeightPx)
}

export const estimatePromptFolderHeaderHeight = (text: string): number => {
  return getPromptFolderHeaderHeightPx(estimateMonacoHeightPx(text))
}
