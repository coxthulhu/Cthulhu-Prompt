<script lang="ts">
  import { onMount } from 'svelte'
  import { monaco, PROMPT_EDITOR_THEME } from '@renderer/common/Monaco'
  import { registerMonacoEditor, unregisterMonacoEditor } from './MonacoEditorRegistry'
  import { clampMonacoHeightPx, LINE_HEIGHT_PX, MIN_MONACO_HEIGHT_PX } from './promptEditorSizing'

  type Props = {
    initialValue: string
    containerWidthPx: number
    onChange?: (value: string, meta: { didResize: boolean; heightPx: number }) => void
    onBlur?: () => void
  }

  let { initialValue, containerWidthPx, onChange, onBlur }: Props = $props()

  let container: HTMLDivElement | null = null
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  let monacoHeightPx = MIN_MONACO_HEIGHT_PX
  let lastContainerWidthPx = 0
  let isLayingOut = false

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

  const handleContentChange = () => {
    if (!editor) return
    const nextValue = editor.getValue()
    const nextHeightPx = measureContentHeightPx()
    const didResize = nextHeightPx !== monacoHeightPx

    if (didResize) {
      layoutEditor(nextHeightPx)
    }

    emitChange(nextValue, didResize, monacoHeightPx)
  }

  // Create Monaco once the container is ready and keep height in sync with content/width.
  onMount(() => {
    if (!container) return

    const measuredWidthPx = Math.round(container.getBoundingClientRect().width)
    if (measuredWidthPx <= 0) return

    editor = monaco.editor.create(container, {
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
      dimension: { width: measuredWidthPx, height: MIN_MONACO_HEIGHT_PX }
    })

    registerMonacoEditor({ container, editor })

    const changeDisposable = editor.onDidChangeModelContent(handleContentChange)

    const blurDisposable = editor.onDidBlurEditorWidget(() => onBlur?.())

    layoutEditor()
    lastContainerWidthPx = containerWidthPx
    emitChange(editor.getValue(), false, monacoHeightPx)

    // Dispose Monaco/editor resources on unmount.
    return () => {
      changeDisposable.dispose()
      blurDisposable.dispose()
      editor?.dispose()
      if (editor) {
        unregisterMonacoEditor(editor)
      }
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
