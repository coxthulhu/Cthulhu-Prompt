<script lang="ts">
  import Title from '@renderer/common/cthulhu-ui/Title.svelte'
  import {
    PROMPT_FOLDER_SETTINGS_FIELDS,
    type PromptFolderSettings,
    type PromptFolderSettingsField
  } from '@shared/PromptFolder'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import { lookupPromptEditorMeasuredHeight } from '@renderer/data/UiState/PromptDraftUiCache.svelte.ts'
  import { lookupPromptFolderSettingsRowMeasuredHeight } from '@renderer/data/UiState/PromptFolderDraftUiCache.svelte.ts'
  import type { PromptDraftRecord } from '@renderer/data/Collections/PromptDraftCollection'
  import type { PromptFolderSettingsDraftField } from '@renderer/data/UiState/PromptFolderDraftMutations.svelte.ts'
  import PromptEditorRow from '../prompt-editor/PromptEditorRow.svelte'
  import {
    clampMonacoHeightPx,
    estimatePromptEditorHeight,
    getMonacoHeightFromRowPx,
    getRowHeightPx,
    type PromptEditorSizingConfig
  } from '../prompt-editor/promptEditorSizing'
  import PromptDivider from '../prompt-editor/PromptDivider.svelte'
  import { PROMPT_DIVIDER_ROW_HEIGHT_PX } from '../prompt-editor/promptDividerSizing'
  import BottomSpacer, { getBottomSpacerHeightPx } from '../prompt-editor/BottomSpacer.svelte'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToAndTrackRowCentered,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem,
    type VirtualWindowRowComponentProps,
    type VirtualWindowScrollApi,
    type VirtualWindowViewportMetrics
  } from '../virtualizer/virtualWindowTypes'
  import PromptFolderSettingsRow from './PromptFolderSettingsRow.svelte'
  import {
    PROMPT_FOLDER_SETTINGS_ROW_ID,
    promptDividerRowId,
    promptEditorRowId,
    promptFolderSettingsRowId
  } from './promptFolderRowIds'
  import PromptFolderSectionRow, {
    PROMPT_FOLDER_SECTION_GUTTER_OFFSET_PX,
    PROMPT_FOLDER_SECTION_GUTTER_START_INSET_PX
  } from './PromptFolderSectionRow.svelte'
  import {
    PROMPT_FOLDER_SETTINGS_HEADER_ROW_HEIGHT_PX,
    estimatePromptFolderSettingsFieldRowHeight,
    PROMPT_HEADER_ROW_HEIGHT_PX
  } from './promptFolderSettingsSizing'
  import {
    createDroppableStateRegistry,
    type DroppableOptions
  } from '../drag-drop/dragDrop.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    resolvePromptHandleDropMove,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload
  } from '../drag-drop/promptHandleDrag'
  import type {
    ActivePromptTreeRow,
    PromptFocusRequest
  } from './promptFolderScreenController.svelte.ts'

  type PromptFolderRow =
    | { kind: 'folder-settings-header' }
    | { kind: 'folder-settings-field'; field: PromptFolderSettingsField; includeBottomGap: boolean }
    | { kind: 'prompt-header'; promptCount: number }
    | { kind: 'placeholder' }
    | { kind: 'prompt-divider'; previousPromptId: string | null }
    | { kind: 'prompt-editor'; promptId: string }
    | { kind: 'bottom-spacer' }

  type PromptEditorRowProps = VirtualWindowRowComponentProps<
    Extract<PromptFolderRow, { kind: 'prompt-editor' }>
  >

  type PromptFolderVirtualContentProps = {
    workspaceId: string | null
    promptFolderId: string
    folderSettings: PromptFolderSettings
    promptEditorSizingConfig: PromptEditorSizingConfig
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
    onPromptTreeDrop: (
      promptId: string,
      dropPayload: PromptHandleDropPayload | null
    ) => void | Promise<void>
    onSettingsFieldChange: (
      field: PromptFolderSettingsDraftField,
      text: string,
      measurement: TextMeasurement
    ) => void
    onScrollToWithinWindowBandChange: (next: ScrollToWithinWindowBand | null) => void
    onScrollToAndTrackRowCenteredChange: (next: ScrollToAndTrackRowCentered | null) => void
    onViewportMetricsChange: (next: VirtualWindowViewportMetrics | null) => void
    onScrollTopChange: (nextScrollTop: number) => void
    onCenterRowChange: (row: ActivePromptTreeRow | null) => void
    onUserScroll: () => void
    onInitialCenterRowApplied: () => void
  }

  let {
    workspaceId,
    promptFolderId,
    folderSettings,
    promptEditorSizingConfig,
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
    onPromptTreeDrop,
    onSettingsFieldChange,
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
  let scrollApi = $state<VirtualWindowScrollApi | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  const promptDividerDroppableState = createDroppableStateRegistry<string>()

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

  const lookupPromptFolderSettingsRowMeasuredHeightForScreen = (
    field: PromptFolderSettingsField,
    widthPx: number,
    devicePixelRatio: number
  ): number | null => {
    return lookupPromptFolderSettingsRowMeasuredHeight(
      promptFolderId,
      field,
      widthPx,
      devicePixelRatio
    )
  }

  const getSectionContentWidthPx = (virtualWindowWidthPx: number): number => {
    return Math.max(0, virtualWindowWidthPx - PROMPT_FOLDER_SECTION_GUTTER_OFFSET_PX)
  }

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    'folder-settings-header': {
      estimateHeight: () => PROMPT_FOLDER_SETTINGS_HEADER_ROW_HEIGHT_PX,
      centerRowEligible: true,
      snippet: folderSettingsHeaderRow
    },
    'folder-settings-field': {
      estimateHeight: (row) =>
        estimatePromptFolderSettingsFieldRowHeight(
          folderSettings[row.field],
          promptEditorSizingConfig.fontSize,
          row.includeBottomGap
        ),
      lookupMeasuredHeight: (_row, widthPx, devicePixelRatio) =>
        lookupPromptFolderSettingsRowMeasuredHeightForScreen(
          _row.field,
          getSectionContentWidthPx(widthPx),
          devicePixelRatio
        ),
      hydrationPriorityEligible: true,
      overlayRow: {},
      centerRowEligible: true,
      dehydrateOnWidthResize: true,
      snippet: folderSettingsFieldRow
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
      // Match the rendered add prompt divider height used by the virtual row.
      estimateHeight: () => PROMPT_DIVIDER_ROW_HEIGHT_PX,
      snippet: dividerRow
    },
    'prompt-editor': {
      estimateHeight: (row, widthPx, heightPx) =>
        estimatePromptEditorHeight(
          promptDraftById[row.promptId]!.promptText,
          getSectionContentWidthPx(widthPx),
          heightPx,
          promptEditorSizingConfig
        ),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) => {
        const measuredRowHeightPx = lookupPromptEditorMeasuredHeight(
          row.promptId,
          getSectionContentWidthPx(widthPx),
          devicePixelRatio
        )
        if (measuredRowHeightPx == null) return null

        return getRowHeightPx(
          clampMonacoHeightPx(
            getMonacoHeightFromRowPx(measuredRowHeightPx),
            promptEditorSizingConfig
          )
        )
      },
      hydrationPriorityEligible: true,
      centerRowEligible: true,
      overlayRow: {},
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
          kind: 'folder-settings-header'
        }
      }
    ]

    PROMPT_FOLDER_SETTINGS_FIELDS.forEach((field, index) => {
      rows.push({
        id: promptFolderSettingsRowId(field),
        row: {
          kind: 'folder-settings-field',
          field,
          includeBottomGap: index < PROMPT_FOLDER_SETTINGS_FIELDS.length - 1
        }
      })
    })

    rows.push(
      {
        id: 'prompt-header',
        row: {
          kind: 'prompt-header',
          promptCount: visiblePromptIds.length
        }
      }
    )

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
    if (row?.kind === 'folder-settings-header' || row?.kind === 'folder-settings-field') {
      onCenterRowChange({ kind: 'folder-settings' })
      return
    }
    onCenterRowChange(null)
  }

  const scrollByPromptBlockHeight = (direction: 'up' | 'down', promptId: string) => {
    if (!scrollApi) return

    const promptIndex = visiblePromptIds.indexOf(promptId)
    const adjacentPromptId =
      direction === 'up' ? visiblePromptIds[promptIndex - 1] : visiblePromptIds[promptIndex + 1]
    if (!adjacentPromptId) return

    // Keep the clicked move button anchored while the adjacent prompt block crosses it.
    scrollApi.scrollByRowHeights(
      [promptEditorRowId(adjacentPromptId), promptDividerRowId(adjacentPromptId)],
      direction
    )
  }

  const handleMovePromptUp = (promptId: string): Promise<boolean> => {
    scrollByPromptBlockHeight('up', promptId)
    return onMovePromptUp(promptId)
  }

  const handleMovePromptDown = (promptId: string): Promise<boolean> => {
    scrollByPromptBlockHeight('down', promptId)
    return onMovePromptDown(promptId)
  }

  const getPromptDividerDropPayload = (
    previousPromptId: string | null
  ): PromptHandleDropPayload => {
    if (previousPromptId === null) {
      return {
        kind: 'folder',
        folderId: promptFolderId
      }
    }

    return {
      kind: 'prompt',
      folderId: promptFolderId,
      promptId: previousPromptId,
      edge: 'bottom'
    }
  }

  const canDropOnPromptDivider = (
    previousPromptId: string | null,
    payload: PromptHandleDragPayload
  ): boolean => {
    if (payload.sourceFolderId !== promptFolderId) {
      return true
    }

    return (
      resolvePromptHandleDropMove(
        promptFolderId,
        visiblePromptIds,
        payload.fromId,
        getPromptDividerDropPayload(previousPromptId),
        visiblePromptIds
      ) !== null
    )
  }

  const getPromptDividerDropOptions = (
    rowId: string,
    previousPromptId: string | null
  ): DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges: 'none',
    payload: () => getPromptDividerDropPayload(previousPromptId),
    canDrop: (payload) => canDropOnPromptDivider(previousPromptId, payload),
    state: promptDividerDroppableState.getState(rowId)
  })
