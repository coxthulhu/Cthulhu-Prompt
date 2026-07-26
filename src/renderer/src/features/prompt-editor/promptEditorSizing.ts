// Match Monaco's default Windows line height ratio when lineHeight=0.
const LINE_HEIGHT_RATIO = 1.35
export const PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX = 56
export const EDITOR_SUBTITLE_BAR_HEIGHT_PX = 56
export const PROMPT_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX = 600
export const PROMPT_TEMPLATE_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX = 420
export const PROMPT_EDITOR_COMPACT_ACTION_ROW_HEIGHT_PX = 53
export const PROMPT_EDITOR_SIDEBAR_WIDTH_PX = 32
export const PROMPT_EDITOR_SEPARATOR_HEIGHT_PX = 1
export const PROMPT_EDITOR_BODY_PADDING_TOP_PX = 8
export const PROMPT_EDITOR_BODY_PADDING_RIGHT_PX = 10
export const PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX = 10
export const PROMPT_EDITOR_BODY_PADDING_LEFT_PX = 10
export const MONACO_PADDING_PX = 0
// CardSurface draws a 1px border on a border-box card whose outer height is
// pinned to the virtual row height, so row chrome must include both borders.
export const PROMPT_EDITOR_CARD_BORDER_WIDTH_PX = 1
export const isPromptEditorCompactLayout = (
  titleAreaWidthPx: number,
  compactLayoutMaxWidthPx = PROMPT_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX
): boolean => titleAreaWidthPx < compactLayoutMaxWidthPx

export const getPromptEditorTitleAreaWidthPx = (
  cardWidthPx: number,
  showSidebar: boolean
): number =>
  cardWidthPx -
  PROMPT_EDITOR_CARD_BORDER_WIDTH_PX * 2 -
  (showSidebar ? PROMPT_EDITOR_SIDEBAR_WIDTH_PX : 0)

export const getPromptEditorTitleAreaHeightPx = (
  titleAreaWidthPx: number,
  compactLayoutMaxWidthPx = PROMPT_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX
): number =>
  PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX +
  (isPromptEditorCompactLayout(titleAreaWidthPx, compactLayoutMaxWidthPx)
    ? PROMPT_EDITOR_COMPACT_ACTION_ROW_HEIGHT_PX
    : 0)

const getRowChromeHeightPx = (
  titleAreaWidthPx: number,
  compactLayoutMaxWidthPx = PROMPT_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX,
  subtitleBarHeightPx = 0
): number =>
  PROMPT_EDITOR_CARD_BORDER_WIDTH_PX * 2 +
  getPromptEditorTitleAreaHeightPx(titleAreaWidthPx, compactLayoutMaxWidthPx) +
  PROMPT_EDITOR_SEPARATOR_HEIGHT_PX +
  subtitleBarHeightPx +
  (subtitleBarHeightPx > 0 ? PROMPT_EDITOR_SEPARATOR_HEIGHT_PX : 0) +
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

export const getRowHeightPx = (
  monacoHeightPx: number,
  titleAreaWidthPx: number,
  compactLayoutMaxWidthPx = PROMPT_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX,
  subtitleBarHeightPx = 0
): number => {
  return Math.ceil(
    monacoHeightPx +
      getRowChromeHeightPx(titleAreaWidthPx, compactLayoutMaxWidthPx, subtitleBarHeightPx)
  )
}

export const getMonacoHeightFromRowPx = (
  rowHeightPx: number,
  titleAreaWidthPx: number,
  compactLayoutMaxWidthPx = PROMPT_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX,
  subtitleBarHeightPx = 0
): number => {
  return (
    rowHeightPx -
    getRowChromeHeightPx(titleAreaWidthPx, compactLayoutMaxWidthPx, subtitleBarHeightPx)
  )
}

export const estimatePromptEditorHeight = (
  promptText: string,
  titleAreaWidthPx: number,
  _heightPx: number,
  sizingConfig: PromptEditorSizingConfig,
  compactLayoutMaxWidthPx = PROMPT_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX,
  subtitleBarHeightPx = 0
): number => {
  void _heightPx
  return getRowHeightPx(
    estimateMonacoHeightPx(promptText, sizingConfig),
    titleAreaWidthPx,
    compactLayoutMaxWidthPx,
    subtitleBarHeightPx
  )
}
