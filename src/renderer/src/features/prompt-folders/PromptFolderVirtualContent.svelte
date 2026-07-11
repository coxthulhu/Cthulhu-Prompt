<script lang="ts">
  import {
    PROMPT_FOLDER_SETTINGS_FIELDS,
    createEmptyPromptFolderSettings,
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
    promptEditorRowId,
    promptFolderEditorRowId
  } from './promptFolderRowIds'
  import PromptFolderSectionRow from './PromptFolderSectionRow.svelte'
  import {
    PROMPT_FOLDER_EDITOR_SIDE_RAIL_WIDTH_PX,
    getPromptFolderSectionContentOffsetPx,
    getPromptFolderSectionContentWidthPx
  } from './promptFolderSectionGutterMetrics'
  import {
    estimatePromptFolderSettingsFieldRowHeight,
    getPromptFolderEditorCollapsedCardRowHeightPx,
    getPromptFolderEditorCardRowHeightPx,
    getPromptFolderEditorRowPaddingTopPx
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
    PromptFolderDividerTarget,
    PromptFolderScreenDividerRow,
    PromptFolderScreenFolderEditorRow,
    PromptFolderScreenPlaceholderRow,
    PromptFolderScreenPromptEditorRow,
    PromptFolderScreenRow
  } from './promptFolderScreenRows'

  type PromptFolderRow =
    | (PromptFolderScreenFolderEditorRow & {
        isSettingsSectionExpanded: boolean
        isPromptsSectionExpanded: boolean
      })
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
    screenRootFolderId: string
    folderSettingsByFolderId: Record<string, PromptFolderSettings>
    promptEditorSizingConfig: PromptEditorSizingConfig
    promptDraftById: Record<string, PromptDraftRecord>
    promptMetadataByPromptId: Record<string, PromptMetadata>
    promptFolders: PromptFolder[]
    activeScreenRows: PromptFolderScreenRow[]
    visiblePromptIds: string[]
    completedPromptCount: number
    completedPromptOwnerByPromptId: Record<string, string>
    screenMode: PromptFolderScreenMode
    isCreatingPrompt: boolean
    promptFocusRequest: PromptFocusRequest | null
    settingsSectionExpandedByFolderId: Record<string, boolean>
    promptsSectionExpandedByFolderId: Record<string, boolean>
    initialScrollTopPx: number
    initialCenterRowId: string | null
    scrollToWithinWindowBandForRows: ScrollToWithinWindowBand
    onAddPrompt: (target: PromptFolderDividerTarget) => void
    onAddSubfolder: (target: PromptFolderDividerTarget) => void
    onDeletePrompt: (promptId: string) => void
    onSetPromptStatus: (
      ownerFolderId: string,
      promptId: string,
      status: PromptStatus
    ) => void
    onMovePromptUp: (promptId: string) => Promise<boolean>
    onMovePromptDown: (promptId: string) => Promise<boolean>
    onPromptTreeDrop: (
      promptId: string,
      dropPayload: PromptHandleDropPayload | null
    ) => void | Promise<void>
    onSettingsFieldChange: (
      ownerFolderId: string,
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
    onSettingsSectionToggle: (ownerFolderId: string) => void
    onPromptsSectionToggle: (ownerFolderId: string) => void
  }

  let {
    workspaceId,
    screenRootFolderId,
    folderSettingsByFolderId,
    promptEditorSizingConfig,
    promptDraftById,
    promptMetadataByPromptId,
    promptFolders,
    activeScreenRows,
    visiblePromptIds,
    completedPromptCount,
    completedPromptOwnerByPromptId,
    screenMode,
    isCreatingPrompt,
    promptFocusRequest,
    settingsSectionExpandedByFolderId,
    promptsSectionExpandedByFolderId,
    initialScrollTopPx,
    initialCenterRowId,
    scrollToWithinWindowBandForRows,
    onAddPrompt,
    onAddSubfolder,
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
  const emptyFolderSettings = createEmptyPromptFolderSettings()
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

  const getFolderSettings = (ownerFolderId: string): PromptFolderSettings =>
    folderSettingsByFolderId[ownerFolderId] ??
    promptFolderById[ownerFolderId]?.settings ??
    emptyFolderSettings

  const lookupFolderSettingsRowMeasuredHeight = (
    ownerFolderId: string,
    field: PromptFolderSettingsField,
    widthPx: number,
    devicePixelRatio: number
  ): number | null => {
    return lookupPromptFolderSettingsRowMeasuredHeight(
      ownerFolderId,
      field,
      widthPx,
      devicePixelRatio
    )
  }

  const getEstimatedFolderSettingsSectionHeights = (ownerFolderId: string) => {
    const folderSettings = getFolderSettings(ownerFolderId)
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

  const getFolderSettingsSectionHeights = (
    ownerFolderId: string,
    widthPx: number,
    devicePixelRatio: number
  ): Record<PromptFolderSettingsField, number> => {
    const estimatedHeights = getEstimatedFolderSettingsSectionHeights(ownerFolderId)
    return Object.fromEntries(
      PROMPT_FOLDER_SETTINGS_FIELDS.map((field) => [
        field,
        lookupFolderSettingsRowMeasuredHeight(
          ownerFolderId,
          field,
          widthPx,
          devicePixelRatio
        ) ?? estimatedHeights[field]
      ])
    ) as Record<PromptFolderSettingsField, number>
  }

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    'folder-editor': {
      estimateHeight: (row) => {
        const rowPaddingTopPx = getPromptFolderEditorRowPaddingTopPx(row.isRoot)
        return row.isSettingsSectionExpanded
          ? getPromptFolderEditorCardRowHeightPx(
              getEstimatedFolderSettingsSectionHeights(row.ownerFolderId),
              rowPaddingTopPx
            )
          : getPromptFolderEditorCollapsedCardRowHeightPx(rowPaddingTopPx)
      },
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) => {
        const rowPaddingTopPx = getPromptFolderEditorRowPaddingTopPx(row.isRoot)
        const settingsWidthPx = getPromptFolderSectionContentWidthPx(
          widthPx,
          row.indentLevel,
          row.isRoot ? 0 : PROMPT_FOLDER_EDITOR_SIDE_RAIL_WIDTH_PX
        )
        return row.isSettingsSectionExpanded
          ? getPromptFolderEditorCardRowHeightPx(
              getFolderSettingsSectionHeights(
                row.ownerFolderId,
                settingsWidthPx,
                devicePixelRatio
              ),
              rowPaddingTopPx
            )
          : getPromptFolderEditorCollapsedCardRowHeightPx(rowPaddingTopPx)
      },
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
            id: promptFolderEditorRowId(screenRootFolderId, row.ownerFolderId),
            row: {
              ...row,
              isSettingsSectionExpanded:
                settingsSectionExpandedByFolderId[row.ownerFolderId] ?? false,
              isPromptsSectionExpanded:
                promptsSectionExpandedByFolderId[row.ownerFolderId] ?? true
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
          ownerFolderId: screenRootFolderId,
          indentLevel: 0,
          isOwnerRoot: true,
          isRoot: true,
          isFirstSibling: true,
          isLastSibling: true,
          isSettingsSectionExpanded: false,
          isPromptsSectionExpanded: true
        }
      }
    ]

    if (promptsSectionExpandedByFolderId[screenRootFolderId] ?? true) {
      if (visiblePromptIds.length === 0) {
        completedRows.push({
          id: 'placeholder-empty',
          row: {
            kind: 'placeholder',
            ownerFolderId: screenRootFolderId,
            indentLevel: 1,
            isOwnerRoot: true
          }
        })
      } else {
        completedRows.push({
          id: 'divider-initial',
          row: {
            kind: 'prompt-divider',
            ownerFolderId: screenRootFolderId,
            previousEntryId: null,
            indentLevel: 1,
            isOwnerRoot: true
          }
        })

        visiblePromptIds.forEach((promptId, promptIndex) => {
          const ownerFolderId =
            completedPromptOwnerByPromptId[promptId] ?? screenRootFolderId
          completedRows.push({
            id: promptEditorRowId(promptId),
            row: {
              kind: 'prompt-editor',
              ownerFolderId,
              promptId,
              indentLevel: 1,
              isOwnerRoot: ownerFolderId === screenRootFolderId,
              isFirstPrompt: promptIndex === 0,
              isLastPrompt: promptIndex === visiblePromptIds.length - 1
            }
          })
          completedRows.push({
            id: promptDividerRowId(promptId),
            row: {
              kind: 'prompt-divider',
              ownerFolderId: screenRootFolderId,
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
    if (row?.kind === 'prompt-editor') {
      onCenterRowChange({
        kind: 'prompt',
        rowOwnerFolderId: row.ownerFolderId,
        promptId: row.promptId
      })
      return
    }
    if (
      !isCompletedMode &&
      row?.kind === 'folder-editor'
    ) {
      onCenterRowChange({
        kind: 'folder-settings',
        rowOwnerFolderId: row.ownerFolderId
      })
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
        folderId: screenRootFolderId
      }
    }

    return {
      kind: 'prompt',
      folderId: screenRootFolderId,
      promptId: previousPromptId,
      edge: 'bottom'
    }
  }

  const canDropOnPromptDivider = (
    previousPromptId: string | null,
    payload: PromptHandleDragPayload
  ): boolean => {
    if (payload.sourceFolderId !== screenRootFolderId) {
      return true
    }

    return (
      resolvePromptHandleDropMove(
        screenRootFolderId,
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
    if (row.isRoot && isCompletedMode) return visiblePromptIds.length

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
  {@const rowPaddingTopPx = getPromptFolderEditorRowPaddingTopPx(props.row.isRoot)}
  {@const contentWidthPx = getPromptFolderSectionContentWidthPx(
    props.virtualWindowWidthPx,
    props.row.indentLevel,
    props.row.isRoot ? 0 : PROMPT_FOLDER_EDITOR_SIDE_RAIL_WIDTH_PX
  )}
  {#if rowFolder}
    <PromptFolderSectionRow
      rowHeightPx={props.rowHeightPx}
      indentLevel={props.row.indentLevel}
    >
      <PromptFolderEditorRow
        {workspaceId}
        promptFolderId={rowFolder.id}
        folderDisplayName={rowFolder.displayName}
        promptCount={getFolderPromptCount(props.row)}
        completedPromptCount={getFolderCompletedPromptCount(props.row)}
        rowId={props.rowId}
        virtualWindowWidthPx={contentWidthPx}
        devicePixelRatio={props.devicePixelRatio}
        rowHeightPx={props.rowHeightPx}
        sectionHeightsPx={getFolderSettingsSectionHeights(
          rowFolder.id,
          contentWidthPx,
          props.devicePixelRatio
        )}
        hydrationPriority={props.hydrationPriority}
        shouldDehydrate={props.shouldDehydrate}
        overlayRowElement={props.overlayRowElement ?? null}
        scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
        onHydrationChange={props.onHydrationChange}
        folderSettings={getFolderSettings(rowFolder.id)}
        {rowPaddingTopPx}
        isSettingsSectionExpanded={props.row.isSettingsSectionExpanded}
        isPromptsSectionExpanded={props.row.isPromptsSectionExpanded}
        isReadOnly={isCompletedMode}
        canRename={props.row.isRoot && !isCompletedMode}
        showSidebar={!props.row.isRoot}
        isFirstSibling={props.row.isFirstSibling}
        isLastSibling={props.row.isLastSibling}
        onSettingsSectionToggle={() => onSettingsSectionToggle(rowFolder.id)}
        onPromptsSectionToggle={() => onPromptsSectionToggle(rowFolder.id)}
        onSettingsFieldChange={(field, text, measurement) =>
          onSettingsFieldChange(rowFolder.id, field, text, measurement)}
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
  {@const target = {
    ownerFolderId: row.ownerFolderId,
    previousEntryId: row.previousEntryId
  }}
  {@const isExistingRootPromptDivider =
    row.isOwnerRoot &&
    (row.previousEntryId === null || visiblePromptIds.includes(row.previousEntryId))}
  {@const showsActions = !isCompletedMode}
  <PromptFolderSectionRow
    {rowHeightPx}
    indentLevel={row.indentLevel}
    testId={`prompt-folder-divider-${row.ownerFolderId}-${row.previousEntryId ?? 'initial'}`}
  >
    <PromptDivider
      disabled={isCreatingPrompt}
      mode={showsActions ? 'add' : 'separator'}
      onAddPrompt={showsActions ? () => onAddPrompt(target) : undefined}
      onAddSubfolder={showsActions && (promptFolderById[row.ownerFolderId]?.depth ?? 8) < 8
        ? () => onAddSubfolder(target)
        : undefined}
      getDropOptions={!showsActions || !isExistingRootPromptDivider
        ? undefined
        : () => getPromptDividerDropOptions(rowId, row.previousEntryId)}
      testId={showsActions
        ? row.previousEntryId
          ? `prompt-divider-add-after-${row.previousEntryId}`
          : 'prompt-divider-add-initial'
        : undefined}
      subfolderTestId={showsActions
        ? row.previousEntryId
          ? `prompt-divider-add-subfolder-after-${row.previousEntryId}`
          : 'prompt-divider-add-subfolder-initial'
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
      folderSettings={getFolderSettings(row.ownerFolderId)}
      screenMode={screenMode}
      status={promptMetadata.status}
      completedAt={promptMetadata.completedAt}
      scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
      focusRequest={promptFocusRequest}
      isFirstPrompt={row.isFirstPrompt}
      isLastPrompt={row.isLastPrompt}
      isDragEnabled={!isCompletedMode && row.isOwnerRoot}
      onDelete={() => {
        if (row.isOwnerRoot) onDeletePrompt(row.promptId)
      }}
      onStatusChange={(status) => {
        if (isCompletedMode || row.isOwnerRoot) {
          onSetPromptStatus(row.ownerFolderId, row.promptId, status)
        }
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
