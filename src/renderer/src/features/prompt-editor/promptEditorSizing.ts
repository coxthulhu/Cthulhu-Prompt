export const LINE_HEIGHT_PX = 20
export const MIN_MONACO_HEIGHT_PX = 60
const MAX_VISIBLE_LINES = 40
const MAX_MONACO_HEIGHT_PX = MAX_VISIBLE_LINES * LINE_HEIGHT_PX
export const TITLE_BAR_HEIGHT_PX = 32
export const MONACO_PADDING_PX = 10
export const ADDITIONAL_GAP_PX = 2
const ROW_CHROME_HEIGHT_PX = TITLE_BAR_HEIGHT_PX + MONACO_PADDING_PX + ADDITIONAL_GAP_PX

export const clampMonacoHeightPx = (heightPx: number): number => {
  return Math.min(Math.max(heightPx, MIN_MONACO_HEIGHT_PX), MAX_MONACO_HEIGHT_PX)
}

export const estimateMonacoHeightPx = (text: string): number => {
  const lineCount = Math.max(1, text.split('\n').length)
  return clampMonacoHeightPx(lineCount * LINE_HEIGHT_PX)
}

export const getRowHeightPx = (monacoHeightPx: number): number => {
  return Math.ceil(monacoHeightPx + ROW_CHROME_HEIGHT_PX)
}

export const getMonacoHeightFromRowPx = (rowHeightPx: number): number => {
  return rowHeightPx - ROW_CHROME_HEIGHT_PX
}

export const estimatePromptEditorHeight = (
  promptText: string,
  _widthPx: number,
  _heightPx: number
): number => {
  void _widthPx
  void _heightPx
  return getRowHeightPx(estimateMonacoHeightPx(promptText))
}
