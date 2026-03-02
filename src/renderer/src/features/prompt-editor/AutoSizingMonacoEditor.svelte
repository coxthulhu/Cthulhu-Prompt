<script lang="ts">
  import { onMount } from 'svelte'
  import { monaco, PROMPT_EDITOR_THEME } from '@renderer/common/Monaco'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import { FindController } from 'monaco-editor/esm/vs/editor/contrib/find/browser/findController'
  import { FindModelBoundToEditorModel } from '@codingame/monaco-vscode-api/vscode/vs/editor/contrib/find/browser/findModel'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { registerMonacoEditor, unregisterMonacoEditor } from './MonacoEditorRegistry'
  import { clampMonacoHeightPx, getMinMonacoHeightPx } from './promptEditorSizing'
  import type { PromptFolderFindRequest } from '../prompt-folders/find/promptFolderFindTypes'

  type Props = {
    initialValue: string
    containerWidthPx: number
    overflowWidgetsDomNode: HTMLElement
    rowId: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onChange?: (value: string, meta: { didResize: boolean; heightPx: number }) => void
    onBlur?: () => void
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
    findSectionKey: string
    findRequest?: PromptFolderFindRequest | null
    onFindMatches?: (query: string, count: number) => void
    onFindMatchReveal?: (
      handler: ((query: string, matchIndex: number) => number | null) | null
    ) => void
    onSelectionChange?: (startOffset: number, endOffset: number) => void
  }

  let {
    initialValue,
    containerWidthPx,
    overflowWidgetsDomNode,
    rowId,
    scrollToWithinWindowBand,
    onChange,
    onBlur,
    onEditorLifecycle,
    findSectionKey,
    findRequest,
    onFindMatches,
    onFindMatchReveal,
    onSelectionChange
  }: Props = $props()

  const systemSettings = getSystemSettingsContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const promptEditorMinLines = $derived(systemSettings.promptEditorMinLines)
  const minMonacoHeightPx = $derived(getMinMonacoHeightPx(promptFontSize, promptEditorMinLines))

  let container: HTMLDivElement | null = null
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  let monacoHeightPx = $state(0)
  let lastContainerWidthPx = 0
  let isLayingOut = false
  let pendingCursorPosition: monaco.IPosition | null = null
  let findController: FindController | null = null
  let findModel: FindModelBoundToEditorModel | null = null
  let lastFindQuery = ''
  let lastActiveMatchIndex: number | null = null
  let lastReportedFindQuery = ''
  let lastReportedFindCount = -1
  let lastFontSizeEffectEditor: monaco.editor.IStandaloneCodeEditor | null = null
  let lastAppliedPromptFontSize: number | null = null
  let lastAppliedPromptEditorMinLines: number | null = null

  const getFindController = () => {
    if (!editor) return null
    findController ??= FindController.get(editor)
    return findController
  }

  const resetFindModel = (controller: FindController) => {
    findModel?.dispose()
    findModel = new FindModelBoundToEditorModel(editor!, controller.getState())
  }

  const clearFindState = () => {
    findModel?.dispose()
    findModel = null
    lastFindQuery = ''
    lastActiveMatchIndex = null
    lastReportedFindQuery = ''
    lastReportedFindCount = -1
  }

  const reportFindMatches = (query: string, count: number) => {
    if (query === lastReportedFindQuery && count === lastReportedFindCount) return
    lastReportedFindQuery = query
    lastReportedFindCount = count
    onFindMatches?.(query, count)
  }

  const measureContentHeightPx = (): number => {
    if (!editor) return monacoHeightPx
    return clampMonacoHeightPx(
      Math.ceil(editor.getContentHeight()),
      promptFontSize,
      promptEditorMinLines
    )
  }

  const layoutEditor = (nextHeightPx?: number): number => {
    if (isLayingOut || !editor || !container) return monacoHeightPx

    const measuredWidthPx = Math.round(container.getBoundingClientRect().width)
    if (measuredWidthPx <= 0) return monacoHeightPx

    isLayingOut = true
    try {
      editor.layout({ width: measuredWidthPx, height: monacoHeightPx })

      const clampedHeightPx = nextHeightPx ?? measureContentHeightPx()

      if (monacoHeightPx !== clampedHeightPx) {
        monacoHeightPx = clampedHeightPx
        editor.layout({ width: measuredWidthPx, height: clampedHeightPx })
      }

      return clampedHeightPx
    } finally {
      isLayingOut = false
    }
  }

  const emitChange = (value: string, didResize: boolean, heightPx: number) => {
    onChange?.(value, { didResize, heightPx })
  }

  const focusEditor = (
    targetEditor: monaco.editor.IStandaloneCodeEditor,
    options: FocusOptions = { preventScroll: true }
  ) => {
    const domNode = targetEditor.getDomNode()
    if (!domNode) return

    const focusTarget =
      domNode.querySelector<HTMLElement>('.inputarea.monaco-mouse-cursor-text') ??
      domNode.querySelector<HTMLElement>('.native-edit-context') ??
      domNode.querySelector<HTMLElement>('.ime-text-area')
    focusTarget?.focus(options)
  }

  const getCursorMetrics = (position: monaco.IPosition) => {
    if (!editor) return null
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight)
    const visiblePosition = editor.getScrolledVisiblePosition(position)
    if (!visiblePosition) return null
    const scrollTop = editor.getScrollTop()
    const viewportHeight = editor.getLayoutInfo().height
    const viewportBottom = scrollTop + viewportHeight
    const lineTop = scrollTop + visiblePosition.top
    const lineBottom = lineTop + lineHeight
    const isVisible = visiblePosition.top + lineHeight > 0 && visiblePosition.top < viewportHeight
    const topInViewport = Math.min(
      Math.max(visiblePosition.top, 0),
      Math.max(0, viewportHeight - lineHeight)
    )

    return {
      lineHeight,
      lineTop,
      lineBottom,
      scrollTop,
      viewportHeight,
      viewportBottom,
      topInViewport,
      isVisible
    }
  }

  const scrollCursorIntoBand = (position: monaco.IPosition | null) => {
    if (!scrollToWithinWindowBand || !position) return
    const centerOffsetPx = getRowCenterOffset(position)
    if (centerOffsetPx == null) return
    scrollToWithinWindowBand(rowId, centerOffsetPx, 'minimal')
  }

  const getRowCenterOffset = (position: monaco.IPosition): number | null => {
    const domNode = editor?.getDomNode()
    if (!domNode) return null
    const rowElement = domNode.closest('[data-virtual-window-row]') as HTMLElement | null
    if (!rowElement) return null
    const metrics = getCursorMetrics(position)
    if (!metrics || !metrics.isVisible) return null
    const rowRect = rowElement.getBoundingClientRect()
    const editorRect = domNode.getBoundingClientRect()
    return editorRect.top - rowRect.top + metrics.topInViewport + metrics.lineHeight / 2
  }

  const syncFindState = (
    trimmedQuery: string,
    options: { shouldClearSelection?: boolean } = {}
  ): boolean => {
    const controller = getFindController()
    if (!editor || !controller) return false

    const queryChanged = trimmedQuery !== lastFindQuery
    if (queryChanged) {
      lastFindQuery = trimmedQuery
      lastActiveMatchIndex = null
    }

    controller.getState().change(
      {
        searchString: trimmedQuery,
        isRegex: false,
        matchCase: false,
        wholeWord: false,
        preserveCase: false
      },
      false,
      false
    )

    if (!findModel || queryChanged || options.shouldClearSelection) {
      resetFindModel(controller)
    }

    findModel?.research(false)
    reportFindMatches(trimmedQuery, controller.getState().matchesCount)
    return true
  }

  const revealFindMatch = (query: string, matchIndex: number): number | null => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) return null

    if (!syncFindState(trimmedQuery)) return null

    if (matchIndex >= 0) {
      findModel?.moveToMatch(matchIndex)
      lastActiveMatchIndex = matchIndex
    }

    const selection = editor?.getSelection()
    if (!selection) return null
    return getRowCenterOffset({
      lineNumber: selection.startLineNumber,
      column: selection.startColumn
    })
  }

  const handleContentChange = () => {
    if (!editor) return
    const nextValue = editor.getValue()
    const nextHeightPx = measureContentHeightPx()
    const didResize = nextHeightPx !== monacoHeightPx

    if (didResize) {
      layoutEditor(nextHeightPx)
      scrollCursorIntoBand(editor.getPosition())
    }

    emitChange(nextValue, didResize, monacoHeightPx)
  }

  // Keep the virtual window centered on the primary cursor after Monaco reveals it.
  const handleCursorChange = (event: monaco.editor.ICursorPositionChangedEvent) => {
    if (!editor || !scrollToWithinWindowBand) return
    if (event.reason === monaco.editor.CursorChangeReason.RecoverFromMarkers) return
    if (event.reason === monaco.editor.CursorChangeReason.ContentFlush) return
    if (event.source === 'api') return
    if (event.source === 'mouse' && event.reason === monaco.editor.CursorChangeReason.Explicit)
      return

    const metrics = getCursorMetrics(event.position)
    const isVisible = metrics?.isVisible ?? false
    if (!isVisible) {
      pendingCursorPosition = event.position
      return
    }

    pendingCursorPosition = null
    scrollCursorIntoBand(event.position)
  }

  const handleEditorScroll = () => {
    if (!pendingCursorPosition) return
    const metrics = getCursorMetrics(pendingCursorPosition)
    const isVisible = metrics?.isVisible ?? false
    if (!isVisible) return
    scrollCursorIntoBand(pendingCursorPosition)
    pendingCursorPosition = null
  }

  // Side effect: keep the initial Monaco height aligned with the current font size.
  $effect(() => {
    if (editor) return
    monacoHeightPx = minMonacoHeightPx
  })

  // Side effect: create Monaco once the container is ready; dispose on unmount.
  onMount(() => {
    if (!container) return

    const measuredWidthPx = Math.round(container.getBoundingClientRect().width)
    if (measuredWidthPx <= 0) return

    const nextEditor = monaco.editor.create(container, {
      value: initialValue,
      language: 'markdown',
      automaticLayout: false,
      theme: PROMPT_EDITOR_THEME,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      wordWrapColumn: 80,
      fontSize: promptFontSize,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      scrollbar: { alwaysConsumeMouseWheel: false },
      revealHorizontalRightPadding: 0,
      cursorSmoothCaretAnimation: 'off',
      smoothScrolling: false,
      renderLineHighlightOnlyWhenFocus: true,
      overflowWidgetsDomNode,
      dimension: { width: measuredWidthPx, height: minMonacoHeightPx }
    })

    editor = nextEditor
    registerMonacoEditor({ container, editor: nextEditor })
    onEditorLifecycle?.(nextEditor, true)
    findController = FindController.get(nextEditor)

    const changeDisposable = nextEditor.onDidChangeModelContent(handleContentChange)
    const blurDisposable = nextEditor.onDidBlurEditorWidget(() => onBlur?.())
    const focusDisposable = nextEditor.onDidFocusEditorWidget(() => focusEditor(nextEditor))
    const cursorDisposable = nextEditor.onDidChangeCursorPosition(handleCursorChange)
    const selectionDisposable = nextEditor.onDidChangeCursorSelection((event) => {
      if (!onSelectionChange) return
      if (event.source === 'api') return
      const model = nextEditor.getModel()
      if (!model) return
      const startOffset = model.getOffsetAt(event.selection.getStartPosition())
      const endOffset = model.getOffsetAt(event.selection.getEndPosition())
      onSelectionChange(startOffset, endOffset)
    })
    const scrollDisposable = nextEditor.onDidScrollChange(handleEditorScroll)

    layoutEditor()
    lastContainerWidthPx = containerWidthPx
    emitChange(nextEditor.getValue(), false, monacoHeightPx)
    onFindMatchReveal?.(revealFindMatch)

    return () => {
      changeDisposable.dispose()
      blurDisposable.dispose()
      focusDisposable.dispose()
      cursorDisposable.dispose()
      selectionDisposable.dispose()
      scrollDisposable.dispose()
      unregisterMonacoEditor(nextEditor)
      onEditorLifecycle?.(nextEditor, false)
      onFindMatchReveal?.(null)
      nextEditor.dispose()
      editor = null
      findController = null
      clearFindState()
    }
  })

  // Side effect: apply font/min-lines relayout only when those settings change.
  $effect(() => {
    if (!editor) return
    const editorChanged = editor !== lastFontSizeEffectEditor
    const fontSizeChanged = promptFontSize !== lastAppliedPromptFontSize
    const minLinesChanged = promptEditorMinLines !== lastAppliedPromptEditorMinLines
    if (!editorChanged && !fontSizeChanged && !minLinesChanged) return

    lastFontSizeEffectEditor = editor
    lastAppliedPromptFontSize = promptFontSize
    lastAppliedPromptEditorMinLines = promptEditorMinLines

    if (editorChanged || fontSizeChanged) {
      editor.updateOptions({ fontSize: promptFontSize })
    }

    const previousHeightPx = monacoHeightPx
    const nextHeightPx = measureContentHeightPx()
    const updatedHeightPx = layoutEditor(nextHeightPx)
    emitChange(editor.getValue(), updatedHeightPx !== previousHeightPx, updatedHeightPx)
  })

  // Side effect: when the virtualized container width changes, relayout Monaco and sync cached height.
  $effect(() => {
    if (!editor) return
    if (containerWidthPx <= 0) return
    if (containerWidthPx === lastContainerWidthPx) return

    lastContainerWidthPx = containerWidthPx
    const previousHeightPx = monacoHeightPx
    const nextHeightPx = layoutEditor()
    emitChange(editor.getValue(), nextHeightPx !== previousHeightPx, nextHeightPx)
  })

  // Side effect: sync Monaco find highlights + match reporting with the external find widget state.
  $effect(() => {
    if (!editor) return
    const trimmedQuery = findRequest?.query.trim() ?? ''
    if (!findRequest?.isOpen || trimmedQuery.length === 0) {
      clearFindState()
      return
    }

    const activeSectionMatchIndex =
      findRequest.activeSectionKey === findSectionKey ? findRequest.activeSectionMatchIndex : null
    const shouldClearSelection = activeSectionMatchIndex == null && lastActiveMatchIndex != null

    if (!syncFindState(trimmedQuery, { shouldClearSelection })) return

    if (activeSectionMatchIndex != null && activeSectionMatchIndex >= 0) {
      findModel?.moveToMatch(activeSectionMatchIndex)
      lastActiveMatchIndex = activeSectionMatchIndex
    } else {
      lastActiveMatchIndex = null
    }
  })
</script>

<div bind:this={container} style={`min-height:${minMonacoHeightPx}px; position: relative;`}></div>
