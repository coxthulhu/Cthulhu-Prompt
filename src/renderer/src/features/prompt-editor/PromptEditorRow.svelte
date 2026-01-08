<script lang="ts">
  import PromptEditorSidebar from './PromptEditorSidebar.svelte'
  import PromptEditorTitleBar from './PromptEditorTitleBar.svelte'
  import HydratableMonacoEditor from './HydratableMonacoEditor.svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import { getPromptData } from '@renderer/data/PromptDataStore.svelte.ts'
  import {
    ADDITIONAL_GAP_PX,
    estimatePromptEditorHeight,
    getMonacoHeightFromRowPx,
    getRowHeightPx,
    MIN_MONACO_HEIGHT_PX,
    MONACO_PADDING_PX,
    TITLE_BAR_HEIGHT_PX
  } from './promptEditorSizing'

  let {
    promptId,
    rowId,
    virtualWindowWidthPx,
    virtualWindowHeightPx,
    devicePixelRatio,
    measuredHeightPx,
    hydrationPriority,
    shouldDehydrate,
    overlayRowElement,
    onHydrationChange,
    scrollToWithinWindowBand,
    onDelete,
    onMoveUp,
    onMoveDown
  }: {
    promptId: string
    rowId: string
    virtualWindowWidthPx: number
    virtualWindowHeightPx: number
    devicePixelRatio: number
    measuredHeightPx: number | null
    hydrationPriority: number
    shouldDehydrate: boolean
    overlayRowElement?: HTMLDivElement | null
    onHydrationChange?: (isHydrated: boolean) => void
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onDelete: () => void
    onMoveUp: () => void
    onMoveDown: () => void
  } = $props()
  const promptData = getPromptData(promptId)
  const estimatedRowHeightPx = estimatePromptEditorHeight(
    promptData.draft.text,
    virtualWindowWidthPx,
    virtualWindowHeightPx
  )
  const placeholderMonacoHeightPx =
    measuredHeightPx != null
      ? Math.max(MIN_MONACO_HEIGHT_PX, getMonacoHeightFromRowPx(measuredHeightPx))
      : Math.max(MIN_MONACO_HEIGHT_PX, getMonacoHeightFromRowPx(estimatedRowHeightPx))
  let monacoHeightPx = $state<number>(placeholderMonacoHeightPx)
  let overflowHost = $state<HTMLDivElement | null>(null)

  const SIDEBAR_WIDTH_PX = 24
  const ROW_GAP_PX = 8
  const BORDER_WIDTH_PX = 1
  const MONACO_LEFT_PADDING_PX = 12
  const MONACO_VERTICAL_PADDING_PX = MONACO_PADDING_PX / 2

  const OVERFLOW_TOP_PADDING_PX =
    TITLE_BAR_HEIGHT_PX + ADDITIONAL_GAP_PX + MONACO_VERTICAL_PADDING_PX
  const OVERFLOW_LEFT_PADDING_PX =
    SIDEBAR_WIDTH_PX + ROW_GAP_PX + BORDER_WIDTH_PX + MONACO_LEFT_PADDING_PX
  const OVERFLOW_RIGHT_PADDING_PX = BORDER_WIDTH_PX
  const OVERFLOW_BOTTOM_PADDING_PX = MONACO_VERTICAL_PADDING_PX

  // Derived row height used for layout and stored measurements.
  const rowHeightPx = $derived(getRowHeightPx(monacoHeightPx))

  // Side effect: keep the Monaco overflow host aligned with the prompt editor chrome.
  $effect(() => {
    if (!overlayRowElement) {
      if (overflowHost) {
        overflowHost.remove()
        overflowHost = null
      }
      return
    }

    const host = overflowHost ?? document.createElement('div')
    host.className = 'monaco-editor no-user-select showUnused showDeprecated vs-dark'
    host.style.position = 'absolute'
    host.style.inset = '0'
    host.style.overflow = 'visible'
    host.style.pointerEvents = 'none'
    host.style.boxSizing = 'border-box'
    host.style.padding = `${OVERFLOW_TOP_PADDING_PX}px ${OVERFLOW_RIGHT_PADDING_PX}px ${OVERFLOW_BOTTOM_PADDING_PX}px ${OVERFLOW_LEFT_PADDING_PX}px`

    if (host.parentElement !== overlayRowElement) {
      overlayRowElement.appendChild(host)
    }

    if (overflowHost !== host) {
      overflowHost = host
    }

    return () => {
      if (host.parentElement === overlayRowElement) {
        host.remove()
      }
    }
  })
</script>

<div
  class="flex items-stretch gap-2"
  style={`height:${rowHeightPx}px; min-height:${rowHeightPx}px; max-height:${rowHeightPx}px;`}
  data-testid={`prompt-editor-${promptId}`}
  data-prompt-editor-row
>
  <PromptEditorSidebar {onMoveUp} {onMoveDown} />

  <div class="bg-background overflow-hidden flex-1">
    <div class="flex min-w-0">
      <div class="flex-1 flex flex-col min-w-0">
        <PromptEditorTitleBar
          title={promptData.draft.title}
          draftText={promptData.draft.text}
          onTitleChange={promptData.setTitle}
          {rowId}
          {scrollToWithinWindowBand}
          {onDelete}
        />

        <div class="flex-1 min-w-0 mt-0.5">
          {#key promptId}
            <HydratableMonacoEditor
              initialValue={promptData.draft.text}
              containerWidthPx={virtualWindowWidthPx}
              placeholderHeightPx={placeholderMonacoHeightPx}
              overflowWidgetsDomNode={overflowHost}
              {hydrationPriority}
              {shouldDehydrate}
              {onHydrationChange}
              onChange={(text, meta) => {
                if (meta.heightPx !== monacoHeightPx) {
                  monacoHeightPx = meta.heightPx
                }
                promptData.setText(text, {
                  measuredHeightPx: rowHeightPx,
                  widthPx: virtualWindowWidthPx,
                  devicePixelRatio
                })
              }}
            />
          {/key}
        </div>
      </div>
    </div>
  </div>
</div>
