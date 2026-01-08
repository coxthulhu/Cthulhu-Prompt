<script lang="ts">
  import PromptEditorSidebar from './PromptEditorSidebar.svelte'
  import PromptEditorTitleBar from './PromptEditorTitleBar.svelte'
  import HydratableMonacoEditor from './HydratableMonacoEditor.svelte'
  import { getPromptData } from '@renderer/data/PromptDataStore.svelte.ts'
  import {
    estimatePromptEditorHeight,
    getMonacoHeightFromRowPx,
    getRowHeightPx,
    MIN_MONACO_HEIGHT_PX
  } from './promptEditorSizing'

  let {
    promptId,
    virtualWindowWidthPx,
    virtualWindowHeightPx,
    devicePixelRatio,
    measuredHeightPx,
    hydrationPriority,
    shouldDehydrate,
    reportHydrationState,
    onDelete,
    onMoveUp,
    onMoveDown
  }: {
    promptId: string
    virtualWindowWidthPx: number
    virtualWindowHeightPx: number
    devicePixelRatio: number
    measuredHeightPx: number | null
    hydrationPriority: number
    shouldDehydrate: boolean
    reportHydrationState?: (isHydrated: boolean) => void
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

  // Derived row height used for layout and stored measurements.
  const rowHeightPx = $derived(getRowHeightPx(monacoHeightPx))
</script>

<div
  class="flex items-stretch gap-2"
  style={`height:${rowHeightPx}px; min-height:${rowHeightPx}px; max-height:${rowHeightPx}px;`}
  data-testid={`prompt-editor-${promptId}`}
>
  <PromptEditorSidebar {onMoveUp} {onMoveDown} />

  <div class="bg-background overflow-hidden flex-1">
    <div class="flex min-w-0">
      <div class="flex-1 flex flex-col min-w-0">
        <PromptEditorTitleBar
          title={promptData.draft.title}
          draftText={promptData.draft.text}
          onTitleChange={promptData.setTitle}
          {onDelete}
        />

        <div class="flex-1 min-w-0 mt-0.5">
          {#key promptId}
            <HydratableMonacoEditor
              initialValue={promptData.draft.text}
              containerWidthPx={virtualWindowWidthPx}
              placeholderHeightPx={placeholderMonacoHeightPx}
              {hydrationPriority}
              {shouldDehydrate}
              {reportHydrationState}
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