</script>

<SvelteVirtualWindow
  items={virtualItems}
  {rowRegistry}
  {initialScrollTopPx}
  initialScrollToRowCenteredId={initialCenterRowId}
  rightScrollPaddingPx={12}
  testId="prompt-folder-virtual-window"
  spacerTestId="prompt-folder-virtual-window-spacer"
  onInitialScrollToRowCenteredApplied={onInitialCenterRowApplied}
  bind:scrollToWithinWindowBand
  bind:scrollToAndTrackRowCentered
  bind:scrollApi
  bind:viewportMetrics
  {onScrollTopChange}
  onCenterRowChange={(row) => {
    handleCenterRowChange(row)
  }}
  onUserScroll={() => {
    onUserScroll()
  }}
/>

{#snippet folderSettingsHeaderRow({ rowHeightPx })}
  <PromptFolderSectionRow
    {rowHeightPx}
    contentClass="pt-6"
    contentVirtualWindowRow
    topInsetPx={PROMPT_FOLDER_SECTION_GUTTER_START_INSET_PX}
  >
    <Title title="Folder Settings" />
  </PromptFolderSectionRow>
{/snippet}

{#snippet folderSettingsFieldRow(props)}
  <PromptFolderSectionRow rowHeightPx={props.rowHeightPx}>
    <PromptFolderSettingsRow
      {workspaceId}
      {promptFolderId}
      field={props.row.field}
      rowId={props.rowId}
      virtualWindowWidthPx={getSectionContentWidthPx(props.virtualWindowWidthPx)}
      rowContentLeftOffsetPx={PROMPT_FOLDER_SECTION_GUTTER_OFFSET_PX}
      devicePixelRatio={props.devicePixelRatio}
      rowHeightPx={props.rowHeightPx}
      includeBottomGap={props.row.includeBottomGap}
      hydrationPriority={props.hydrationPriority}
      shouldDehydrate={props.shouldDehydrate}
      overlayRowElement={props.overlayRowElement ?? null}
      scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
      onHydrationChange={props.onHydrationChange}
      {folderSettings}
      {onSettingsFieldChange}
    />
  </PromptFolderSectionRow>
{/snippet}

{#snippet promptHeaderRow({ rowHeightPx })}
  <PromptFolderSectionRow
    {rowHeightPx}
    contentClass="pt-6 pb-1"
    contentVirtualWindowRow
    topInsetPx={PROMPT_FOLDER_SECTION_GUTTER_START_INSET_PX}
  >
    <Title title="Prompts" />
  </PromptFolderSectionRow>
{/snippet}

{#snippet placeholderRow({ rowHeightPx })}
  <PromptFolderSectionRow {rowHeightPx} contentClass="text-center py-12 text-muted-foreground">
    <p>No prompts found in this folder.</p>
    <p class="text-sm mt-2">Click the Add Prompt button to create your first prompt.</p>
  </PromptFolderSectionRow>
{/snippet}

{#snippet dividerRow({ row, rowId, rowHeightPx })}
  <PromptFolderSectionRow {rowHeightPx}>
    <PromptDivider
      disabled={isCreatingPrompt}
      onAddPrompt={() => onAddPrompt(row.previousPromptId)}
      getDropOptions={() => getPromptDividerDropOptions(rowId, row.previousPromptId)}
      testId={row.previousPromptId
        ? `prompt-divider-add-after-${row.previousPromptId}`
        : 'prompt-divider-add-initial'}
    />
  </PromptFolderSectionRow>
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
  {@const promptIndex = visiblePromptIds.indexOf(row.promptId)}
  <PromptFolderSectionRow {rowHeightPx}>
    <PromptEditorRow
      {workspaceId}
      {promptFolderId}
      promptId={row.promptId}
      promptDraftRecord={promptDraftById[row.promptId]!}
      {rowId}
      virtualWindowWidthPx={getSectionContentWidthPx(virtualWindowWidthPx)}
      rowContentLeftOffsetPx={PROMPT_FOLDER_SECTION_GUTTER_OFFSET_PX}
      {devicePixelRatio}
      {rowHeightPx}
      {hydrationPriority}
      {shouldDehydrate}
      {overlayRowElement}
      {onHydrationChange}
      folderSettings={folderSettings}
      scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
      focusRequest={promptFocusRequest}
      isFirstPrompt={promptIndex === 0}
      isLastPrompt={promptIndex === visiblePromptIds.length - 1}
      onDelete={() => onDeletePrompt(row.promptId)}
      onMoveUp={() => handleMovePromptUp(row.promptId)}
      onMoveDown={() => handleMovePromptDown(row.promptId)}
      onPromptTreeDrop={(dropPayload) => onPromptTreeDrop(row.promptId, dropPayload)}
    />
  </PromptFolderSectionRow>
{/snippet}

{#snippet bottomSpacerRow({ virtualWindowHeightPx })}
  <BottomSpacer scrollContainerHeightPx={virtualWindowHeightPx} />
{/snippet}
