// Match Monaco's default Windows line height ratio when lineHeight=0.
const LINE_HEIGHT_RATIO = 1.35
export const TITLE_BAR_HEIGHT_PX = 48
export const MONACO_PADDING_PX = 0
export const ADDITIONAL_GAP_PX = 17
const ROW_CARD_VERTICAL_PADDING_PX = 20
const ROW_CHROME_HEIGHT_PX =
  ROW_CARD_VERTICAL_PADDING_PX + TITLE_BAR_HEIGHT_PX + MONACO_PADDING_PX + ADDITIONAL_GAP_PX

export type PromptEditorSizingConfig = {
  fontSize: number
  minLines: number
  maxLines: number
}

export const getLineHeightPx = (fontSize: number): number =>
  Math.round(fontSize * LINE_HEIGHT_RATIO)

export const getMinMonacoHeightPx = (sizingConfig: PromptEditorSizingConfig): number =>
  getLineHeightPx(sizingConfig.fontSize) * sizingConfig.minLines

export const getMaxMonacoHeightPx = (sizingConfig: PromptEditorSizingConfig): number =>
  getLineHeightPx(sizingConfig.fontSize) * sizingConfig.maxLines

export const clampMonacoHeightPx = (
  heightPx: number,
  sizingConfig: PromptEditorSizingConfig
): number => {
  return Math.min(
    Math.max(heightPx, getMinMonacoHeightPx(sizingConfig)),
    getMaxMonacoHeightPx(sizingConfig)
  )
}

export const estimateMonacoHeightPx = (
  text: string,
  sizingConfig: PromptEditorSizingConfig
): number => {
  const lineCount = Math.max(1, text.split('\n').length)
  return clampMonacoHeightPx(lineCount * getLineHeightPx(sizingConfig.fontSize), sizingConfig)
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
  sizingConfig: PromptEditorSizingConfig
): number => {
  void _widthPx
  void _heightPx
  return getRowHeightPx(estimateMonacoHeightPx(promptText, sizingConfig))
}
