<script lang="ts">
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
  import PromptFolderEditorRow from './PromptFolderEditorRow.svelte'
  import {
    PROMPT_FOLDER_SETTINGS_ROW_ID,
    promptDividerRowId,
    promptEditorRowId
  } from './promptFolderRowIds'
  import PromptFolderSectionRow, {
    PROMPT_FOLDER_SECTION_GUTTER_OFFSET_PX
  } from './PromptFolderSectionRow.svelte'
  import {
    estimatePromptFolderSettingsFieldRowHeight,
    getPromptFolderEditorCollapsedCardRowHeightPx,
    getPromptFolderEditorCardRowHeightPx
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
  import { PromptFolderScreenMode } from './promptFolderScreenMode'

  type PromptFolderRow =
    | { kind: 'folder-editor'; isSettingsSectionExpanded: boolean }
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
    folderDisplayName: string
    promptDraftById: Record<string, PromptDraftRecord>
    completedAtByPromptId: Record<string, string>
    visiblePromptIds: string[]
    screenMode: PromptFolderScreenMode
    isCreatingPrompt: boolean
    promptFocusRequest: PromptFocusRequest | null
    isSettingsSectionExpanded: boolean
    isPromptsSectionExpanded: boolean
    initialScrollTopPx: number
    initialCenterRowId: string | null
    scrollToWithinWindowBandForRows: ScrollToWithinWindowBand
    onAddPrompt: (previousPromptId: string | null) => void
    onDeletePrompt: (promptId: string) => void
    onCompletePrompt: (promptId: string) => void
    onUncompletePrompt: (promptId: string) => void
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
    onScrollApiChange: (next: VirtualWindowScrollApi | null) => void
    onViewportMetricsChange: (next: VirtualWindowViewportMetrics | null) => void
    onScrollTopChange: (nextScrollTop: number) => void
    onCenterRowChange: (row: ActivePromptTreeRow | null) => void
    onUserScroll: () => void
    onInitialCenterRowApplied: () => void
    onSettingsSectionToggle: () => void
    onPromptsSectionToggle: () => void
  }

  let {
    workspaceId,
    promptFolderId,
    folderSettings,
    promptEditorSizingConfig,
    folderDisplayName,
    promptDraftById,
    completedAtByPromptId,
    visiblePromptIds,
    screenMode,
    isCreatingPrompt,
    promptFocusRequest,
    isSettingsSectionExpanded,
    isPromptsSectionExpanded,
    initialScrollTopPx,
    initialCenterRowId,
    scrollToWithinWindowBandForRows,
    onAddPrompt,
    onDeletePrompt,
    onCompletePrompt,
    onUncompletePrompt,
    onMovePromptUp,
    onMovePromptDown,
    onPromptTreeDrop,
    onSettingsFieldChange,
    onScrollToWithinWindowBandChange,
    onScrollToAndTrackRowCenteredChange,
    onScrollApiChange,
    onViewportMetricsChange,
    onScrollTopChange,
    onCenterRowChange,
    onUserScroll,
    onInitialCenterRowApplied,
    onSettingsSectionToggle,
    onPromptsSectionToggle
  }: PromptFolderVirtualContentProps = $props()

  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let scrollToAndTrackRowCentered = $state<ScrollToAndTrackRowCentered | null>(null)
  let scrollApi = $state<VirtualWindowScrollApi | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  const promptDividerDroppableState = createDroppableStateRegistry<string>()
  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)

  // Side effect: expose the virtual window band-scroll API to the controller.
  $effect(() => {
    onScrollToWithinWindowBandChange(scrollToWithinWindowBand)
  })

  // Side effect: expose the center-row tracking API to the controller.
  $effect(() => {
    onScrollToAndTrackRowCenteredChange(scrollToAndTrackRowCentered)
  })

  // Side effect: expose the virtual window scroll API to the controller.
  $effect(() => {
    onScrollApiChange(scrollApi)
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

  const getEstimatedPromptFolderSettingsSectionHeights = () => {
    return Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
        field,
        estimatePromptFolderSettingsFieldRowHeight(
          folderSettings[field],
          promptEditorSizingConfig.fontSize
        )
      ])
    ) as Record<PromptFolderSettingsField, number>
  }

  const getPromptFolderSettingsSectionHeights = (
    widthPx: number,
    devicePixelRatio: number
  ): Record<PromptFolderSettingsField, number> => {
    const estimatedHeights = getEstimatedPromptFolderSettingsSectionHeights()
    return Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
        field,
        lookupPromptFolderSettingsRowMeasuredHeightForScreen(
          field,
          widthPx,
          devicePixelRatio
        ) ?? estimatedHeights[field]
      ])
    ) as Record<PromptFolderSettingsField, number>
  }

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    'folder-editor': {
      estimateHeight: (row) =>
        row.isSettingsSectionExpanded
          ? getPromptFolderEditorCardRowHeightPx(getEstimatedPromptFolderSettingsSectionHeights())
          : getPromptFolderEditorCollapsedCardRowHeightPx(),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) =>
        row.isSettingsSectionExpanded
          ? getPromptFolderEditorCardRowHeightPx(
              getPromptFolderSettingsSectionHeights(widthPx, devicePixelRatio)
            )
          : getPromptFolderEditorCollapsedCardRowHeightPx(),
      centerRowEligible: true,
      hydrationPriorityEligible: true,
      overlayRow: {},
      dehydrateOnWidthResize: true,
      snippet: folderEditorRow
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
    const rows: VirtualWindowItem<PromptFolderRow>[] = []

    if (!isCompletedMode) {
      rows.push({
        id: PROMPT_FOLDER_SETTINGS_ROW_ID,
        row: {
          kind: 'folder-editor',
          isSettingsSectionExpanded
        }
      })
    }

    if (isPromptsSectionExpanded) {
      if (visiblePromptIds.length === 0) {
        if (!isCompletedMode) {
          rows.push({
            id: 'divider-initial',
            row: { kind: 'prompt-divider', previousPromptId: null }
          })
        }
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
    }

    rows.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
    return rows
  })

  const handleCenterRowChange = (row: PromptFolderRow | null) => {
    if (row?.kind === 'prompt-editor') {
      onCenterRowChange({ kind: 'prompt', promptId: row.promptId })
      return
    }
    if (
      !isCompletedMode &&
      row?.kind === 'folder-editor'
    ) {
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

{#snippet folderEditorRow(props)}
  <PromptFolderEditorRow
    {workspaceId}
    {promptFolderId}
    {folderDisplayName}
    promptCount={visiblePromptIds.length}
    rowId={props.rowId}
    virtualWindowWidthPx={props.virtualWindowWidthPx}
    devicePixelRatio={props.devicePixelRatio}
    rowHeightPx={props.rowHeightPx}
    sectionHeightsPx={getPromptFolderSettingsSectionHeights(
      props.virtualWindowWidthPx,
      props.devicePixelRatio
    )}
    hydrationPriority={props.hydrationPriority}
    shouldDehydrate={props.shouldDehydrate}
    overlayRowElement={props.overlayRowElement ?? null}
    scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
    onHydrationChange={props.onHydrationChange}
    {folderSettings}
    {isSettingsSectionExpanded}
    {isPromptsSectionExpanded}
    {onSettingsSectionToggle}
    {onPromptsSectionToggle}
    {onSettingsFieldChange}
  />
{/snippet}

{#snippet placeholderRow({ rowHeightPx })}
  <PromptFolderSectionRow
    {rowHeightPx}
    contentClass="text-center py-12 text-[var(--ui-secondary-text)]"
    showGutter={false}
  >
    <p>{isCompletedMode ? 'No completed prompts found in this folder' : 'No prompts found in this folder.'}</p>
    {#if !isCompletedMode}
      <p class="text-sm mt-2">Click the Add Prompt button to create your first prompt.</p>
    {/if}
  </PromptFolderSectionRow>
{/snippet}

{#snippet dividerRow({ row, rowId, rowHeightPx })}
  <PromptFolderSectionRow {rowHeightPx}>
    <PromptDivider
      disabled={isCreatingPrompt}
      mode={isCompletedMode ? 'separator' : 'add'}
      onAddPrompt={isCompletedMode ? undefined : () => onAddPrompt(row.previousPromptId)}
      getDropOptions={isCompletedMode
        ? undefined
        : () => getPromptDividerDropOptions(rowId, row.previousPromptId)}
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
      {folderSettings}
      screenMode={screenMode}
      completedAt={completedAtByPromptId[row.promptId] ?? null}
      scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
      focusRequest={promptFocusRequest}
      isFirstPrompt={promptIndex === 0}
      isLastPrompt={promptIndex === visiblePromptIds.length - 1}
      onDelete={() => onDeletePrompt(row.promptId)}
      onComplete={isCompletedMode ? undefined : () => onCompletePrompt(row.promptId)}
      onUncomplete={isCompletedMode ? () => onUncompletePrompt(row.promptId) : undefined}
      onMoveUp={() => (isCompletedMode ? Promise.resolve(false) : handleMovePromptUp(row.promptId))}
      onMoveDown={() =>
        isCompletedMode ? Promise.resolve(false) : handleMovePromptDown(row.promptId)}
      onPromptTreeDrop={(dropPayload) => {
        if (isCompletedMode) return
        return onPromptTreeDrop(row.promptId, dropPayload)
      }}
    />
  </PromptFolderSectionRow>
{/snippet}

{#snippet bottomSpacerRow({ virtualWindowHeightPx })}
  <BottomSpacer scrollContainerHeightPx={virtualWindowHeightPx} />
{/snippet}
