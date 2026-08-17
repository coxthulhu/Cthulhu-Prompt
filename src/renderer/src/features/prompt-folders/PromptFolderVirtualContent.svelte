<script lang="ts">
  import {
    type PromptFolder,
    type PromptFolderContentKind
  } from '@shared/PromptFolder'
  import type { Category } from '@shared/Category'
  import type { TextMeasurement } from '@renderer/data/measuredHeightCache'
  import { lookupPromptEditorMeasuredHeight } from '@renderer/data/UiState/PromptDraftUiCache.svelte.ts'
  import { lookupCategoryDescriptionMeasuredHeight } from '@renderer/data/UiState/CategoryDraftUiCache.svelte.ts'
  import type { MarkdownContentDraftRecord } from './promptFolderScreenController.svelte.ts'
  import { PromptStatus, type PromptTemplateReference } from '@shared/Prompt'
  import PromptEditorRow from '../prompt-editor/PromptEditorRow.svelte'
  import PromptTemplateEditorRow from '../prompt-editor/PromptTemplateEditorRow.svelte'
  import PromptTemplateSelectionDialog from '../prompt-editor/PromptTemplateSelectionDialog.svelte'
  import { applyPromptTemplates } from '../prompt-editor/promptTemplatingEngine'
  import { setPromptDraftTemplates } from '@renderer/data/UiState/PromptDraftMutations.svelte.ts'
  import {
    clampMonacoHeightPx,
    EDITOR_SUBTITLE_BAR_HEIGHT_PX,
    estimatePromptEditorHeight,
    getMonacoHeightFromRowPx,
    getPromptEditorTitleAreaWidthPx,
    getRowHeightPx,
    PROMPT_TEMPLATE_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX,
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
  import CategoryEditorRow from './CategoryEditorRow.svelte'
  import PromptFolderRootHeaderRow, {
    PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX
  } from './PromptFolderRootHeaderRow.svelte'
  import {
    PROMPT_FOLDER_ROOT_HEADER_ROW_ID,
    promptDividerRowId,
    promptEditorRowId,
    promptFolderDividerRowId,
    categoryEditorRowId
  } from './promptFolderRowIds'
  import PromptFolderSectionRow from './PromptFolderSectionRow.svelte'
  import {
    CATEGORY_EDITOR_SIDE_RAIL_WIDTH_PX,
    getPromptFolderSectionContentOffsetPx,
    getPromptFolderSectionContentWidthPx
  } from './promptFolderSectionGutterMetrics'
  import {
    estimateCategoryDescriptionRowHeight,
    getCategoryEditorCollapsedRowHeightPx,
    getCategoryEditorRowHeightPx
  } from './categoryEditorSizing'
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
    type CategoryDragPayload,
    type PromptHandleDropPayload,
    type PromptTreeEntryDragPayload
  } from '../drag-drop/promptHandleDrag'
  import { createPromptDragGhost } from '../drag-drop/promptDragGhost'
  import {
    clearPromptEntryDrag,
    startCategoryDrag
  } from '../drag-drop/promptEntryDragState.svelte.ts'
  import type { ActivePromptScreenRow } from './promptFolderScreenController.svelte.ts'
  import InlineTextButton from '@renderer/common/cthulhu-ui/InlineTextButton.svelte'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'
  import type {
    PromptFolderDividerTarget,
    PromptFolderPromptTarget,
    PromptFolderScreenCategoryBottomCapRow,
    PromptFolderScreenCategorySeparatorRow,
    PromptFolderScreenCollapsedSummaryRow,
    PromptFolderScreenDividerRow,
    PromptFolderScreenCategoryEditorRow,
    PromptFolderScreenPlaceholderRow,
    PromptFolderScreenPromptEditorRow,
    PromptFolderScreenRootHeaderRow,
    PromptFolderScreenRow
  } from './promptFolderScreenRows'

  type PromptFolderRow =
    | PromptFolderScreenRootHeaderRow
    | (PromptFolderScreenCategoryEditorRow & {
        isDetailsSectionExpanded: boolean
        isContentSectionExpanded: boolean
      })
    | PromptFolderScreenPlaceholderRow
    | PromptFolderScreenCollapsedSummaryRow
    | PromptFolderScreenCategoryBottomCapRow
    | PromptFolderScreenCategorySeparatorRow
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
    contentKind: PromptFolderContentKind
    promptEditorSizingConfig: PromptEditorSizingConfig
    promptDraftById: Record<string, MarkdownContentDraftRecord>
    promptTemplateTextById: Record<string, string>
    promptMetadataByPromptId: Record<string, PromptMetadata>
    promptFolders: PromptFolder[]
    categories: Category[]
    activeScreenRows: PromptFolderScreenRow[]
    visiblePromptIds: string[]
    activePromptCount: number
    completedPromptCount: number
    completedPromptContentOwnerByPromptId: Record<string, string>
    screenMode: PromptFolderScreenMode
    isCreatingPrompt: boolean
    detailsSectionExpandedByOwnerId: Record<string, boolean>
    contentSectionExpandedByOwnerId: Record<string, boolean>
    initialScrollTopPx: number
    scrollToWithinWindowBandForRows: ScrollToWithinWindowBand
    onAddPrompt: (target: PromptFolderDividerTarget) => void
    onAddCategory: () => void
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
    onMoveCategory: (categoryId: string, previousCategoryId: string | null) => void
    onCategoryDescriptionChange: (
      categoryId: string,
      text: string,
      measurement: TextMeasurement
    ) => void
    onCategoryDescriptionPresenceChange: (
      categoryId: string,
      isPresent: boolean
    ) => void
    onRenamePromptFolder: (promptFolderId: string) => void
    onRenameCategory: (categoryId: string) => void
    onDeleteCategory: (categoryId: string) => void
    onScreenModeChange: (screenMode: PromptFolderScreenMode) => void
    onScrollToWithinWindowBandChange: (next: ScrollToWithinWindowBand | null) => void
    onScrollToAndTrackRowCenteredChange: (next: ScrollToAndTrackRowCentered | null) => void
    onScrollApiChange: (next: VirtualWindowScrollApi | null) => void
    onViewportMetricsChange: (next: VirtualWindowViewportMetrics | null) => void
    onScrollTopChange: (nextScrollTop: number) => void
    onCenterRowChange: (row: ActivePromptScreenRow | null) => void
    onUserScroll: () => void
    onDetailsSectionToggle: (contentOwnerId: string) => void
    onContentSectionToggle: (contentOwnerId: string) => void
  }

  let {
    workspaceId,
    contentKind,
    screenRootFolderId,
    promptEditorSizingConfig,
    promptDraftById,
    promptTemplateTextById,
    promptMetadataByPromptId,
    promptFolders,
    categories,
    activeScreenRows,
    visiblePromptIds,
    activePromptCount,
    completedPromptCount,
    completedPromptContentOwnerByPromptId,
    screenMode,
    isCreatingPrompt,
    detailsSectionExpandedByOwnerId,
    contentSectionExpandedByOwnerId,
    initialScrollTopPx,
    scrollToWithinWindowBandForRows,
    onAddPrompt,
    onAddCategory,
    onDeletePrompt,
    onDeletePromptFolder,
    onSetPromptStatus,
    onMovePromptUp,
    onMovePromptDown,
    canMovePrompt,
    onPromptTreeDrop,
    onMoveCategory,
    onCategoryDescriptionChange,
    onCategoryDescriptionPresenceChange,
    onRenamePromptFolder,
    onRenameCategory,
    onDeleteCategory,
    onScreenModeChange,
    onScrollToWithinWindowBandChange,
    onScrollToAndTrackRowCenteredChange,
    onScrollApiChange,
    onViewportMetricsChange,
    onScrollTopChange,
    onCenterRowChange,
    onUserScroll,
    onDetailsSectionToggle,
    onContentSectionToggle
  }: PromptFolderVirtualContentProps = $props()

  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let scrollToAndTrackRowCentered = $state<ScrollToAndTrackRowCentered | null>(null)
  let scrollApi = $state<VirtualWindowScrollApi | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  let isTemplateSelectionDialogOpen = $state(false)
  let templateSelectionTarget = $state<PromptFolderPromptTarget | null>(null)
  let templateSelectionMode = $state<'select' | 'select-and-copy'>('select')
  const promptDividerDroppableState = createDroppableStateRegistry<string>()
  /** Indicator state for category title targets rendered at their content destination. */
  const categoryDroppableState = createDroppableStateRegistry<string>()
  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)
  const todoPromptMetadata: PromptMetadata = {
    status: PromptStatus.Todo,
    completedAt: null
  }
  const isTemplateFolder = $derived(contentKind === 'template')
  const compactLayoutMaxWidthPx = $derived(
    isTemplateFolder ? PROMPT_TEMPLATE_EDITOR_COMPACT_LAYOUT_MAX_WIDTH_PX : undefined
  )
  const ContentEditorRow = $derived(
    isTemplateFolder ? PromptTemplateEditorRow : PromptEditorRow
  )
  const promptFolderById = $derived.by(
    () =>
      Object.fromEntries(promptFolders.map((folder) => [folder.id, folder])) as Record<
        string,
        PromptFolder
      >
  )
  /** Loaded category metadata indexed for category cards. */
  const categoryById = $derived(
    Object.fromEntries(categories.map((category) => [category.id, category])) as Record<
      string,
      Category
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

  // Side effect: expose viewport readiness to deferred content requests.
  $effect(() => {
    onViewportMetricsChange(viewportMetrics)
  })

  const getCopyTemplateTexts = (
    selectedTemplates: PromptTemplateReference[] | null | undefined
  ): string[] => {
    if (isTemplateFolder) return []

    const templateTexts: string[] = []

    for (const template of selectedTemplates ?? []) {
      const selectedTemplateText = promptTemplateTextById[template.id]
      if (selectedTemplateText !== undefined) templateTexts.push(selectedTemplateText)
    }
    return templateTexts
  }

  const openTemplateSelectionDialog = (
    target: PromptFolderPromptTarget,
    mode: 'select' | 'select-and-copy'
  ): void => {
    templateSelectionTarget = target
    templateSelectionMode = mode
    isTemplateSelectionDialogOpen = true
  }

  const handleTemplateSelect = (templates: PromptTemplateReference[] | null): void => {
    if (!templateSelectionTarget) return
    setPromptDraftTemplates(templateSelectionTarget.promptId, templates)
  }

  const handleTemplateSelectAndCopy = async (
    templates: PromptTemplateReference[] | null
  ): Promise<void> => {
    if (!templateSelectionTarget) return
    const { promptId } = templateSelectionTarget
    const promptDraft = promptDraftById[promptId]!
    setPromptDraftTemplates(promptId, templates)
    await window.navigator.clipboard.writeText(
      applyPromptTemplates(
        promptDraft.text,
        getCopyTemplateTexts(templates)
      )
    )
    if ((promptMetadataByPromptId[promptId] ?? todoPromptMetadata).status === PromptStatus.Todo) {
      onSetPromptStatus(templateSelectionTarget, PromptStatus.InProgress)
    }
  }

  const handlePromptCopySuccess = (promptId: string): void => {
    if (promptDraftById[promptId]!.templates === undefined) {
      setPromptDraftTemplates(promptId, null)
    }
  }

  /** Resolves a category description height from measurement or estimation. */
  const getCategoryDescriptionHeight = (
    categoryId: string,
    widthPx: number,
    devicePixelRatio: number
  ): number => {
    const description = categoryById[categoryId]?.description
    if (description === null || description === undefined) return 0
    return (
      lookupCategoryDescriptionMeasuredHeight(categoryId, widthPx, devicePixelRatio) ??
      estimateCategoryDescriptionRowHeight(description, promptEditorSizingConfig.fontSize)
    )
  }

  const rowRegistry = defineVirtualWindowRowRegistry<PromptFolderRow>({
    'root-header': {
      estimateHeight: () => PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX,
      centerRowEligible: true,
      snippet: rootHeaderRow
    },
    'category-editor': {
      estimateHeight: (row) => {
        const description = categoryById[row.categoryId]?.description
        const descriptionHeightPx =
          description === null || description === undefined
            ? 0
            : estimateCategoryDescriptionRowHeight(
                description,
                promptEditorSizingConfig.fontSize
              )
        return row.isDetailsSectionExpanded
          ? getCategoryEditorRowHeightPx(descriptionHeightPx)
          : getCategoryEditorCollapsedRowHeightPx()
      },
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) => {
        const detailsWidthPx = getPromptFolderSectionContentWidthPx(
          widthPx,
          row.indentLevel,
          CATEGORY_EDITOR_SIDE_RAIL_WIDTH_PX
        )
        return row.isDetailsSectionExpanded
          ? getCategoryEditorRowHeightPx(
              getCategoryDescriptionHeight(row.categoryId, detailsWidthPx, devicePixelRatio)
            )
          : getCategoryEditorCollapsedRowHeightPx()
      },
      centerRowEligible: true,
      hydrationPriorityEligible: true,
      overlayRow: {},
      dehydrateOnWidthResize: true,
      snippet: categoryEditorRow
    },
    placeholder: {
      estimateHeight: () => 120,
      snippet: placeholderRow
    },
    'collapsed-summary': {
      estimateHeight: () => PROMPT_DIVIDER_ROW_HEIGHT_PX,
      snippet: collapsedSummaryRow
    },
    'category-bottom-cap': {
      estimateHeight: () => 8,
      snippet: categoryBottomCapRow
    },
    'category-separator': {
      estimateHeight: () => PROMPT_DIVIDER_ROW_HEIGHT_PX,
      snippet: categorySeparatorRow
    },
    'prompt-divider': {
      // Match the rendered add prompt divider height used by the virtual row.
      estimateHeight: () => PROMPT_DIVIDER_ROW_HEIGHT_PX,
      snippet: dividerRow
    },
    'prompt-editor': {
      estimateHeight: (row, widthPx, heightPx) => {
        const cardWidthPx = getPromptFolderSectionContentWidthPx(widthPx, row.indentLevel)
        return estimatePromptEditorHeight(
          promptDraftById[row.promptId]!.text,
          getPromptEditorTitleAreaWidthPx(cardWidthPx, !isCompletedMode),
          heightPx,
          promptEditorSizingConfig,
          compactLayoutMaxWidthPx,
          isTemplateFolder ? EDITOR_SUBTITLE_BAR_HEIGHT_PX : 0
        )
      },
      lookupMeasuredHeight: (row, widthPx, devicePixelRatio) => {
        const cardWidthPx = getPromptFolderSectionContentWidthPx(widthPx, row.indentLevel)
        const measuredRowHeightPx = lookupPromptEditorMeasuredHeight(
          row.promptId,
          cardWidthPx,
          devicePixelRatio
        )
        if (measuredRowHeightPx == null) return null

        const titleAreaWidthPx = getPromptEditorTitleAreaWidthPx(cardWidthPx, !isCompletedMode)
        return getRowHeightPx(
          clampMonacoHeightPx(
            getMonacoHeightFromRowPx(
              measuredRowHeightPx,
              titleAreaWidthPx,
              compactLayoutMaxWidthPx,
              isTemplateFolder ? EDITOR_SUBTITLE_BAR_HEIGHT_PX : 0
            ),
            promptEditorSizingConfig
          ),
          titleAreaWidthPx,
          compactLayoutMaxWidthPx,
          isTemplateFolder ? EDITOR_SUBTITLE_BAR_HEIGHT_PX : 0
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

        if (row.kind === 'category-editor') {
          return {
            id: categoryEditorRowId(row.categoryId),
            row: {
              ...row,
              isDetailsSectionExpanded:
                detailsSectionExpandedByOwnerId[row.contentOwnerId] ?? false,
              isContentSectionExpanded:
                contentSectionExpandedByOwnerId[row.contentOwnerId] ?? true
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
          return {
            id: promptFolderDividerRowId(
              screenRootFolderId,
              row.contentOwnerId,
              row.previousEntryId
            ),
            row
          }
        }

        if (row.kind === 'category-separator') {
          return { id: `category-separator:${row.categoryId}`, row }
        }

        if (row.kind === 'category-bottom-cap') {
          return { id: `category-bottom-cap:${row.categoryId}`, row }
        }

        if (row.kind === 'collapsed-summary') {
          return { id: `category-collapsed-summary:${row.categoryId}`, row }
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
          contentOwnerId: screenRootFolderId,
          categoryId: null,
          indentLevel: 0
        }
      })
    } else {
      completedRows.push({
        id: 'divider-initial',
        row: {
          kind: 'prompt-divider',
          contentOwnerId: screenRootFolderId,
          categoryId: null,
          previousEntryId: null,
          indentLevel: 0
        }
      })

      visiblePromptIds.forEach((promptId, promptIndex) => {
        const contentOwnerId =
          completedPromptContentOwnerByPromptId[promptId] ?? screenRootFolderId
        completedRows.push({
          id: promptEditorRowId(promptId),
          row: {
            kind: 'prompt-editor',
            contentOwnerId,
            categoryId: null,
            promptId,
            indentLevel: 0,
            isFirstPrompt: promptIndex === 0,
            isLastPrompt: promptIndex === visiblePromptIds.length - 1
          }
        })
        completedRows.push({
          id: promptDividerRowId(promptId),
          row: {
            kind: 'prompt-divider',
            contentOwnerId: screenRootFolderId,
            categoryId: null,
            previousEntryId: promptId,
            indentLevel: 0
          }
        })
      })
    }

    completedRows.push({ id: 'bottom-spacer', row: { kind: 'bottom-spacer' } })
    return completedRows
  })

  const handleCenterRowChange = (row: PromptFolderRow | null) => {
    if (row?.kind === 'root-header') {
      onCenterRowChange({ kind: 'root-header', contentOwnerId: screenRootFolderId })
      return
    }
    if (row?.kind === 'prompt-editor') {
      onCenterRowChange({
        kind: 'prompt',
        contentOwnerId: row.contentOwnerId,
        promptId: row.promptId
      })
      return
    }
    if (!isCompletedMode && row?.kind === 'category-editor') {
      onCenterRowChange({
        kind: 'category-details',
        contentOwnerId: row.contentOwnerId
      })
      return
    }
    onCenterRowChange(null)
  }

  const getPromptDividerDropPayload = (
    categoryId: string | null,
    previousEntryId: string | null
  ): PromptHandleDropPayload => {
    return {
      folderId: screenRootFolderId,
      categoryId,
      targetEntryId: previousEntryId,
      position: 'after'
    }
  }

  const canDropOnPromptDivider = (
    categoryId: string | null,
    previousEntryId: string | null,
    payload: PromptTreeEntryDragPayload
  ): boolean => {
    const destinationFolder = promptFolderById[screenRootFolderId]
    if (!destinationFolder) return false
    const dropPayload = getPromptDividerDropPayload(categoryId, previousEntryId)

    if (!isPromptHandleDragPayload(payload)) return false

    const sourceFolder = promptFolderById[payload.sourceFolderId]
    if (!sourceFolder) return false
    if (
      payload.contentKind !== destinationFolder.kind ||
      sourceFolder.kind !== destinationFolder.kind
    ) {
      return false
    }
    return (
      resolvePromptHandleDropMove(
        getEntryCategoryId(payload.fromId) ?? 'uncategorized',
        getCategoryEntryIds(getEntryCategoryId(payload.fromId)),
        payload.fromId,
        { ...dropPayload, folderId: categoryId ?? 'uncategorized' },
        getCategoryEntryIds(categoryId)
      ) !== null
    )
  }

  const getPromptDividerDropOptions = (
    rowId: string,
    categoryId: string | null,
    previousPromptId: string | null
  ): DroppableOptions<PromptTreeEntryDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges: 'none',
    payload: () => getPromptDividerDropPayload(categoryId, previousPromptId),
    canDrop: (payload) => canDropOnPromptDivider(categoryId, previousPromptId, payload),
    indicator: promptDividerDroppableState.getState(rowId)
  })

  /** Returns active content IDs from one exact FolderOrderV2 category group. */
  const getCategoryEntryIds = (categoryId: string | null): string[] =>
    promptFolderById[screenRootFolderId]?.categoryOrder.categories
      .find((group) => group.categoryId === categoryId)
      ?.entries.filter((entry) => entry.kind === contentKind)
      .map((entry) => entry.id) ?? []

  /** Finds the current category placement of one active content ID. */
  const getEntryCategoryId = (entryId: string): string | null =>
    promptFolderById[screenRootFolderId]?.categoryOrder.categories.find((group) =>
      group.entries.some((entry) => entry.id === entryId)
    )?.categoryId ?? null

  /** Builds a shared category-header target for prompt placement and category ordering. */
  const getCategoryDropOptions = (
    categoryId: string
  ): DroppableOptions<PromptTreeEntryDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges: 'top-and-bottom',
    payload: (edge) => ({
      folderId: screenRootFolderId,
      categoryId,
      targetEntryId: null,
      position: edge === 'top' ? 'before' : 'after'
    }),
    canDrop: (payload) =>
      isPromptHandleDragPayload(payload)
        ? canDropOnPromptDivider(categoryId, null, payload)
        : payload.categoryId !== categoryId,
    indicator: categoryDroppableState.getState(categoryId)
  })

  /** Builds the draggable category handle while preserving the existing ghost icon. */
  const getCategoryDragOptions = (
    category: Category
  ): DraggableOptions<CategoryDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: { categoryId: category.id },
    createGhost: () => createPromptDragGhost(category.displayName, 'category'),
    onDragStart: () => {
      startCategoryDrag(category.id)
    },
    onDragFinish: ({
      sourcePayload,
      dropPayload
    }: DragFinishResult<CategoryDragPayload, PromptHandleDropPayload>) => {
      clearPromptEntryDrag()
      if (!dropPayload?.categoryId || dropPayload.categoryId === sourcePayload.categoryId) return
      /** Ordered categories excluding the dragged category. */
      const remainingCategoryIds = categories
        .map((candidate) => candidate.id)
        .filter((candidateId) => candidateId !== sourcePayload.categoryId)
      /** Target category index after removing the dragged category. */
      const targetIndex = remainingCategoryIds.indexOf(dropPayload.categoryId)
      if (targetIndex === -1) return
      /** Category that should precede the dragged group after this drop. */
      const previousCategoryId =
        dropPayload.position === 'after'
          ? dropPayload.categoryId
          : (remainingCategoryIds[targetIndex - 1] ?? null)
      onMoveCategory(sourcePayload.categoryId, previousCategoryId)
    }
  })

  /** Returns the active content count displayed by a category card. */
  const getCategoryContentCount = (row: PromptFolderScreenCategoryEditorRow): number => {
    return getCategoryEntryIds(row.categoryId).filter(
      (entryId) => promptMetadataByPromptId[entryId]?.status !== PromptStatus.Completed
    ).length
  }

