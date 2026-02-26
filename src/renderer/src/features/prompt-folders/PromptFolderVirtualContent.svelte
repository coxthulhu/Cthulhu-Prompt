<script lang="ts">
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import { lookupPromptEditorMeasuredHeight } from '@renderer/data/UiState/PromptDraftUiCache.svelte.ts'
  import { lookupPromptFolderDescriptionMeasuredHeight } from '@renderer/data/UiState/PromptFolderDraftUiCache.svelte.ts'
  import type { PromptDraftRecord } from '@renderer/data/Collections/PromptDraftCollection'
  import PromptEditorRow from '../prompt-editor/PromptEditorRow.svelte'
  import { estimatePromptEditorHeight } from '../prompt-editor/promptEditorSizing'
  import PromptDivider from '../prompt-editor/PromptDivider.svelte'
  import BottomSpacer, { getBottomSpacerHeightPx } from '../prompt-editor/BottomSpacer.svelte'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToAndTrackRowCentered,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem,
    type VirtualWindowRowComponentProps,
    type VirtualWindowViewportMetrics
  } from '../virtualizer/virtualWindowTypes'
  import PromptFolderSettingsRow from './PromptFolderSettingsRow.svelte'
  import { PROMPT_FOLDER_SETTINGS_ROW_ID, promptEditorRowId } from './promptFolderRowIds'
  import {
    estimatePromptFolderSettingsHeight,
    PROMPT_HEADER_ROW_HEIGHT_PX
  } from './promptFolderSettingsSizing'
  import type { ActiveOutlinerRow, PromptFocusRequest } from './promptFolderScreenController.svelte.ts'

  type PromptFolderRow =
    | { kind: 'folder-settings' }
    | { kind: 'prompt-header'; promptCount: number }
    | { kind: 'placeholder' }
    | { kind: 'prompt-divider'; previousPromptId: string | null }
    | { kind: 'prompt-editor'; promptId: string }
    | { kind: 'bottom-spacer' }

  type PromptEditorRowProps = VirtualWindowRowComponentProps<
    Extract<PromptFolderRow, { kind: 'prompt-editor' }>
  >

  type PromptFolderVirtualContentProps = {
    promptFolderId: string
    descriptionText: string
    promptFontSize: number
    promptEditorMinLines: number
    promptDraftById: Record<string, PromptDraftRecord>
    visiblePromptIds: string[]
    isCreatingPrompt: boolean
    promptFocusRequest: PromptFocusRequest | null
    initialScrollTopPx: number
    initialCenterRowId: string | null
    scrollToWithinWindowBandForRows: ScrollToWithinWindowBand
    onAddPrompt: (previousPromptId: string | null) => void
    onDeletePrompt: (promptId: string) => void
    onMovePromptUp: (promptId: string) => Promise<boolean>
    onMovePromptDown: (promptId: string) => Promise<boolean>
    onDescriptionChange: (text: string, measurement: TextMeasurement) => void
    onScrollToWithinWindowBandChange: (next: ScrollToWithinWindowBand | null) => void
    onScrollToAndTrackRowCenteredChange: (next: ScrollToAndTrackRowCentered | null) => void
    onViewportMetricsChange: (next: VirtualWindowViewportMetrics | null) => void
    onScrollTopChange: (nextScrollTop: number) => void
    onCenterRowChange: (row: ActiveOutlinerRow | null) => void
    onUserScroll: () => void
    onInitialCenterRowApplied: () => void
  }

  let {
    promptFolderId,
    descriptionText,
    promptFontSize,
    promptEditorMinLines,
    promptDraftById,
    visiblePromptIds,
    isCreatingPrompt,
    promptFocusRequest,
    initialScrollTopPx,
    initialCenterRowId,
    scrollToWithinWindowBandForRows,
    onAddPrompt,
    onDeletePrompt,
    onMovePromptUp,
    onMovePromptDown,
    onDescriptionChange,
    onScrollToWithinWindowBandChange,
    onScrollToAndTrackRowCenteredChange,
    onViewportMetricsChange,
    onScrollTopChange,
    onCenterRowChange,
    onUserScroll,
    onInitialCenterRowApplied
  }: PromptFolderVirtualContentProps = $props()

  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let scrollToAndTrackRowCentered = $state<ScrollToAndTrackRowCentered | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)

  // Side effect: expose the virtual window band-scroll API to the controller.
  $effect(() => {
    onScrollToWithinWindowBandChange(scrollToWithinWindowBand)
  })

  // Side effect: expose the center-row tracking API to the controller.
  $effect(() => {
    onScrollToAndTrackRowCenteredChange(scrollToAndTrackRowCentered)
  })

  // Side effect: expose imperative virtual scroll APIs to the controller.
  $effect(() => {
    onViewportMetricsChange(viewportMetrics)
  })

  const lookupPromptFolderDescriptionMeasuredHeightForScreen = (
    widthPx: number,
    devicePixelRatio: number
  ): number | null => {
    return lookupPromptFolderDescriptionMeasuredHeight(promptFolderId, widthPx, devicePixelRatio)
  }

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    'folder-settings': {
      estimateHeight: () =>
        estimatePromptFolderSettingsHeight(descriptionText, promptFontSize, promptEditorMinLines),
      lookupMeasuredHeight: (_row, widthPx, devicePixelRatio) =>
        lookupPromptFolderDescriptionMeasuredHeightForScreen(widthPx, devicePixelRatio),
      hydrationPriorityEligible: true,
      needsOverlayRow: true,
      centerRowEligible: true,
      dehydrateOnWidthResize: true,
      snippet: folderSettingsRow
    },
    'prompt-header': {
      estimateHeight: () => PROMPT_HEADER_ROW_HEIGHT_PX,
      snippet: promptHeaderRow
    },
    placeholder: {
      estimateHeight: () => 120,
      snippet: placeholderRow
    },
    'prompt-divider': {
      // Match the xs button height so the divider row doesn't clip.
      estimateHeight: () => 28,
      snippet: dividerRow
    },
    'prompt-editor': {
      estimateHeight: (row, widthPx, heightPx) =>
        estimatePromptEditorHeight(
          promptDraftById[row.promptId]!.promptText,
          widthPx,
          heightPx,
          promptFontSize,
          promptEditorMinLines
        ),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) => {
        return lookupPromptEditorMeasuredHeight(row.promptId, widthPx, devicePixelRatio)
      },
      hydrationPriorityEligible: true,
      centerRowEligible: true,
      needsOverlayRow: true,
      dehydrateOnWidthResize: true,
      snippet: promptEditorRow
    },
    'bottom-spacer': {
      estimateHeight: (_row, _widthPx, heightPx) => getBottomSpacerHeightPx(heightPx),
      snippet: bottomSpacerRow
    }
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptFolderRow>[] => {
    const rows: VirtualWindowItem<PromptFolderRow>[] = [
      {
        id: PROMPT_FOLDER_SETTINGS_ROW_ID,
        row: {
          kind: 'folder-settings'
        }
      },
      {
        id: 'prompt-header',
        row: {
          kind: 'prompt-header',
          promptCount: visiblePromptIds.length
        }
      }
    ]

    if (visiblePromptIds.length === 0) {
      rows.push({
        id: 'divider-initial',
        row: { kind: 'prompt-divider', previousPromptId: null }
      })
      rows.push({
        id: 'placeholder-empty',
        row: { kind: 'placeholder' }
      })
    } else {
      rows.push({
        id: 'divider-initial',
        row: { kind: 'prompt-divider', previousPromptId: null }
      })

      visiblePromptIds.forEach((promptId) => {
        rows.push({ id: promptEditorRowId(promptId), row: { kind: 'prompt-editor', promptId } })
        rows.push({
          id: `${promptId}-divider`,
          row: { kind: 'prompt-divider', previousPromptId: promptId }
        })
      })
    }

    rows.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
    return rows
  })

  const handleCenterRowChange = (row: PromptFolderRow | null) => {
    if (row?.kind === 'prompt-editor') {
      onCenterRowChange({ kind: 'prompt', promptId: row.promptId })
      return
    }
    if (row?.kind === 'folder-settings') {
      onCenterRowChange({ kind: 'folder-settings' })
      return
    }
    onCenterRowChange(null)
  }
