<script lang="ts">
  import { onMount } from 'svelte'
  import { monaco, PROMPT_EDITOR_THEME } from '@renderer/common/Monaco'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { registerMonacoEditor, unregisterMonacoEditor } from './MonacoEditorRegistry'
  import { clampMonacoHeightPx, LINE_HEIGHT_PX, MIN_MONACO_HEIGHT_PX } from './promptEditorSizing'

  type Props = {
    initialValue: string
    containerWidthPx: number
    overflowWidgetsDomNode: HTMLElement
    rowId: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onChange?: (value: string, meta: { didResize: boolean; heightPx: number }) => void
    onBlur?: () => void
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
  }

  let {
    initialValue,
    containerWidthPx,
    overflowWidgetsDomNode,
    rowId,
    scrollToWithinWindowBand,
    onChange,
    onBlur,
    onEditorLifecycle
  }: Props = $props()

  let container: HTMLDivElement | null = null
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  let monacoHeightPx = MIN_MONACO_HEIGHT_PX
  let lastContainerWidthPx = 0
  let isLayingOut = false
  let pendingCursorPosition: monaco.IPosition | null = null

  const measureContentHeightPx = (): number => {
    if (!editor) return monacoHeightPx
    return clampMonacoHeightPx(Math.ceil(editor.getContentHeight()))
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
    targetEditor
      .getDomNode()
      ?.querySelector<HTMLTextAreaElement>('.inputarea.monaco-mouse-cursor-text')
      ?.focus(options)
  }

  const getCursorMetrics = (position: monaco.IPosition | null) => {
    if (!editor || !position) return null
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight)
    const lineTop = editor.getTopForLineNumber(position.lineNumber)
    const scrollTop = editor.getScrollTop()
    const viewportHeight = editor.getLayoutInfo().height
    const viewportBottom = scrollTop + viewportHeight
    const lineBottom = lineTop + lineHeight
    const isVisible = lineBottom > scrollTop && lineTop < viewportBottom
    const topInViewport = Math.min(
      Math.max(lineTop - scrollTop, 0),
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
    if (!editor || !scrollToWithinWindowBand || !position) return

    const domNode = editor.getDomNode()
    if (!domNode) return
    const rowElement = domNode.closest('[data-prompt-editor-row]') as HTMLElement | null
    if (!rowElement) return

    const metrics = getCursorMetrics(position)
    if (!metrics) return

    const rowRect = rowElement.getBoundingClientRect()
    const editorRect = domNode.getBoundingClientRect()
    const centerOffsetPx =
      editorRect.top - rowRect.top + metrics.topInViewport + metrics.lineHeight / 2
    scrollToWithinWindowBand(rowId, centerOffsetPx, 'minimal')
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
    if (event.source === 'mouse' && event.reason === monaco.editor.CursorChangeReason.Explicit) return

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
      fontSize: 16,
      lineHeight: LINE_HEIGHT_PX,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      scrollbar: { alwaysConsumeMouseWheel: false },
      revealHorizontalRightPadding: 0,
      cursorSmoothCaretAnimation: 'off',
      smoothScrolling: false,
      renderLineHighlightOnlyWhenFocus: true,
      overflowWidgetsDomNode,
      dimension: { width: measuredWidthPx, height: MIN_MONACO_HEIGHT_PX }
    })

    editor = nextEditor
    registerMonacoEditor({ container, editor: nextEditor })
    onEditorLifecycle?.(nextEditor, true)

    const changeDisposable = nextEditor.onDidChangeModelContent(handleContentChange)
    const blurDisposable = nextEditor.onDidBlurEditorWidget(() => onBlur?.())
    const focusDisposable = nextEditor.onDidFocusEditorWidget(() => focusEditor(nextEditor))
    const cursorDisposable = nextEditor.onDidChangeCursorPosition(handleCursorChange)
    const scrollDisposable = nextEditor.onDidScrollChange(handleEditorScroll)

    layoutEditor()
    lastContainerWidthPx = containerWidthPx
    emitChange(nextEditor.getValue(), false, monacoHeightPx)

    return () => {
      changeDisposable.dispose()
      blurDisposable.dispose()
      focusDisposable.dispose()
      cursorDisposable.dispose()
      scrollDisposable.dispose()
      unregisterMonacoEditor(nextEditor)
      onEditorLifecycle?.(nextEditor, false)
      nextEditor.dispose()
      editor = null
    }
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

</script>

<div
  bind:this={container}
  style={`min-height:${MIN_MONACO_HEIGHT_PX}px; position: relative;`}
></div>
