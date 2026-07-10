<script lang="ts">
  import {
    PROMPT_FOLDER_SETTINGS_FIELDS,
    type PromptFolder,
    type PromptFolderSettings,
    type PromptFolderSettingsField
  } from '@shared/PromptFolder'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import { lookupPromptEditorMeasuredHeight } from '@renderer/data/UiState/PromptDraftUiCache.svelte.ts'
  import { lookupPromptFolderSettingsRowMeasuredHeight } from '@renderer/data/UiState/PromptFolderDraftUiCache.svelte.ts'
  import type { PromptDraftRecord } from '@renderer/data/Collections/PromptDraftCollection'
  import { PromptStatus } from '@shared/Prompt'
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
  import PromptFolderSectionRow from './PromptFolderSectionRow.svelte'
  import {
    getPromptFolderSectionContentOffsetPx,
    getPromptFolderSectionContentWidthPx
  } from './promptFolderSectionGutterMetrics'
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
  import type {
    PromptFolderScreenDividerRow,
    PromptFolderScreenFolderEditorRow,
    PromptFolderScreenPlaceholderRow,
    PromptFolderScreenPromptEditorRow,
    PromptFolderScreenRow
  } from './promptFolderScreenRows'

  type PromptFolderRow =
    | (PromptFolderScreenFolderEditorRow & { isSettingsSectionExpanded: boolean })
    | PromptFolderScreenPlaceholderRow
    | PromptFolderScreenDividerRow
    | PromptFolderScreenPromptEditorRow
    | { kind: 'bottom-spacer' }

  type PromptEditorRowProps = VirtualWindowRowComponentProps<
    Extract<PromptFolderRow, { kind: 'prompt-editor' }>
  >

  type PromptMetadata = {
    status: PromptStatus
    completedAt: string | null
  }

  type PromptFolderVirtualContentProps = {
    workspaceId: string | null
    promptFolderId: string
    folderSettings: PromptFolderSettings
    promptEditorSizingConfig: PromptEditorSizingConfig
    folderDisplayName: string
    promptDraftById: Record<string, PromptDraftRecord>
    promptMetadataByPromptId: Record<string, PromptMetadata>
    promptFolders: PromptFolder[]
    activeScreenRows: PromptFolderScreenRow[]
    visiblePromptIds: string[]
    completedPromptCount: number
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
    onSetPromptStatus: (promptId: string, status: PromptStatus) => void
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
    onRenamePromptFolder: () => void
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
    promptMetadataByPromptId,
    promptFolders,
    activeScreenRows,
    visiblePromptIds,
    completedPromptCount,
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
    onSetPromptStatus,
    onMovePromptUp,
    onMovePromptDown,
    onPromptTreeDrop,
    onSettingsFieldChange,
    onRenamePromptFolder,
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
  const todoPromptMetadata: PromptMetadata = {
    status: PromptStatus.Todo,
    completedAt: null
  }
  const promptFolderById = $derived.by(() =>
    Object.fromEntries(promptFolders.map((folder) => [folder.id, folder])) as Record<
      string,
      PromptFolder
    >
  )

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
          getPromptFolderSectionContentWidthPx(widthPx, row.indentLevel),
          heightPx,
          promptEditorSizingConfig
        ),
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) => {
        const measuredRowHeightPx = lookupPromptEditorMeasuredHeight(
          row.promptId,
          getPromptFolderSectionContentWidthPx(widthPx, row.indentLevel),
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
    if (!isCompletedMode) {
      const activeRows = activeScreenRows.map((row): VirtualWindowItem<PromptFolderRow> => {
        if (row.kind === 'folder-editor') {
          return {
            id: row.isRoot ? PROMPT_FOLDER_SETTINGS_ROW_ID : `folder-settings:${row.ownerFolderId}`,
            row: {
              ...row,
              isSettingsSectionExpanded: row.isRoot && isSettingsSectionExpanded
            }
          }
        }

        if (row.kind === 'prompt-editor') {
          return {
            id: promptEditorRowId(row.promptId),
            row
          }
        }

        if (row.kind === 'prompt-divider') {
          const previousEntryId = row.previousEntryId
          const id = row.isOwnerRoot
            ? previousEntryId === null
              ? 'divider-initial'
              : promptDividerRowId(previousEntryId)
            : `divider:${row.ownerFolderId}:${previousEntryId ?? 'initial'}`
          return { id, row }
        }

        return { id: 'placeholder-empty', row }
      })

      activeRows.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
      return activeRows
    }

    const completedRows: VirtualWindowItem<PromptFolderRow>[] = [
      {
        id: PROMPT_FOLDER_SETTINGS_ROW_ID,
        row: {
          kind: 'folder-editor',
          ownerFolderId: promptFolderId,
          indentLevel: 0,
          isOwnerRoot: true,
          isRoot: true,
          isFirstSibling: true,
          isLastSibling: true,
          isSettingsSectionExpanded: false
        }
      }
    ]

    if (isPromptsSectionExpanded) {
      if (visiblePromptIds.length === 0) {
        completedRows.push({
          id: 'placeholder-empty',
          row: {
            kind: 'placeholder',
            ownerFolderId: promptFolderId,
            indentLevel: 1,
            isOwnerRoot: true
          }
        })
      } else {
        completedRows.push({
          id: 'divider-initial',
          row: {
            kind: 'prompt-divider',
            ownerFolderId: promptFolderId,
            previousEntryId: null,
            indentLevel: 1,
            isOwnerRoot: true
          }
        })

        visiblePromptIds.forEach((promptId, promptIndex) => {
          completedRows.push({
            id: promptEditorRowId(promptId),
            row: {
              kind: 'prompt-editor',
              ownerFolderId: promptFolderId,
              promptId,
              indentLevel: 1,
              isOwnerRoot: true,
              isFirstPrompt: promptIndex === 0,
              isLastPrompt: promptIndex === visiblePromptIds.length - 1
            }
          })
          completedRows.push({
            id: promptDividerRowId(promptId),
            row: {
              kind: 'prompt-divider',
              ownerFolderId: promptFolderId,
              previousEntryId: promptId,
              indentLevel: 1,
              isOwnerRoot: true
            }
          })
        })
      }
    }

    completedRows.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
    return completedRows
  })

  const handleCenterRowChange = (row: PromptFolderRow | null) => {
    if (row?.kind === 'prompt-editor' && row.isOwnerRoot) {
      onCenterRowChange({ kind: 'prompt', promptId: row.promptId })
      return
    }
    if (
      !isCompletedMode &&
      row?.kind === 'folder-editor' &&
      row.isRoot
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

  const getFolderPromptCount = (row: PromptFolderScreenFolderEditorRow): number => {
    if (row.isRoot) return visiblePromptIds.length

    const folder = promptFolderById[row.ownerFolderId]
    if (!folder) return 0
    return folder.entryIds.filter(
      (entryId) => promptDraftById[entryId] && !promptFolderById[entryId]
    ).length
  }

  const getFolderCompletedPromptCount = (
    row: PromptFolderScreenFolderEditorRow
  ): number => {
    if (row.isRoot) return completedPromptCount
    return promptFolderById[row.ownerFolderId]?.completedPromptIds.length ?? 0
  }
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
  {@const rowFolder = promptFolderById[props.row.ownerFolderId]}
  {#if rowFolder}
    <PromptFolderSectionRow
      rowHeightPx={props.rowHeightPx}
      indentLevel={props.row.indentLevel}
    >
      <PromptFolderEditorRow
        {workspaceId}
        promptFolderId={rowFolder.id}
        folderDisplayName={props.row.isRoot ? folderDisplayName : rowFolder.displayName}
        promptCount={getFolderPromptCount(props.row)}
        completedPromptCount={getFolderCompletedPromptCount(props.row)}
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
        folderSettings={props.row.isRoot ? folderSettings : rowFolder.settings}
        isSettingsSectionExpanded={props.row.isRoot && isSettingsSectionExpanded}
        isPromptsSectionExpanded={props.row.isRoot ? isPromptsSectionExpanded : true}
        isReadOnly={isCompletedMode || !props.row.isRoot}
        onSettingsSectionToggle={props.row.isRoot ? onSettingsSectionToggle : () => {}}
        onPromptsSectionToggle={props.row.isRoot ? onPromptsSectionToggle : () => {}}
        onSettingsFieldChange={props.row.isRoot ? onSettingsFieldChange : () => {}}
        onRenamePromptFolder={props.row.isRoot ? onRenamePromptFolder : () => {}}
      />
    </PromptFolderSectionRow>
  {/if}
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
  {@const isExistingRootDivider =
    row.isOwnerRoot &&
    (row.previousEntryId === null || visiblePromptIds.includes(row.previousEntryId))}
  {@const showsAddPrompt = !isCompletedMode && isExistingRootDivider}
  <PromptFolderSectionRow
    {rowHeightPx}
    indentLevel={row.indentLevel}
    testId={`prompt-folder-divider-${row.ownerFolderId}-${row.previousEntryId ?? 'initial'}`}
  >
    <PromptDivider
      disabled={isCreatingPrompt}
      mode={showsAddPrompt ? 'add' : 'separator'}
      onAddPrompt={showsAddPrompt ? () => onAddPrompt(row.previousEntryId) : undefined}
      getDropOptions={!showsAddPrompt
        ? undefined
        : () => getPromptDividerDropOptions(rowId, row.previousEntryId)}
      testId={showsAddPrompt
        ? row.previousEntryId
          ? `prompt-divider-add-after-${row.previousEntryId}`
          : 'prompt-divider-add-initial'
        : undefined}
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
  {@const promptMetadata = promptMetadataByPromptId[row.promptId] ?? todoPromptMetadata}
  {@const contentWidthPx = getPromptFolderSectionContentWidthPx(
    virtualWindowWidthPx,
    row.indentLevel
  )}
  {@const contentOffsetPx = getPromptFolderSectionContentOffsetPx(row.indentLevel)}
  <PromptFolderSectionRow {rowHeightPx} indentLevel={row.indentLevel}>
    <PromptEditorRow
      {workspaceId}
      promptFolderId={row.ownerFolderId}
      promptId={row.promptId}
      promptDraftRecord={promptDraftById[row.promptId]!}
      {rowId}
      virtualWindowWidthPx={contentWidthPx}
      rowContentLeftOffsetPx={contentOffsetPx}
      {devicePixelRatio}
      {rowHeightPx}
      {hydrationPriority}
      {shouldDehydrate}
      {overlayRowElement}
      {onHydrationChange}
      {folderSettings}
      screenMode={screenMode}
      status={promptMetadata.status}
      completedAt={promptMetadata.completedAt}
      scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
      focusRequest={promptFocusRequest}
      isFirstPrompt={row.isFirstPrompt}
      isLastPrompt={row.isLastPrompt}
      onDelete={() => {
        if (row.isOwnerRoot) onDeletePrompt(row.promptId)
      }}
      onStatusChange={(status) => {
        if (row.isOwnerRoot) onSetPromptStatus(row.promptId, status)
      }}
      onMoveUp={() =>
        isCompletedMode || !row.isOwnerRoot
          ? Promise.resolve(false)
          : handleMovePromptUp(row.promptId)}
      onMoveDown={() =>
        isCompletedMode || !row.isOwnerRoot
          ? Promise.resolve(false)
          : handleMovePromptDown(row.promptId)}
      onPromptTreeDrop={(dropPayload) => {
        if (isCompletedMode || !row.isOwnerRoot) return
        return onPromptTreeDrop(row.promptId, dropPayload)
      }}
    />
  </PromptFolderSectionRow>
{/snippet}

{#snippet bottomSpacerRow({ virtualWindowHeightPx })}
  <BottomSpacer scrollContainerHeightPx={virtualWindowHeightPx} />
{/snippet}
