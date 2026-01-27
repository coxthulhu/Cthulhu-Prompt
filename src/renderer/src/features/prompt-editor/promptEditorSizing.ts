// Match Monaco's default Windows line height ratio when lineHeight=0.
const LINE_HEIGHT_RATIO = 1.35
const MAX_VISIBLE_LINES = 40
export const TITLE_BAR_HEIGHT_PX = 32
export const MONACO_PADDING_PX = 10
export const ADDITIONAL_GAP_PX = 2
const ROW_CHROME_HEIGHT_PX = TITLE_BAR_HEIGHT_PX + MONACO_PADDING_PX + ADDITIONAL_GAP_PX

export const getLineHeightPx = (fontSize: number): number =>
  Math.round(fontSize * LINE_HEIGHT_RATIO)

export const getMinMonacoHeightPx = (fontSize: number, minLines: number): number =>
  getLineHeightPx(fontSize) * minLines

const getMaxMonacoHeightPx = (fontSize: number): number =>
  getLineHeightPx(fontSize) * MAX_VISIBLE_LINES

export const clampMonacoHeightPx = (
  heightPx: number,
  fontSize: number,
  minLines: number
): number => {
  return Math.min(
    Math.max(heightPx, getMinMonacoHeightPx(fontSize, minLines)),
    getMaxMonacoHeightPx(fontSize)
  )
}

export const estimateMonacoHeightPx = (
  text: string,
  fontSize: number,
  minLines: number
): number => {
  const lineCount = Math.max(1, text.split('\n').length)
  return clampMonacoHeightPx(lineCount * getLineHeightPx(fontSize), fontSize, minLines)
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
  _heightPx: number,
  fontSize: number,
  minLines: number
): number => {
  void _widthPx
  void _heightPx
  return getRowHeightPx(estimateMonacoHeightPx(promptText, fontSize, minLines))
}