</script>

<SvelteVirtualWindow
  items={virtualItems}
  {rowRegistry}
  {initialScrollTopPx}
  rightScrollPaddingPx={12}
  scrollbarWidthPx={14}
  testId="prompt-folder-virtual-window"
  spacerTestId="prompt-folder-virtual-window-spacer"
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

{#snippet rootHeaderRow()}
  <PromptFolderRootHeaderRow
    folderDisplayName={promptFolderById[screenRootFolderId]?.displayName ??
      (isTemplateFolder ? 'Prompt Template Folder' : 'Prompt Folder')}
    {activePromptCount}
    {completedPromptCount}
    {screenMode}
    {contentKind}
    onRenamePromptFolder={() => onRenamePromptFolder(screenRootFolderId)}
    onDeletePromptFolder={() => onDeletePromptFolder(screenRootFolderId)}
    {onAddCategory}
    {onScreenModeChange}
  />
{/snippet}

{#snippet categoryEditorRow(props)}
  {@const category = categoryById[props.row.categoryId]}
  {@const contentWidthPx = getPromptFolderSectionContentWidthPx(
    props.virtualWindowWidthPx,
    props.row.indentLevel,
    CATEGORY_EDITOR_SIDE_RAIL_WIDTH_PX
  )}
  {#if category}
    <PromptFolderSectionRow rowHeightPx={props.rowHeightPx} indentLevel={props.row.indentLevel}>
      <CategoryEditorRow
        {workspaceId}
        categoryId={category.id}
        displayName={category.displayName}
        contentCount={getCategoryContentCount(props.row)}
        description={category.description}
        rowId={props.rowId}
        virtualWindowWidthPx={contentWidthPx}
        devicePixelRatio={props.devicePixelRatio}
        rowHeightPx={props.rowHeightPx}
        descriptionHeightPx={getCategoryDescriptionHeight(
          category.id,
          contentWidthPx,
          props.devicePixelRatio
        )}
        hydrationPriority={props.hydrationPriority}
        shouldDehydrate={props.shouldDehydrate}
        overlayRowElement={props.overlayRowElement ?? null}
        scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
        onHydrationChange={props.onHydrationChange}
        {contentKind}
        isDetailsSectionExpanded={props.row.isDetailsSectionExpanded}
        isContentSectionExpanded={props.row.isContentSectionExpanded}
        isReadOnly={isCompletedMode}
        canRename={!isCompletedMode}
        showSidebar
        dragOptions={!isCompletedMode ? getCategoryDragOptions(category) : undefined}
        dropOptions={!isCompletedMode ? getCategoryDropOptions(category.id) : undefined}
        onDetailsSectionToggle={() => onDetailsSectionToggle(category.id)}
        onContentSectionToggle={() => onContentSectionToggle(category.id)}
        onDescriptionChange={(text, measurement) =>
          onCategoryDescriptionChange(category.id, text, measurement)}
        onDescriptionPresenceChange={(isPresent) =>
          onCategoryDescriptionPresenceChange(category.id, isPresent)}
        onRenameCategory={() => onRenameCategory(category.id)}
        onDeleteCategory={() => onDeleteCategory(category.id)}
      />
    </PromptFolderSectionRow>
  {/if}
{/snippet}

{#snippet placeholderRow({ rowHeightPx })}
  <PromptFolderSectionRow
    {rowHeightPx}
    contentClass="text-center py-12 text-[var(--ui-secondary-text)]"
  >
    <p>
      {isCompletedMode
        ? 'No completed prompts found in this folder'
        : isTemplateFolder
          ? 'No templates found in this folder.'
          : 'No prompts found in this folder.'}
    </p>
    {#if !isCompletedMode}
      <p class="text-sm mt-2">
        Click the Add {isTemplateFolder ? 'Template' : 'Prompt'} button to create your first
        {isTemplateFolder ? 'template' : 'prompt'}.
      </p>
    {/if}
  </PromptFolderSectionRow>
{/snippet}

{#snippet collapsedSummaryRow({ row, rowHeightPx })}
  {@const summaryText = `${row.promptCount} ${
    row.promptCount === 1
      ? isTemplateFolder
        ? 'template'
        : 'prompt'
      : isTemplateFolder
        ? 'templates'
        : 'prompts'
  } hidden. Click to expand...`}
  <!-- Category title indicator state is shared with this collapsed destination row. -->
  {@const categoryIndicatorState = categoryDroppableState.getState(row.categoryId)}
  <PromptFolderSectionRow
    {rowHeightPx}
    indentLevel={row.indentLevel}
    contentClass="flex items-center justify-center text-center"
    testId={`category-collapsed-summary-${row.categoryId}`}
  >
    {#if categoryIndicatorState.isOver}
      <PromptDivider
        mode="add"
        contentLabel={isTemplateFolder ? 'Template' : 'Prompt'}
        indicatorState={categoryIndicatorState}
        testId={`category-collapsed-drop-indicator-${row.categoryId}`}
      />
    {:else}
      <InlineTextButton
        text={summaryText}
        size="default"
        baseVariant="secondary"
        onclick={() => onContentSectionToggle(row.contentOwnerId)}
      />
    {/if}
  </PromptFolderSectionRow>
{/snippet}

{#snippet categoryBottomCapRow({ row, rowHeightPx })}
  <PromptFolderSectionRow {rowHeightPx} indentLevel={row.indentLevel}>
    <div
      class="category-bottom-cap"
      data-testid={`category-bottom-cap-${row.categoryId}`}
    ></div>
  </PromptFolderSectionRow>
{/snippet}

<!-- Renders the category boundary without add controls or a drag/drop target. -->
{#snippet categorySeparatorRow({ row, rowHeightPx })}
  <PromptFolderSectionRow
    {rowHeightPx}
    indentLevel={0}
    testId={`prompt-folder-category-separator-${row.categoryId}`}
  >
    <PromptDivider mode="separator" />
  </PromptFolderSectionRow>
{/snippet}

{#snippet dividerRow({ row, rowId, rowHeightPx })}
  {@const target = {
    contentOwnerId: row.contentOwnerId,
    categoryId: row.categoryId,
    previousEntryId: row.previousEntryId
  }}
  {@const showsActions = !isCompletedMode}
  <PromptFolderSectionRow
    {rowHeightPx}
    indentLevel={row.indentLevel}
    testId={`prompt-folder-divider-${row.contentOwnerId}-${row.previousEntryId ?? 'initial'}`}
  >
    <PromptDivider
      disabled={isCreatingPrompt}
      mode={showsActions ? 'add' : 'separator'}
      contentLabel={isTemplateFolder ? 'Template' : 'Prompt'}
      onAddPrompt={showsActions ? () => onAddPrompt(target) : undefined}
      getDropOptions={!showsActions
        ? undefined
        : () => getPromptDividerDropOptions(rowId, row.categoryId, row.previousEntryId)}
      testId={showsActions
        ? row.previousEntryId
          ? `prompt-divider-add-after-${row.previousEntryId}`
          : 'prompt-divider-add-initial'
        : undefined}
      indicatorState={row.categoryId !== null && row.previousEntryId === null
        ? categoryDroppableState.getState(row.categoryId)
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
  {@const promptTarget = {
    contentOwnerId: row.contentOwnerId,
    categoryId: row.categoryId,
    promptId: row.promptId
  }}
  <PromptFolderSectionRow {rowHeightPx} indentLevel={row.indentLevel}>
    <ContentEditorRow
      {workspaceId}
      {screenRootFolderId}
      promptFolderId={screenRootFolderId}
      promptId={row.promptId}
      promptDraftRecord={{
        title: promptDraftById[row.promptId]!.title,
        fallbackTitle: promptDraftById[row.promptId]!.fallbackTitle,
        modifiedAt: promptDraftById[row.promptId]!.modifiedAt,
        text: promptDraftById[row.promptId]!.text,
        ...(promptDraftById[row.promptId]!.templateName
          ? { templateName: promptDraftById[row.promptId]!.templateName }
          : {}),
        ...(promptDraftById[row.promptId]!.templateState
          ? { templateState: promptDraftById[row.promptId]!.templateState }
          : {}),
        isEdited: promptDraftById[row.promptId]!.isEdited
      }}
      {rowId}
      virtualWindowWidthPx={contentWidthPx}
      rowContentLeftOffsetPx={contentOffsetPx}
      {devicePixelRatio}
      {rowHeightPx}
      {hydrationPriority}
      {shouldDehydrate}
      {overlayRowElement}
      {onHydrationChange}
      copyTemplateTexts={getCopyTemplateTexts(promptDraftById[row.promptId]!.templates)}
      {screenMode}
      status={promptMetadata.status}
      completedAt={promptMetadata.completedAt}
      scrollToWithinWindowBand={scrollToWithinWindowBandForRows}
      isFirstPrompt={!canMovePrompt(promptTarget, 'up')}
      isLastPrompt={!canMovePrompt(promptTarget, 'down')}
      isDragEnabled={!isCompletedMode}
      onDelete={() => onDeletePrompt(promptTarget)}
      onTemplateSelect={isTemplateFolder
        ? undefined
        : () => openTemplateSelectionDialog(promptTarget, 'select')}
      onTemplateSelectAndCopy={isTemplateFolder
        ? undefined
        : () => openTemplateSelectionDialog(promptTarget, 'select-and-copy')}
      onCopySuccess={isTemplateFolder ? undefined : () => handlePromptCopySuccess(row.promptId)}
      onStatusChange={isTemplateFolder ? undefined : (status) => {
        onSetPromptStatus(promptTarget, status)
      }}
      onMoveUp={() => (isCompletedMode ? Promise.resolve(false) : onMovePromptUp(promptTarget))}
      onMoveDown={() =>
        isCompletedMode ? Promise.resolve(false) : onMovePromptDown(promptTarget)}
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

<PromptTemplateSelectionDialog
  bind:open={isTemplateSelectionDialogOpen}
  {workspaceId}
  mode={templateSelectionMode}
  selectedTemplates={templateSelectionTarget
    ? promptDraftById[templateSelectionTarget.promptId]?.templates
    : undefined}
  onselect={templateSelectionMode === 'select-and-copy'
    ? handleTemplateSelectAndCopy
    : handleTemplateSelect}
/>

<style>
  .category-bottom-cap {
    background: var(--ui-card-nested-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 0 0 8px 8px;
    border-top: 0;
    box-sizing: border-box;
    height: 8px;
    width: 100%;
  }
</style>
