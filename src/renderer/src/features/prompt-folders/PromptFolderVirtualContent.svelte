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
    type VirtualWindowScrollApi
  } from '../virtualizer/virtualWindowTypes'
  import PromptFolderEditorRow from './PromptFolderEditorRow.svelte'
  import PromptFolderRootHeaderRow, {
    PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX
  } from './PromptFolderRootHeaderRow.svelte'
  import {
    PROMPT_FOLDER_ROOT_HEADER_ROW_ID,
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
    type DragFinishResult,
    type DraggableOptions,
    type DroppableOptions
  } from '../drag-drop/dragDrop.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    isPromptHandleDragPayload,
    resolvePromptHandleDropMove,
    type PromptFolderEntryDragPayload,
    type PromptHandleDropPayload,
    type PromptTreeEntryDragPayload
  } from '../drag-drop/promptHandleDrag'
  import { resolvePromptFolderEntryDropMove } from '../drag-drop/promptFolderEntryDrag'
  import { createPromptDragGhost } from '../drag-drop/promptDragGhost'
  import {
    clearPromptEntryDrag,
    startPromptFolderDrag
  } from '../drag-drop/promptEntryDragState.svelte.ts'
  import type {
    ActivePromptTreeRow,
    PromptFocusRequest
  } from './promptFolderScreenController.svelte.ts'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'
  import type {
    PromptFolderDividerTarget,
    PromptFolderPromptTarget,
    PromptFolderScreenDividerRow,
    PromptFolderScreenFolderEditorRow,
    PromptFolderScreenPlaceholderRow,
    PromptFolderScreenPromptEditorRow,
    PromptFolderScreenRootHeaderRow,
    PromptFolderScreenRow
  } from './promptFolderScreenRows'

  type PromptFolderRow =
    | PromptFolderScreenRootHeaderRow
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
    activePromptCount: number
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
    onDeletePrompt: (target: PromptFolderPromptTarget) => void
    onDeletePromptFolder: (promptFolderId: string) => void
    onSetPromptStatus: (target: PromptFolderPromptTarget, status: PromptStatus) => void
    canMovePrompt: (target: PromptFolderPromptTarget, direction: 'up' | 'down') => boolean
    onMovePromptUp: (target: PromptFolderPromptTarget) => Promise<boolean>
    onMovePromptDown: (target: PromptFolderPromptTarget) => Promise<boolean>
    onPromptTreeDrop: (
      target: PromptFolderPromptTarget,
      dropPayload: PromptHandleDropPayload | null
    ) => void | Promise<void>
    onPromptFolderTreeDrop: (
      source: PromptFolderEntryDragPayload,
      dropPayload: PromptHandleDropPayload | null
    ) => void
    onSettingsFieldChange: (
      ownerFolderId: string,
      field: PromptFolderSettingsDraftField,
      text: string,
      measurement: TextMeasurement
    ) => void
    onRenamePromptFolder: (promptFolderId: string) => void
    onScreenModeChange: (screenMode: PromptFolderScreenMode) => void
    onScrollToWithinWindowBandChange: (next: ScrollToWithinWindowBand | null) => void
    onScrollToAndTrackRowCenteredChange: (next: ScrollToAndTrackRowCentered | null) => void
    onScrollApiChange: (next: VirtualWindowScrollApi | null) => void
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
    activePromptCount,
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
    onDeletePromptFolder,
    onSetPromptStatus,
    onMovePromptUp,
    onMovePromptDown,
    canMovePrompt,
    onPromptTreeDrop,
    onPromptFolderTreeDrop,
    onSettingsFieldChange,
    onRenamePromptFolder,
    onScreenModeChange,
    onScrollToWithinWindowBandChange,
    onScrollToAndTrackRowCenteredChange,
    onScrollApiChange,
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
  const promptDividerDroppableState = createDroppableStateRegistry<string>()
  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)
  const todoPromptMetadata: PromptMetadata = {
    status: PromptStatus.Todo,
    completedAt: null
  }
  const emptyFolderSettings = createEmptyPromptFolderSettings()
  const promptFolderById = $derived.by(
    () =>
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
        lookupFolderSettingsRowMeasuredHeight(ownerFolderId, field, widthPx, devicePixelRatio) ??
          estimatedHeights[field]
      ])
    ) as Record<PromptFolderSettingsField, number>
  }

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    'root-header': {
      estimateHeight: () => PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX,
      centerRowEligible: true,
      snippet: rootHeaderRow
    },
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
              getFolderSettingsSectionHeights(row.ownerFolderId, settingsWidthPx, devicePixelRatio),
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
        if (row.kind === 'root-header') {
          return { id: PROMPT_FOLDER_ROOT_HEADER_ROW_ID, row }
        }

        if (row.kind === 'folder-editor') {
          return {
            id: promptFolderEditorRowId(screenRootFolderId, row.ownerFolderId),
            row: {
              ...row,
              isSettingsSectionExpanded:
                settingsSectionExpandedByFolderId[row.ownerFolderId] ?? false,
              isPromptsSectionExpanded: promptsSectionExpandedByFolderId[row.ownerFolderId] ?? true
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
        id: PROMPT_FOLDER_ROOT_HEADER_ROW_ID,
        row: { kind: 'root-header' }
      }
    ]

    if (visiblePromptIds.length === 0) {
      completedRows.push({
        id: 'placeholder-empty',
        row: {
          kind: 'placeholder',
          ownerFolderId: screenRootFolderId,
          indentLevel: 0,
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
          indentLevel: 0,
          isOwnerRoot: true
        }
      })

      visiblePromptIds.forEach((promptId, promptIndex) => {
        const ownerFolderId = completedPromptOwnerByPromptId[promptId] ?? screenRootFolderId
        completedRows.push({
          id: promptEditorRowId(promptId),
          row: {
            kind: 'prompt-editor',
            ownerFolderId,
            promptId,
            indentLevel: 0,
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
            indentLevel: 0,
            isOwnerRoot: true
          }
        })
      })
    }

    completedRows.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
    return completedRows
  })

  const handleCenterRowChange = (row: PromptFolderRow | null) => {
    if (row?.kind === 'root-header') {
      onCenterRowChange({ kind: 'root-header', rowOwnerFolderId: screenRootFolderId })
      return
    }
    if (row?.kind === 'prompt-editor') {
      onCenterRowChange({
        kind: 'prompt',
        rowOwnerFolderId: row.ownerFolderId,
        promptId: row.promptId
      })
      return
    }
    if (!isCompletedMode && row?.kind === 'folder-editor') {
      onCenterRowChange({
        kind: 'folder-settings',
        rowOwnerFolderId: row.ownerFolderId
      })
      return
    }
    onCenterRowChange(null)
  }

  const getRootEntryBlockRowIds = (entryId: string): string[] => {
    const endIndex = virtualItems.findIndex(
      ({ row }) =>
        row.kind === 'prompt-divider' && row.isOwnerRoot && row.previousEntryId === entryId
    )
    if (endIndex === -1) return []

    let previousRootDividerIndex = endIndex - 1
    while (previousRootDividerIndex >= 0) {
      const row = virtualItems[previousRootDividerIndex].row
      if (row.kind === 'prompt-divider' && row.isOwnerRoot) break
      previousRootDividerIndex -= 1
    }

    // A root subfolder block includes its editor, expanded descendants, and trailing divider.
    return virtualItems.slice(previousRootDividerIndex + 1, endIndex + 1).map(({ id }) => id)
  }

  const scrollByAdjacentEntryBlockHeight = (direction: 'up' | 'down', promptId: string) => {
    if (!scrollApi) return

    const rootEntryIds =
      promptFolderById[screenRootFolderId]?.entries.map((entry) => entry.id) ?? []
    const promptIndex = rootEntryIds.indexOf(promptId)
    const adjacentEntryId =
      direction === 'up' ? rootEntryIds[promptIndex - 1] : rootEntryIds[promptIndex + 1]
    if (!adjacentEntryId) return

    // Keep the clicked move button anchored while the adjacent root entry crosses it.
    scrollApi.scrollByRowHeights(getRootEntryBlockRowIds(adjacentEntryId), direction)
  }

  const handleMovePromptUp = (target: PromptFolderPromptTarget): Promise<boolean> => {
    if (target.ownerFolderId === screenRootFolderId) {
      scrollByAdjacentEntryBlockHeight('up', target.promptId)
    }
    return onMovePromptUp(target)
  }

  const handleMovePromptDown = (target: PromptFolderPromptTarget): Promise<boolean> => {
    if (target.ownerFolderId === screenRootFolderId) {
      scrollByAdjacentEntryBlockHeight('down', target.promptId)
    }
    return onMovePromptDown(target)
  }

  const getPromptDividerDropPayload = (
    ownerFolderId: string,
    previousEntryId: string | null
  ): PromptHandleDropPayload => {
    return {
      folderId: ownerFolderId,
      targetEntryId: previousEntryId,
      position: 'after'
    }
  }

  const canDropOnPromptDivider = (
    ownerFolderId: string,
    previousEntryId: string | null,
    payload: PromptTreeEntryDragPayload
  ): boolean => {
    const destinationFolder = promptFolderById[ownerFolderId]
    if (!destinationFolder) return false
    const dropPayload = getPromptDividerDropPayload(ownerFolderId, previousEntryId)

    if (!isPromptHandleDragPayload(payload)) {
      return (
        resolvePromptFolderEntryDropMove(
          promptFolders,
          getActiveEntryIds,
          payload.folderId,
          dropPayload
        ) !== null
      )
    }

    const sourceFolder = promptFolderById[payload.sourceFolderId]
    if (!sourceFolder) return false
    return (
      resolvePromptHandleDropMove(
        sourceFolder.id,
        getActiveEntryIds(sourceFolder),
        payload.fromId,
        dropPayload,
        getActiveEntryIds(destinationFolder)
      ) !== null
    )
  }

  const getPromptDividerDropOptions = (
    rowId: string,
    ownerFolderId: string,
    previousPromptId: string | null
  ): DroppableOptions<PromptTreeEntryDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges: 'none',
    payload: () => getPromptDividerDropPayload(ownerFolderId, previousPromptId),
    canDrop: (payload) => canDropOnPromptDivider(ownerFolderId, previousPromptId, payload),
    state: promptDividerDroppableState.getState(rowId)
  })

  const getActiveEntryIds = (folder: PromptFolder): string[] =>
    folder.entries.flatMap((entry) => {
      if (entry.kind === 'folder') return [entry.id]
      return promptMetadataByPromptId[entry.id]?.status === PromptStatus.Completed ? [] : [entry.id]
    })

  const getPromptFolderDropOptions = (
    promptFolderId: string
  ): DroppableOptions<PromptTreeEntryDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges: 'none',
    payload: {
      folderId: promptFolderId,
      targetEntryId: null,
      position: 'after'
    },
    canDrop: (payload) => canDropOnPromptDivider(promptFolderId, null, payload)
  })

  const getPromptFolderDragOptions = (
    promptFolder: PromptFolder
  ): DraggableOptions<PromptFolderEntryDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: { folderId: promptFolder.id },
    createGhost: () => createPromptDragGhost(promptFolder.displayName, 'folder'),
    onDragStart: () => {
      startPromptFolderDrag(promptFolder.id)
    },
    onDragFinish: ({
      sourcePayload,
      dropPayload
    }: DragFinishResult<PromptFolderEntryDragPayload, PromptHandleDropPayload>) => {
      clearPromptEntryDrag()
      onPromptFolderTreeDrop(sourcePayload, dropPayload)
    }
  })

  const getFolderPromptCount = (row: PromptFolderScreenFolderEditorRow): number => {
    if (row.isRoot && isCompletedMode) return visiblePromptIds.length

    const folder = promptFolderById[row.ownerFolderId]
    if (!folder) return 0
    return folder.entries.filter(
      (entry) =>
        entry.kind === 'prompt' &&
        promptMetadataByPromptId[entry.id] !== undefined &&
        promptMetadataByPromptId[entry.id]?.status !== PromptStatus.Completed
    ).length
  }

  const getFolderCompletedPromptCount = (row: PromptFolderScreenFolderEditorRow): number => {
    if (row.isRoot) return completedPromptCount
    return Object.values(completedPromptOwnerByPromptId).filter(
      (ownerFolderId) => ownerFolderId === row.ownerFolderId
    ).length
  }

  const getFolderSubfolderCount = (row: PromptFolderScreenFolderEditorRow): number =>
    promptFolderById[row.ownerFolderId]?.entries.filter((entry) => entry.kind === 'folder')
      .length ?? 0

  const getFolderDepth = (targetFolderId: string): number => {
    const visit = (folderId: string, depth: number): number | null => {
      if (folderId === targetFolderId) return depth
      const folder = promptFolderById[folderId]
      if (!folder) return null
      for (const entry of folder.entries) {
        if (entry.kind !== 'folder') continue
        const foundDepth = visit(entry.id, depth + 1)
        if (foundDepth !== null) return foundDepth
      }
      return null
    }

    return visit(screenRootFolderId, 0) ?? 8
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
  {onScrollTopChange}
  onCenterRowChange={(row) => {
    handleCenterRowChange(row)
  }}
  onUserScroll={() => {
    onUserScroll()
  }}
/>

{#snippet rootHeaderRow()}
  <PromptFolderRootHeaderRow
    folderDisplayName={promptFolderById[screenRootFolderId]?.displayName ?? 'Prompt Folder'}
    {activePromptCount}
    {completedPromptCount}
    {screenMode}
    {isCreatingPrompt}
    onAddPrompt={() => onAddPrompt({ ownerFolderId: screenRootFolderId, previousEntryId: null })}
    onRenamePromptFolder={() => onRenamePromptFolder(screenRootFolderId)}
    onDeletePromptFolder={() => onDeletePromptFolder(screenRootFolderId)}
    {onScreenModeChange}
  />
{/snippet}

{#snippet folderEditorRow(props)}
  {@const ownerFolderId = props.row.ownerFolderId}
  {@const rowFolder = promptFolderById[ownerFolderId]}
  {@const rowPaddingTopPx = getPromptFolderEditorRowPaddingTopPx(props.row.isRoot)}
  {@const contentWidthPx = getPromptFolderSectionContentWidthPx(
    props.virtualWindowWidthPx,
    props.row.indentLevel,
    props.row.isRoot ? 0 : PROMPT_FOLDER_EDITOR_SIDE_RAIL_WIDTH_PX
  )}
  {#if rowFolder}
    <PromptFolderSectionRow rowHeightPx={props.rowHeightPx} indentLevel={props.row.indentLevel}>
      <PromptFolderEditorRow
        {workspaceId}
        promptFolderId={ownerFolderId}
        folderDisplayName={rowFolder.displayName}
        promptCount={getFolderPromptCount(props.row)}
        completedPromptCount={getFolderCompletedPromptCount(props.row)}
        subfolderCount={getFolderSubfolderCount(props.row)}
        rowId={props.rowId}
        virtualWindowWidthPx={contentWidthPx}
        devicePixelRatio={props.devicePixelRatio}
        rowHeightPx={props.rowHeightPx}
        sectionHeightsPx={getFolderSettingsSectionHeights(
          ownerFolderId,
          contentWidthPx,
          props.devicePixelRatio
        )}
        hydrationPriority={props.hydrationPriority}
        shouldDehydrate={props.shouldDehydrate}
        overlayRowElement={props.overlayRowElement ?? null}
        scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
        onHydrationChange={props.onHydrationChange}
        folderSettings={getFolderSettings(ownerFolderId)}
        {rowPaddingTopPx}
        isSettingsSectionExpanded={props.row.isSettingsSectionExpanded}
        isPromptsSectionExpanded={props.row.isPromptsSectionExpanded}
        isReadOnly={isCompletedMode}
        canRename={!isCompletedMode}
        showSidebar={!props.row.isRoot}
        dragOptions={!props.row.isRoot && !isCompletedMode
          ? getPromptFolderDragOptions(rowFolder)
          : undefined}
        dropOptions={!props.row.isRoot && !isCompletedMode
          ? getPromptFolderDropOptions(ownerFolderId)
          : undefined}
        onSettingsSectionToggle={() => onSettingsSectionToggle(ownerFolderId)}
        onPromptsSectionToggle={() => onPromptsSectionToggle(ownerFolderId)}
        onSettingsFieldChange={(field, text, measurement) =>
          onSettingsFieldChange(ownerFolderId, field, text, measurement)}
        onRenamePromptFolder={() => onRenamePromptFolder(ownerFolderId)}
        onDeletePromptFolder={() => onDeletePromptFolder(ownerFolderId)}
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
    <p>
      {isCompletedMode
        ? 'No completed prompts found in this folder'
        : 'No prompts found in this folder.'}
    </p>
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
      onAddSubfolder={showsActions && getFolderDepth(row.ownerFolderId) < 8
        ? () => onAddSubfolder(target)
        : undefined}
      getDropOptions={!showsActions
        ? undefined
        : () => getPromptDividerDropOptions(rowId, row.ownerFolderId, row.previousEntryId)}
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
  {@const promptTarget = { ownerFolderId: row.ownerFolderId, promptId: row.promptId }}
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
      {screenMode}
      status={promptMetadata.status}
      completedAt={promptMetadata.completedAt}
      scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
      focusRequest={promptFocusRequest}
      isFirstPrompt={!canMovePrompt(promptTarget, 'up')}
      isLastPrompt={!canMovePrompt(promptTarget, 'down')}
      isDragEnabled={!isCompletedMode}
      onDelete={() => onDeletePrompt({ ownerFolderId: row.ownerFolderId, promptId: row.promptId })}
      onStatusChange={(status) => {
        onSetPromptStatus({ ownerFolderId: row.ownerFolderId, promptId: row.promptId }, status)
      }}
      onMoveUp={() => (isCompletedMode ? Promise.resolve(false) : handleMovePromptUp(promptTarget))}
      onMoveDown={() =>
        isCompletedMode ? Promise.resolve(false) : handleMovePromptDown(promptTarget)}
      onPromptTreeDrop={(dropPayload) => {
        if (isCompletedMode) return
        return onPromptTreeDrop(promptTarget, dropPayload)
      }}
    />
  </PromptFolderSectionRow>
{/snippet}

{#snippet bottomSpacerRow({ virtualWindowHeightPx })}
  <BottomSpacer scrollContainerHeightPx={virtualWindowHeightPx} />
{/snippet}
