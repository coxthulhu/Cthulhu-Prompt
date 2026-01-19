import {
  LINE_HEIGHT_PX,
  MIN_MONACO_HEIGHT_PX,
  MONACO_PADDING_PX,
  clampMonacoHeightPx
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

const estimateMonacoHeightPx = (text: string): number => {
  const lineCount = Math.max(1, text.split('\n').length)
  return clampMonacoHeightPx(lineCount * LINE_HEIGHT_PX)
}

export const estimatePromptFolderDescriptionMonacoHeight = (text: string): number => {
  return Math.max(MIN_MONACO_HEIGHT_PX, estimateMonacoHeightPx(text))
}

export const getPromptFolderHeaderHeightPx = (monacoHeightPx: number): number => {
  return Math.ceil(HEADER_FIXED_HEIGHT_PX + monacoHeightPx)
}

export const estimatePromptFolderHeaderHeight = (text: string): number => {
  return getPromptFolderHeaderHeightPx(estimateMonacoHeightPx(text))
}
