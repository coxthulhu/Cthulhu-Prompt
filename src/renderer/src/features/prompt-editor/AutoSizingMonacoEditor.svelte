<script lang="ts">
  import { onMount } from 'svelte'
  import { monaco } from '@renderer/common/Monaco'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import { FindController } from 'monaco-editor/esm/vs/editor/contrib/find/browser/findController'
  import { FindModelBoundToEditorModel } from '@codingame/monaco-vscode-api/vscode/vs/editor/contrib/find/browser/findModel'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { registerMonacoEditor, unregisterMonacoEditor } from './MonacoEditorRegistry'
  import {
    registerMonacoViewStateSaver,
    unregisterMonacoViewStateSaver
  } from './MonacoViewStateRegistry'
  import {
    clampMonacoHeightPx,
    getMinMonacoHeightPx,
    type PromptEditorSizingConfig
  } from './promptEditorSizing'
  import type { PromptFolderFindRequest } from '../prompt-folders/find/promptFolderFindTypes'

  type Props = {
    initialValue: string
    initialViewStateJson?: string | null
    viewStateCaptureKey?: string
    modelUri: monaco.Uri
    containerWidthPx: number
    overflowWidgetsDomNode: HTMLElement
    rowId: string
    sizingConfig: PromptEditorSizingConfig
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onChange?: (value: string, meta: { didResize: boolean; heightPx: number }) => void
    onBlur?: () => void
    onEditorLifecycle?: (editor: monaco.editor.IStandaloneCodeEditor, isActive: boolean) => void
    findSectionKey: string
    findRequest?: PromptFolderFindRequest | null
    onFindMatchReveal?: (
      handler: ((query: string, matchIndex: number) => number | null) | null
    ) => void
    onSelectionChange?: (startOffset: number, endOffset: number) => void
    onViewStateCapture?: (viewStateJson: string | null) => void
    /** Moves focus to the owning title input when backward tabbing from the first cursor position. */
    onBackwardTabAtStart?: () => void
    class?: string
  }

  let {
    initialValue,
    initialViewStateJson,
    viewStateCaptureKey,
    modelUri,
    containerWidthPx,
    overflowWidgetsDomNode,
    rowId,
    sizingConfig,
    scrollToWithinWindowBand,
    onChange,
    onBlur,
    onEditorLifecycle,
    findSectionKey,
    findRequest,
    onFindMatchReveal,
    onSelectionChange,
    onViewStateCapture,
    onBackwardTabAtStart,
    class: className
  }: Props = $props()

  const systemSettings = getSystemSettingsContext()
  const showLineNumbers = $derived(systemSettings.showLineNumbers)
  const minMonacoHeightPx = $derived(getMinMonacoHeightPx(sizingConfig))

  let container: HTMLDivElement | null = null
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  let isEditorReady = $state(false)
  let monacoHeightPx = $state(0)
  let lastContainerWidthPx = 0
  let isLayingOut = false
  let pendingCursorPosition: monaco.IPosition | null = null
  let findController: FindController | null = null
  let findModel: FindModelBoundToEditorModel | null = null
  let lastFindQuery = ''
  let lastActiveMatchIndex: number | null = null
  let lastFontSizeEffectEditor: monaco.editor.IStandaloneCodeEditor | null = null
  let lastAppliedPromptFontSize: number | null = null
  let lastAppliedPromptEditorMinLines: number | null = null
  let lastAppliedPromptEditorMaxLines: number | null = null
  let lastAppliedShowLineNumbers: boolean | null = null
  let suppressCursorAutoScrollDuringRestore = $state(false)

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
  }

  const measureContentHeightPx = (): number => {
    if (!editor) return monacoHeightPx
    return clampMonacoHeightPx(Math.ceil(editor.getContentHeight()), sizingConfig)
  }

  const layoutEditor = (nextHeightPx?: number): number => {
    if (isLayingOut || !editor || !container) return monacoHeightPx

    const measuredWidthPx = container.getBoundingClientRect().width
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

  const serializeEditorViewState = (
    targetEditor: monaco.editor.IStandaloneCodeEditor
  ): string | null => {
    const viewState = targetEditor.saveViewState()
    if (!viewState) return null

    return JSON.stringify(viewState)
  }

  const tryRestoreEditorViewState = (
    targetEditor: monaco.editor.IStandaloneCodeEditor,
    viewStateJson: string | null | undefined
  ): void => {
    if (!viewStateJson) return

    try {
      targetEditor.restoreViewState(JSON.parse(viewStateJson) as monaco.editor.ICodeEditorViewState)
    } catch {
      // Monaco tolerates stale or incompatible view state; ignore restoration failures.
    }
  }

  const restoreEditorViewStateWithScrollSuppression = (
    targetEditor: monaco.editor.IStandaloneCodeEditor,
    viewStateJson: string | null | undefined
  ) => {
    suppressCursorAutoScrollDuringRestore = true
    try {
      tryRestoreEditorViewState(targetEditor, viewStateJson)
    } finally {
      // Side effect: ignore restore-driven cursor changes only during synchronous restoration.
      suppressCursorAutoScrollDuringRestore = false
    }
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
    query: string,
    options: { shouldClearSelection?: boolean } = {}
  ): boolean => {
    const controller = getFindController()
    if (!editor || !controller) return false

    const queryChanged = query !== lastFindQuery
    if (queryChanged) {
      lastFindQuery = query
      lastActiveMatchIndex = null
    }

    controller.getState().change(
      {
        searchString: query,
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
    return true
  }

  const revealFindMatch = (query: string, matchIndex: number): number | null => {
    if (query.length === 0) return null

    if (!syncFindState(query)) return null

    if (matchIndex >= 0) {
      findModel?.moveToMatch(matchIndex)
      lastActiveMatchIndex = matchIndex
    }

    const selection = editor?.getSelection()
    if (!selection) return null
    const centerOffsetPx = getRowCenterOffset({
      lineNumber: selection.startLineNumber,
      column: selection.startColumn
    })
    return centerOffsetPx
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
    if (suppressCursorAutoScrollDuringRestore) {
      pendingCursorPosition = null
      return
    }
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
    if (suppressCursorAutoScrollDuringRestore) {
      pendingCursorPosition = null
      return
    }
    if (!pendingCursorPosition) return
    const metrics = getCursorMetrics(pendingCursorPosition)
    const isVisible = metrics?.isVisible ?? false
    if (!isVisible) return
    scrollCursorIntoBand(pendingCursorPosition)
    pendingCursorPosition = null
  }

  // Mirror Monaco find anchor updates from explicit/undo/redo selection changes.
  const reportSelectionAnchorFromSelectionChange = (
    targetEditor: monaco.editor.IStandaloneCodeEditor,
    event: monaco.editor.ICursorSelectionChangedEvent
  ) => {
    if (!onSelectionChange) return
    if (
      event.reason !== monaco.editor.CursorChangeReason.Explicit &&
      event.reason !== monaco.editor.CursorChangeReason.Undo &&
      event.reason !== monaco.editor.CursorChangeReason.Redo
    ) {
      return
    }

    const model = targetEditor.getModel()
    const selection = event.selection
    if (!model) return
    const startOffset = model.getOffsetAt(selection.getStartPosition())
    const endOffset = model.getOffsetAt(selection.getEndPosition())
    onSelectionChange(startOffset, endOffset)
  }

  /** Moves focus backward when Shift+Tab is pressed with one collapsed cursor at the document start. */
  const handleBackwardTabAtStart = (event: monaco.IKeyboardEvent) => {
    if (!onBackwardTabAtStart) return
    if (
      event.keyCode !== monaco.KeyCode.Tab ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return
    }

    /** Current Monaco selections determine whether exactly one collapsed cursor is active. */
    const selections = editor?.getSelections()
    if (selections?.length !== 1) return

    /** Sole selection must be empty so selected text retains Monaco's native backward-tab action. */
    const selection = selections[0]
    /** Active cursor position must be the absolute beginning of the document. */
    const position = selection.getPosition()
    if (!selection.isEmpty() || position.lineNumber !== 1 || position.column !== 1) return

    event.preventDefault()
    event.stopPropagation()
    onBackwardTabAtStart()
  }

  // Side effect: keep the initial Monaco height aligned with the current font size.
  $effect(() => {
    if (editor) return
    monacoHeightPx = minMonacoHeightPx
  })

  // Side effect: create Monaco once the container is ready; dispose on unmount.
  onMount(() => {
    if (!container) return
    const targetContainer = container

    const measuredWidthPx = targetContainer.getBoundingClientRect().width
    if (measuredWidthPx <= 0) return

    let disposed = false
    let cleanupEditor = (): void => {}

    void (async () => {
      const modelReference = await monaco.editor.createModelReference(modelUri, initialValue)
      if (disposed) {
        modelReference.dispose()
        return
      }

      const nextEditor = monaco.editor.create(targetContainer, {
        model: modelReference.object.textEditorModel,
        automaticLayout: false,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        wordWrapColumn: 80,
        fontSize: sizingConfig.fontSize,
        glyphMargin: false,
        lineNumbers: showLineNumbers ? 'on' : 'off',
        lineNumbersMinChars: 3,
        overviewRulerBorder: false,
        scrollbar: { alwaysConsumeMouseWheel: false },
        revealHorizontalRightPadding: 0,
        cursorSmoothCaretAnimation: 'off',
        smoothScrolling: false,
        renderLineHighlightOnlyWhenFocus: true,
        overflowWidgetsDomNode,
        dimension: { width: measuredWidthPx, height: minMonacoHeightPx }
      })

      editor = nextEditor
      registerMonacoEditor({ container: targetContainer, editor: nextEditor })
      onEditorLifecycle?.(nextEditor, true)
      findController = FindController.get(nextEditor)
      const captureViewState = () => {
        onViewStateCapture?.(serializeEditorViewState(nextEditor))
      }

      if (viewStateCaptureKey) {
        registerMonacoViewStateSaver(viewStateCaptureKey, captureViewState)
      }

      const changeDisposable = nextEditor.onDidChangeModelContent(handleContentChange)
      const blurDisposable = nextEditor.onDidBlurEditorWidget(() => onBlur?.())
      const focusDisposable = nextEditor.onDidFocusEditorWidget(() => focusEditor(nextEditor))
      const cursorDisposable = nextEditor.onDidChangeCursorPosition(handleCursorChange)
      const selectionDisposable = nextEditor.onDidChangeCursorSelection((event) => {
        reportSelectionAnchorFromSelectionChange(nextEditor, event)
      })
      const scrollDisposable = nextEditor.onDidScrollChange(handleEditorScroll)
      /** Monaco key subscription implements backward focus navigation at the document start. */
      const keyDownDisposable = nextEditor.onKeyDown(handleBackwardTabAtStart)

      layoutEditor()
      restoreEditorViewStateWithScrollSuppression(nextEditor, initialViewStateJson)
      layoutEditor()
      lastContainerWidthPx = containerWidthPx
      emitChange(nextEditor.getValue(), false, monacoHeightPx)
      onFindMatchReveal?.(revealFindMatch)
      isEditorReady = true

      cleanupEditor = () => {
        isEditorReady = false
        captureViewState()
        changeDisposable.dispose()
        blurDisposable.dispose()
        focusDisposable.dispose()
        cursorDisposable.dispose()
        selectionDisposable.dispose()
        scrollDisposable.dispose()
        keyDownDisposable.dispose()
        suppressCursorAutoScrollDuringRestore = false
        if (viewStateCaptureKey) {
          unregisterMonacoViewStateSaver(viewStateCaptureKey)
        }
        unregisterMonacoEditor(nextEditor)
        onEditorLifecycle?.(nextEditor, false)
        onFindMatchReveal?.(null)
        nextEditor.dispose()
        modelReference.dispose()
        editor = null
        findController = null
        clearFindState()
      }
    })()

    return () => {
      disposed = true
      cleanupEditor()
    }
  })

  // Side effect: apply font, line-number, and line-count settings to hydrated Monaco editors.
  $effect(() => {
    if (!isEditorReady || !editor) return
    const editorChanged = editor !== lastFontSizeEffectEditor
    const fontSizeChanged = sizingConfig.fontSize !== lastAppliedPromptFontSize
    const minLinesChanged = sizingConfig.minLines !== lastAppliedPromptEditorMinLines
    const maxLinesChanged = sizingConfig.maxLines !== lastAppliedPromptEditorMaxLines
    const lineNumbersChanged = showLineNumbers !== lastAppliedShowLineNumbers
    if (
      !editorChanged &&
      !fontSizeChanged &&
      !minLinesChanged &&
      !maxLinesChanged &&
      !lineNumbersChanged
    ) {
      return
    }

    lastFontSizeEffectEditor = editor
    lastAppliedPromptFontSize = sizingConfig.fontSize
    lastAppliedPromptEditorMinLines = sizingConfig.minLines
    lastAppliedPromptEditorMaxLines = sizingConfig.maxLines
    lastAppliedShowLineNumbers = showLineNumbers

    if (editorChanged || fontSizeChanged || lineNumbersChanged) {
      editor.updateOptions({
        fontSize: sizingConfig.fontSize,
        lineNumbers: showLineNumbers ? 'on' : 'off'
      })
    }

    const previousHeightPx = monacoHeightPx
    const nextHeightPx = measureContentHeightPx()
    const updatedHeightPx = layoutEditor(nextHeightPx)
    emitChange(editor.getValue(), updatedHeightPx !== previousHeightPx, updatedHeightPx)
  })

  // Side effect: when the virtualized container width changes, relayout Monaco and sync cached height.
  $effect(() => {
    if (!isEditorReady || !editor) return
    if (containerWidthPx <= 0) return
    if (containerWidthPx === lastContainerWidthPx) return

    lastContainerWidthPx = containerWidthPx
    const previousHeightPx = monacoHeightPx
    const nextHeightPx = layoutEditor()
    emitChange(editor.getValue(), nextHeightPx !== previousHeightPx, nextHeightPx)
  })

  // Side effect: sync Monaco find highlights and active-match reveal with the folder results.
  $effect(() => {
    if (!isEditorReady || !editor) return
    const query = findRequest?.query ?? ''
    if (!findRequest?.isOpen || query.length === 0) {
      clearFindState()
      return
    }

    const activeSectionMatchIndex =
      findRequest.activeSectionKey === findSectionKey ? findRequest.activeSectionMatchIndex : null
    const shouldClearSelection = activeSectionMatchIndex == null && lastActiveMatchIndex != null

    if (!syncFindState(query, { shouldClearSelection })) return

    if (activeSectionMatchIndex != null && activeSectionMatchIndex >= 0) {
      const didActiveMatchChange = lastActiveMatchIndex !== activeSectionMatchIndex
      const shouldRefreshUnfocusedMatch = !didActiveMatchChange && !editor.hasTextFocus()
      if (
        findRequest.shouldSelectActiveMatch &&
        (didActiveMatchChange || shouldRefreshUnfocusedMatch)
      ) {
        findModel?.moveToMatch(activeSectionMatchIndex)
      }
      lastActiveMatchIndex = activeSectionMatchIndex
    } else {
      lastActiveMatchIndex = null
    }
  })
</script>

<div
  bind:this={container}
  class={className}
  style={`min-height:${minMonacoHeightPx}px; position: relative;`}
></div>
