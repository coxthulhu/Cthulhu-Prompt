// Match Monaco's default Windows line height ratio when lineHeight=0.
const LINE_HEIGHT_RATIO = 1.35
export const PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX = 67
export const PROMPT_EDITOR_SEPARATOR_HEIGHT_PX = 1
export const PROMPT_EDITOR_BODY_PADDING_TOP_PX = 8
export const PROMPT_EDITOR_BODY_PADDING_RIGHT_PX = 10
export const PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX = 10
export const PROMPT_EDITOR_BODY_PADDING_LEFT_PX = 10
export const MONACO_PADDING_PX = 0
const ROW_CHROME_HEIGHT_PX =
  PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX +
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX +
  PROMPT_EDITOR_BODY_PADDING_TOP_PX +
  PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX +
  MONACO_PADDING_PX

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