</script>

<SvelteVirtualWindow
  items={virtualItems}
  {rowRegistry}
  {initialScrollTopPx}
  initialScrollToRowCenteredId={initialCenterRowId}
  testId="prompt-folder-virtual-window"
  spacerTestId="prompt-folder-virtual-window-spacer"
  onInitialScrollToRowCenteredApplied={onInitialCenterRowApplied}
  bind:scrollToWithinWindowBand
  bind:scrollToAndTrackRowCentered
  bind:viewportMetrics
  {onScrollTopChange}
  onCenterRowChange={(row) => {
    handleCenterRowChange(row)
  }}
  onUserScroll={() => {
    onUserScroll()
  }}
/>

{#snippet folderSettingsRow(props)}
  <PromptFolderSettingsRow
    {promptFolderId}
    rowId={props.rowId}
    virtualWindowWidthPx={props.virtualWindowWidthPx}
    devicePixelRatio={props.devicePixelRatio}
    rowHeightPx={props.rowHeightPx}
    hydrationPriority={props.hydrationPriority}
    shouldDehydrate={props.shouldDehydrate}
    overlayRowElement={props.overlayRowElement ?? null}
    scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
    onHydrationChange={props.onHydrationChange}
    {descriptionText}
    {onDescriptionChange}
  />
{/snippet}

{#snippet promptHeaderRow({ row })}
  <div class="pt-6 pb-4" data-virtual-window-row>
    <h2 class="text-lg font-semibold">Prompts ({row.promptCount})</h2>
  </div>
{/snippet}

{#snippet placeholderRow()}
  <div class="text-center py-12 text-muted-foreground">
    <p>No prompts found in this folder.</p>
    <p class="text-sm mt-2">Click the + button to create your first prompt.</p>
  </div>
{/snippet}

{#snippet dividerRow({ row })}
  <PromptDivider
    disabled={isCreatingPrompt}
    onAddPrompt={() => onAddPrompt(row.previousPromptId)}
    testId={row.previousPromptId
      ? `prompt-divider-add-after-${row.previousPromptId}`
      : 'prompt-divider-add-initial'}
  />
{/snippet}

{#snippet promptEditorRow({
  row,
  rowId,
  virtualWindowWidthPx,
  devicePixelRatio,
  rowHeightPx,
  hydrationPriority,
  shouldDehydrate,
  overlayRowElement,
  onHydrationChange
}: PromptEditorRowProps)}
  <PromptEditorRow
    promptId={row.promptId}
    promptDraftRecord={promptDraftById[row.promptId]!}
    {rowId}
    {virtualWindowWidthPx}
    {devicePixelRatio}
    {rowHeightPx}
    {hydrationPriority}
    {shouldDehydrate}
    {overlayRowElement}
    {onHydrationChange}
    scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
    focusRequest={promptFocusRequest}
    onDelete={() => onDeletePrompt(row.promptId)}
    onMoveUp={() => onMovePromptUp(row.promptId)}
    onMoveDown={() => onMovePromptDown(row.promptId)}
  />
{/snippet}

{#snippet bottomSpacerRow({ virtualWindowHeightPx })}
  <BottomSpacer scrollContainerHeightPx={virtualWindowHeightPx} />
{/snippet}
