<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { Loader } from 'lucide-svelte'
  import {
    createDroppableStateRegistry,
    type DroppableAllowedEdges,
    type DroppableEdge,
    type DroppableOptions,
    type DraggableOptions
  } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import {
    CATEGORY_DRAG_TYPE,
    PROMPT_HANDLE_DRAG_TYPE,
    resolveCategoryDropPreviousCategoryId,
    resolvePromptHandleDropMove,
    type CategoryDragPayload,
    type CategoryDropPayload,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import { createPromptDragGhost } from '@renderer/features/drag-drop/promptDragGhost'
  import {
    clearPromptEntryDrag,
    promptEntryDragState,
    startCategoryDrag
  } from '@renderer/features/drag-drop/promptEntryDragState.svelte.ts'
  import {
    type PromptDraftRecord,
    promptDraftCollection
  } from '@renderer/data/Collections/PromptDraftCollection'
  import { promptCollection } from '@renderer/data/Collections/PromptCollection'
  import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
  import { promptTemplateDraftCollection } from '@renderer/data/Collections/PromptTemplateDraftCollection'
  import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
  import { getPromptDisplayTitle as getPromptTitleText } from '@shared/promptFallbackTitle'
  import {
    getPromptNavigationContext,
    promptIdToPromptNavigationRow,
    promptNavigationRowToPersistedEntryId,
    type PromptNavigationRow,
    type PromptNavigationTarget
  } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import type { ConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    lookupWorkspacePersistedCategoryTreeExpandedState,
    setCategoryTreeExpandedStateWithAutosave,
    setPromptFolderSelectedEntryIdWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import type { PromptFolder } from '@shared/PromptFolder'
  import { PromptStatus, type Prompt } from '@shared/Prompt'
  import type { PromptTemplate } from '@shared/PromptTemplate'
  import { PromptFolderScreenMode } from '@renderer/features/prompt-folders/promptFolderScreenMode'
  import {
    type ScrollToWithinWindowBand,
    type VirtualWindowItem,
    type VirtualWindowViewportMetrics
  } from '../virtualizer/virtualWindowTypes'
  import PromptTreeVirtualList, {
    type PromptTreeBottomSpacerRowProps,
    type PromptTreeCategoryRowProps,
    type PromptTreePromptRowProps,
    type PromptTreeRow
  } from './PromptTreeVirtualList.svelte'
  import DropIndicator from '../drag-drop/DropIndicator.svelte'
  import PromptDropTarget from '../drag-drop/PromptDropTarget.svelte'
  import PromptTreeCategoryRow from './PromptTreeCategoryRow.svelte'
  import PromptTreePromptRow from './PromptTreePromptRow.svelte'
  import {
    categoryDropIndicatorTestId,
    folderPromptDropIndicatorTestId,
    promptTreeBottomSpacerDropIndicatorTestId,
    promptTreeBottomSpacerDropTargetTestId
  } from './promptTreeTestIds'
  import { collectCompletedPrompts } from '../prompt-folders/promptFolderCompletedPrompts'
  import { moveCategory } from '@renderer/data/Mutations/CategoryMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { createPromptTreePromptDragController } from './promptTreeDrag'

  type FolderListState = 'no-workspace' | 'loading' | 'empty' | 'ready'
  type PromptTreeBulkExpansionRequest = {
    screenRootFolderId: string
    isExpanded: boolean
  }

  let {
    promptFolders,
    folderListState,
    screenRootFolderId = null,
    expansionRequests,
    isPromptFoldersScreenActive = false,
    screenMode = PromptFolderScreenMode.Active,
    virtualWindowTestId = 'prompt-tree-virtual-window',
    onAllCategoriesCollapsedChange,
    onScreenModeSelect,
    onScreenRootFolderSelect
  } = $props<{
    promptFolders: PromptFolder[]
    folderListState: FolderListState
    screenRootFolderId?: string | null
    expansionRequests: ConsumableRequestCoordinator<PromptTreeBulkExpansionRequest>
    isPromptFoldersScreenActive?: boolean
    screenMode?: PromptFolderScreenMode
    /** Test identity for distinguishing concurrently rendered status trees. */
    virtualWindowTestId?: string
    onAllCategoriesCollapsedChange: (isCollapsed: boolean) => void
    onScreenModeSelect: (screenMode: PromptFolderScreenMode) => void
    onScreenRootFolderSelect: (screenRootFolderId: string) => void
  }>()

  const PROMPT_TREE_ROW_CENTER_OFFSET_PX = 14
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  let categoryTreeExpandedStates = $state<Record<string, boolean>>({})
  const promptNavigation = getPromptNavigationContext()
  const workspaceSelection = getWorkspaceSelectionContext()
  const promptDraftQuery = useLiveQuery(promptDraftCollection) as {
    data: PromptDraftRecord[]
  }
  const promptQuery = useLiveQuery(promptCollection) as {
    data: Prompt[]
  }
  const promptTemplateQuery = useLiveQuery(promptTemplateCollection) as {
    data: PromptTemplate[]
  }
  const promptTemplateDraftQuery = useLiveQuery(promptTemplateDraftCollection) as {
    data: Array<{ id: string; title: string; fallbackTitle: string }>
  }
  /** Live category metadata used by the selected root folder's tree projection. */
  const categoryQuery = useLiveQuery(categoryCollection)

  const promptTreeTitleById = $derived.by(() => {
    const titlesById: Record<string, string> = {}

    for (const promptDraft of promptDraftQuery.data) {
      if (!promptDraft) {
        continue
      }

      titlesById[promptDraft.id] = getPromptTitleText(promptDraft)
    }
    for (const templateDraft of promptTemplateDraftQuery.data) {
      titlesById[templateDraft.id] = getPromptTitleText(templateDraft)
    }

    return titlesById
  })
  // Maps prompt IDs to the session-latched edited state displayed by prompt-tree accents.
  const promptEditedById = $derived.by(() =>
    Object.fromEntries(
      promptDraftQuery.data.map((promptDraft) => [promptDraft.id, promptDraft.isEdited])
    )
  )
  const promptById = $derived.by(() => {
    const promptsById: Record<string, Prompt> = {}

    for (const prompt of promptQuery.data) {
      if (!prompt) {
        continue
      }

      promptsById[prompt.id] = prompt
    }

    return promptsById
  })
  const promptFolderById = $derived.by(() => {
    const promptFoldersById: Record<string, PromptFolder> = {}

    for (const promptFolder of promptFolders) {
      promptFoldersById[promptFolder.id] = promptFolder
    }

    return promptFoldersById
  })
  const templateById = $derived.by(() =>
    Object.fromEntries(promptTemplateQuery.data.map((template) => [template.id, template]))
  )
  /** Loaded category metadata indexed by stable ID. */
  const categoryById = $derived(
    Object.fromEntries(categoryQuery.data.map((category) => [category.id, category]))
  )

  const screenRootFolder = $derived.by((): PromptFolder | null => {
    if (promptFolders.length === 0) {
      return null
    }

    return (
      promptFolders.find((promptFolder) => promptFolder.id === screenRootFolderId) ??
      promptFolders[0]!
    )
  })
  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)
  const selectedCompletedPrompts = $derived.by(() => {
    if (!screenRootFolder || screenRootFolder.kind === 'template') {
      return []
    }

    if (!isCompletedMode) {
      return []
    }

    return collectCompletedPrompts({
      rootFolder: screenRootFolder,
      statusByPromptId: Object.fromEntries(
        Object.values(promptById).map((prompt) => [prompt.id, prompt.status])
      ),
      completedAtByPromptId: Object.fromEntries(
        Object.values(promptById).map((prompt) => [prompt.id, prompt.completedAt ?? null])
      )
    })
  })
  /** Loaded active prompt count used to replace an empty status tree with its navigation link. */
  const selectedActivePromptCount = $derived.by(() => {
    if (!screenRootFolder || screenRootFolder.kind === 'template') return 0

    return screenRootFolder.categoryOrder.categories.reduce(
      (count, group) =>
        count +
        group.entries.filter(
          (entry) =>
            entry.kind === 'prompt' &&
            Boolean(promptById[entry.id]) &&
            promptById[entry.id]?.status !== PromptStatus.Completed
        ).length,
      0
    )
  })
  /** Prompt count for this tree's fixed Active or Completed status. */
  const selectedStatusPromptCount = $derived(
    isCompletedMode ? selectedCompletedPrompts.length : selectedActivePromptCount
  )
  const PROMPT_TREE_DROP_INDICATOR_BASE_INSET_PX = 15
  const PROMPT_TREE_INDENT_WIDTH_PX = 12
  const getPromptTreeDropIndicatorInset = (indentCount: number): string =>
    `${PROMPT_TREE_DROP_INDICATOR_BASE_INSET_PX + indentCount * PROMPT_TREE_INDENT_WIDTH_PX}px`

  /** Returns the virtual-row ID for a category header. */
  const categoryRowId = (categoryId: string): string => `${categoryId}:category`
  /** Returns the virtual-row ID for content owned by a root group or category. */
  const contentPromptRowId = (contentOwnerId: string, promptId: string): string =>
    `${contentOwnerId}:prompt:${promptId}`
  const promptTreePromptDroppableState = createDroppableStateRegistry<string>()
  /** Category-only target state keyed by the virtual row that owns each boundary. */
  const promptTreeCategoryDroppableState = createDroppableStateRegistry<string>()
  const getCategoryTreeExpandedStateKey = (categoryId: string): string =>
    `${workspaceSelection.selectedWorkspaceId ?? 'no-workspace'}:${categoryId}`

  const getPromptTreeCategoryExpandedState = (categoryId: string): boolean => {
    const stateKey = getCategoryTreeExpandedStateKey(categoryId)
    const localState = categoryTreeExpandedStates[stateKey]
    if (localState !== undefined) {
      return localState
    }

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) {
      return true
    }

    return (
      lookupWorkspacePersistedCategoryTreeExpandedState(workspaceId, categoryId) ??
      true
    )
  }

  const setPromptTreeCategoryExpandedState = (categoryId: string, isExpanded: boolean): void => {
    const stateKey = getCategoryTreeExpandedStateKey(categoryId)
    if (categoryTreeExpandedStates[stateKey] === isExpanded) {
      return
    }

    categoryTreeExpandedStates = {
      ...categoryTreeExpandedStates,
      [stateKey]: isExpanded
    }

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setCategoryTreeExpandedStateWithAutosave(workspaceId, categoryId, isExpanded)
    }
  }

  const categoryTreeIds = $derived.by((): string[] => {
    if (!screenRootFolder) return []
    return screenRootFolder.categoryOrder.categories.flatMap((group) =>
      group.categoryId && categoryById[group.categoryId] ? [group.categoryId] : []
    )
  })

  const findContentOwnerPath = (
    rootFolder: PromptFolder,
    contentOwnerId: string
  ): string[] | null => {
    if (rootFolder.id === contentOwnerId) return [rootFolder.id]
    return categoryById[contentOwnerId] ? [rootFolder.id, contentOwnerId] : null
  }

  const isSameNavigationTarget = (
    left: PromptNavigationTarget,
    right: PromptNavigationTarget
  ): boolean =>
    left.screenRootFolderId === right.screenRootFolderId &&
    left.contentOwnerId === right.contentOwnerId &&
    left.row === right.row

  const getPromptTreeRowId = (target: PromptNavigationTarget): string | null => {
    if (target.row === 'root-header') {
      return null
    }
    if (target.row === 'category-details') {
      return categoryRowId(target.contentOwnerId)
    }
    return contentPromptRowId(
      target.contentOwnerId,
      promptNavigationRowToPersistedEntryId(target.row)
    )
  }

  const getPromptTreePromptDroppableOptions = (
    rowId: string,
    allowedEdges: DroppableAllowedEdges,
    getDropPayload: (edge: DroppableEdge | null) => PromptHandleDropPayload
  ): DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges,
    canDrop: (payload, edge) => canDropOnPromptTree(payload, getDropPayload(edge)),
    payload: getDropPayload,
    indicator: promptTreePromptDroppableState.getState(rowId)
  })

  const canDropOnPromptTree = (
    payload: PromptHandleDragPayload,
    dropPayload: PromptHandleDropPayload
  ): boolean => {
    const destinationFolder = promptFolderById[dropPayload.folderId]
    if (!destinationFolder) return false

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
        { ...dropPayload, folderId: dropPayload.categoryId ?? 'uncategorized' },
        getCategoryEntryIds(dropPayload.categoryId ?? null)
      ) !== null
    )
  }

  /** Builds a category-only target for the boundary before a category or at tree bottom. */
  const getPromptTreeCategoryDroppableOptions = (
    rowId: string,
    nextCategoryId: string | null
  ): DroppableOptions<CategoryDragPayload, CategoryDropPayload> => ({
    dragType: CATEGORY_DRAG_TYPE,
    allowedEdges: 'top',
    payload: { nextCategoryId },
    canDrop: (payload) =>
      resolveCategoryDropPreviousCategoryId(
        categoryTreeIds,
        payload.categoryId,
        nextCategoryId
      ) !== undefined,
    indicator: promptTreeCategoryDroppableState.getState(rowId)
  })

  /** Returns active content IDs in one exact FolderOrderV2 group. */
  const getCategoryEntryIds = (categoryId: string | null): string[] =>
    screenRootFolder?.categoryOrder.categories
      .find((group) => group.categoryId === categoryId)
      ?.entries.filter((entry) => entry.kind === screenRootFolder.kind)
      .map((entry) => entry.id) ?? []

  /** Finds the current category placement of one active tree content row. */
  const getEntryCategoryId = (entryId: string): string | null =>
    screenRootFolder?.categoryOrder.categories.find((group) =>
      group.entries.some((entry) => entry.id === entryId)
    )?.categoryId ?? null

  /** Maps a category header edge to either Uncategorized start or category start. */
  const getPromptTreeCategoryPromptDropPayload = (
    categoryId: string,
    isFirstTreeRow: boolean,
    edge: DroppableEdge | null
  ): PromptHandleDropPayload => {
    /** Top edge of the first header is the empty Uncategorized start boundary. */
    const destinationCategoryId = isFirstTreeRow && edge === 'top' ? null : categoryId
    return {
      folderId: screenRootFolder!.id,
      categoryId: destinationCategoryId,
      targetEntryId: null,
      position: 'after'
    }
  }

  const getPromptTreeDropTargetEdge = (rowId: string): DroppableEdge | null =>
    promptTreePromptDroppableState.edge(rowId)

  /** Returns the active category boundary edge for one virtual row. */
  const getPromptTreeCategoryDropTargetEdge = (rowId: string): DroppableEdge | null =>
    promptTreeCategoryDroppableState.edge(rowId)

  const selectMovedPrompt = (destinationContentOwnerId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)
    const containingRootFolderId = findContainingRootFolderId(destinationContentOwnerId)

    promptNavigation.select({
      screenRootFolderId: containingRootFolderId,
      contentOwnerId: destinationContentOwnerId,
      row,
      source: 'prompt-move',
      forceRequest: true,
      contentReveal: { scrollType: 'center' },
      treeExpansion: 'owner'
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderSelectedEntryIdWithAutosave(
        workspaceId,
        destinationContentOwnerId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    onScreenRootFolderSelect(containingRootFolderId)
  }

  const findContainingRootFolderId = (contentOwnerId: string): string => {
    return categoryById[contentOwnerId]
      ? screenRootFolder?.id ?? contentOwnerId
      : contentOwnerId
  }

  const promptDragController = createPromptTreePromptDragController({
    getPromptFolders: () => promptFolders,
    onPromptMove: (move, sourceCategoryId) => {
      if (
        move.sourcePromptFolderId === move.destinationPromptFolderId &&
        sourceCategoryId !== move.categoryId
      ) {
        selectMovedPrompt(move.categoryId ?? move.destinationPromptFolderId, move.promptId)
      }
    }
  })

  const getPromptRowDragOptions = (
    folderId: string,
    sourceCategoryId: string | null,
    promptId: string,
    title: string,
    contentKind: import('@shared/PromptFolder').PromptFolderContentKind
  ): DraggableOptions<PromptHandleDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: {
      fromId: promptId,
      sourceFolderId: folderId,
      sourceCategoryId,
      contentKind
    },
    createGhost: () => createPromptDragGhost(title, contentKind),
    onDragStart: promptDragController.handleDragStart,
    onDragFinish: promptDragController.handleDragFinish
  })

  /** Creates drag options for reordering one category. */
  const getCategoryRowDragOptions = (
    categoryId: string,
    displayName: string
  ): DraggableOptions<CategoryDragPayload, CategoryDropPayload> => ({
    dragType: CATEGORY_DRAG_TYPE,
    payload: { categoryId },
    createGhost: () => createPromptDragGhost(displayName, 'category'),
    onDragStart: (payload) => {
      startCategoryDrag(payload.categoryId)
    },
    onDragFinish: ({ sourcePayload, dropPayload }) => {
      clearPromptEntryDrag()
      if (!screenRootFolder || !dropPayload) return
      /** Category predecessor represented by the selected boundary. */
      const previousCategoryId = resolveCategoryDropPreviousCategoryId(
        categoryTreeIds,
        sourcePayload.categoryId,
        dropPayload.nextCategoryId
      )
      if (previousCategoryId === undefined) return
      void runIpcBestEffort(() =>
        moveCategory(screenRootFolder.id, sourcePayload.categoryId, previousCategoryId)
      )
    }
  })

  const isTreeEntryActive = (contentOwnerId: string, row: PromptNavigationRow): boolean => {
    if (!isPromptFoldersScreenActive || !promptNavigation.selectedRow) {
      return false
    }

    return (
      promptNavigation.screenRootFolderId === screenRootFolder?.id &&
      promptNavigation.contentOwnerId === contentOwnerId &&
      promptNavigation.selectedRow === row
    )
  }

  const isPromptRowDragging = (folderId: string, promptId: string): boolean => {
    const draggedEntry = promptEntryDragState.draggedEntry
    return (
      draggedEntry?.kind === 'content' &&
      draggedEntry.folderId === folderId &&
      draggedEntry.contentId === promptId
    )
  }
  const isCategoryRowDragging = (categoryId: string): boolean => {
    const draggedEntry = promptEntryDragState.draggedEntry
    return draggedEntry?.kind === 'category' && draggedEntry.categoryId === categoryId
  }
  const isPromptDragActive = $derived(promptEntryDragState.draggedEntry !== null)

  const handlePromptTreeEntrySelect = (
    contentOwnerId: string,
    row: PromptNavigationRow,
    source: 'tree-click' | 'category-open' = 'tree-click',
    navigationHighlightPromptId?: string
  ) => {
    const rootFolderId = screenRootFolder?.id
    if (!rootFolderId) return
    const isSameRootActive = isPromptFoldersScreenActive

    onScreenModeSelect(screenMode)
    promptNavigation.select({
      screenRootFolderId: rootFolderId,
      contentOwnerId,
      row,
      source,
      navigationHighlightPromptId,
      forceRequest: true,
      contentReveal: {
        scrollType: row === 'category-details' ? 'align-top' : 'center',
        expandDetails: source !== 'category-open'
      }
    })

    if (!isSameRootActive) {
      onScreenRootFolderSelect(rootFolderId)
    }
  }

  /** Selects a prompt owned by either the root folder or a category. */
  const handlePromptTreePromptSelect = (contentOwnerId: string, promptId: string) => {
    handlePromptTreeEntrySelect(
      contentOwnerId,
      promptIdToPromptNavigationRow(promptId),
      'tree-click',
      promptId
    )
  }

  const handleCategoryExpandedChange = (categoryId: string, isExpanded: boolean) => {
    setPromptTreeCategoryExpandedState(categoryId, isExpanded)
  }

  const handleCategoryOpen = (categoryId: string) => {
    handlePromptTreeEntrySelect(categoryId, 'category-details', 'category-open')
  }

  const handleCategorySettingsOpen = (categoryId: string) => {
    handlePromptTreeEntrySelect(categoryId, 'category-details')
  }

  /** Opens this empty tree's status view while retaining the root folder selection. */
  const handleEmptyStatusSelect = (): void => {
    onScreenModeSelect(screenMode)
  }

  // Side effect: report the current tree collapse state to the sidebar action button.
  $effect(() => {
    if (isCompletedMode) return
    const areAllCategoriesCollapsed =
      categoryTreeIds.length > 0 &&
      categoryTreeIds.every(
        (categoryId) => !getPromptTreeCategoryExpandedState(categoryId)
      )

    onAllCategoriesCollapsedChange(areAllCategoriesCollapsed)
  })

  // Side effect: apply a header expansion request once the selected tree is loaded.
  $effect(() => {
    const request = expansionRequests.pending
    if (
      isCompletedMode ||
      !request ||
      folderListState !== 'ready' ||
      request.payload.screenRootFolderId !== screenRootFolder?.id
    ) {
      return
    }

    expansionRequests.consume(request, ({ isExpanded }) => {
      for (const categoryId of categoryTreeIds) {
        setPromptTreeCategoryExpandedState(categoryId, isExpanded)
      }
    })
  })

  // Side effect: expose a requested tree row once its folder path is available.
  $effect(() => {
    const request = promptNavigation.treeExpansionRequests.pending
    const rootFolder = screenRootFolder
    if (
      !request ||
      !rootFolder ||
      !isPromptFoldersScreenActive ||
      folderListState !== 'ready' ||
      request.payload.screenRootFolderId !== rootFolder.id
    ) {
      return
    }

    const contentOwnerPath = findContentOwnerPath(rootFolder, request.payload.contentOwnerId)
    if (!contentOwnerPath) return

    promptNavigation.treeExpansionRequests.consume(request, ({ expandPath }) => {
      const categoryIds =
        expandPath === 'owner'
          ? contentOwnerPath.slice(1)
          : contentOwnerPath.slice(1, -1)
      for (const categoryId of categoryIds) {
        setPromptTreeCategoryExpandedState(categoryId, true)
      }
    })
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptTreeRow>[] => {
    const items: VirtualWindowItem<PromptTreeRow>[] = []

    if (screenRootFolder) {
      if (isCompletedMode) {
        for (const [promptIndex, completedPrompt] of selectedCompletedPrompts.entries()) {
          const ownerFolder = promptFolderById[completedPrompt.contentOwnerId]
          if (!ownerFolder) continue
          items.push({
            id: contentPromptRowId(ownerFolder.id, completedPrompt.promptId),
            row: {
              kind: 'prompt',
              folder: ownerFolder,
              categoryId: null,
              promptId: completedPrompt.promptId,
              indentCount: 0,
              isLastRow: promptIndex === selectedCompletedPrompts.length - 1,
              isFirstTreeRow: promptIndex === 0
            }
          })
        }
      } else {
        /** Loaded active entries projected in FolderOrderV2 group order. */
        const groups = screenRootFolder.categoryOrder.categories
        /** Uncategorized content shown without a category header. */
        const uncategorizedEntries = groups[0]?.entries.filter((entry) =>
          entry.kind === 'template'
            ? Boolean(templateById[entry.id])
            : Boolean(promptById[entry.id]) &&
              promptById[entry.id]?.status !== PromptStatus.Completed
        ) ?? []
        for (const [entryIndex, entry] of uncategorizedEntries.entries()) {
          items.push({
            id: contentPromptRowId(screenRootFolder.id, entry.id),
            row: {
              kind: 'prompt',
              folder: screenRootFolder,
              categoryId: null,
              promptId: entry.id,
              indentCount: 0,
              isLastRow: entryIndex === uncategorizedEntries.length - 1,
              isFirstTreeRow: entryIndex === 0
            }
          })
        }
        for (const [groupIndex, group] of groups.slice(1).entries()) {
          if (!group.categoryId) continue
          const category = categoryById[group.categoryId]
          if (!category) continue
          /** Loaded active content retained for this category row. */
          const categoryEntries = group.entries.filter((entry) =>
            entry.kind === 'template'
              ? Boolean(templateById[entry.id])
              : Boolean(promptById[entry.id]) &&
                promptById[entry.id]?.status !== PromptStatus.Completed
          )
          const isExpanded = getPromptTreeCategoryExpandedState(category.id)
          /** Whether this category header is the first rendered active tree row. */
          const isFirstTreeRow = items.length === 0
          items.push({
            id: categoryRowId(category.id),
            row: {
              kind: 'category',
              category,
              rootFolder: screenRootFolder,
              indentCount: 0,
              isFirstTreeRow,
              endsVisibleBranch: groupIndex === groups.length - 2 &&
                (!isExpanded || categoryEntries.length === 0)
            }
          })
          if (!isExpanded) continue
          for (const [entryIndex, entry] of categoryEntries.entries()) {
            items.push({
              id: contentPromptRowId(category.id, entry.id),
              row: {
                kind: 'prompt',
                folder: screenRootFolder,
                categoryId: category.id,
                promptId: entry.id,
                indentCount: 1,
                isLastRow: entryIndex === categoryEntries.length - 1,
                isFirstTreeRow: false
              }
            })
          }
        }

        if (uncategorizedEntries.length === 0 && groups.length === 1) {
          items.push({
            id: `${screenRootFolder.id}:empty-state`,
            row: {
              kind: 'empty-state'
            }
          })
        }
      }
    }

    // Keep one virtual row of trailing space at the end of the tree.
    items.push({
      id: 'bottom-spacer',
      row: {
        kind: 'bottom-spacer'
      }
    })

    return items
  })

  // Side effect: reveal a requested tree row after any matching path expansion is consumed.
  $effect(() => {
    const request = promptNavigation.treeRevealRequests.pending
    const rootFolderId = screenRootFolder?.id
    const expansionRequest = promptNavigation.treeExpansionRequests.pending
    if (
      !request ||
      !rootFolderId ||
      !isPromptFoldersScreenActive ||
      folderListState !== 'ready' ||
      request.payload.screenRootFolderId !== rootFolderId ||
      !scrollToWithinWindowBand ||
      !viewportMetrics?.heightPx ||
      (expansionRequest &&
        isSameNavigationTarget(expansionRequest.payload, request.payload))
    ) {
      return
    }

    if (request.payload.row === 'root-header') {
      promptNavigation.treeRevealRequests.consume(request, () => undefined)
      return
    }

    const rowId = getPromptTreeRowId(request.payload)
    if (!rowId) return
    if (!virtualItems.some((item) => item.id === rowId)) return

    promptNavigation.treeRevealRequests.consume(request, () => {
      scrollToWithinWindowBand!(rowId, PROMPT_TREE_ROW_CENTER_OFFSET_PX, 'minimal')
    })
  })
</script>

<div class="sidebarPromptTree flex min-h-0 flex-1 flex-col">
  {#if folderListState === 'loading'}
    <div class="sidebarPromptTreeStatus flex items-center gap-2 px-2 text-xs">
      <Loader class="size-4 animate-spin" />
      Loading folders...
    </div>
  {:else if folderListState === 'empty'}
    <div class="sidebarPromptTreeStatus px-2 text-xs">Create a Folder to Get Started</div>
  {:else if folderListState === 'ready'}
    {#if screenRootFolder?.kind === 'prompt' && selectedStatusPromptCount === 0}
      <button
        type="button"
        class="sidebarPromptTreeEmptyStatus"
        data-testid={`prompt-tree-${screenMode}-empty-status`}
        onclick={handleEmptyStatusSelect}
      >
        No {isCompletedMode ? 'completed' : 'active'} prompts. Click to view.
      </button>
    {:else}
      <div class="flex min-h-0 flex-1 flex-col">
      <PromptTreeVirtualList
        items={virtualItems}
        testId={virtualWindowTestId}
        spacerTestId={`${virtualWindowTestId}-spacer`}
        bind:scrollToWithinWindowBand
        bind:viewportMetrics
      >
{#snippet rootFolderRow()}
  <!-- Root navigation lives in the sidebar toolbar, so this shared row renderer stays empty. -->
{/snippet}

{#snippet categoryRow(props: PromptTreeCategoryRowProps)}
  {@const isSettingsActive = isTreeEntryActive(props.row.category.id, 'category-details')}

  <!-- Recreate edge registrations when virtual row reuse changes which row owns tree start. -->
  {#key props.row.isFirstTreeRow}
    <PromptTreeCategoryRow
      category={props.row.category}
      isActive={isSettingsActive}
      isDragging={isCategoryRowDragging(props.row.category.id)}
      {isPromptDragActive}
      showDropOverHighlight={false}
      isExpanded={getPromptTreeCategoryExpandedState(props.row.category.id)}
      indentCount={props.row.indentCount}
      endsVisibleBranch={props.row.endsVisibleBranch}
      getCategoryContentDroppableOptions={isCompletedMode
        ? undefined
        : () =>
            getPromptTreePromptDroppableOptions(
              props.rowId,
              props.row.isFirstTreeRow ? 'top-and-bottom' : 'bottom',
              (edge) =>
                getPromptTreeCategoryPromptDropPayload(
                  props.row.category.id,
                  props.row.isFirstTreeRow,
                  edge
                )
            )}
      getCategoryOrderDroppableOptions={isCompletedMode
        ? undefined
        : () => getPromptTreeCategoryDroppableOptions(props.rowId, props.row.category.id)}
      categoryDragOptions={!isCompletedMode
        ? getCategoryRowDragOptions(props.row.category.id, props.row.category.displayName)
        : undefined}
      onCategoryExpandedChange={handleCategoryExpandedChange}
      onCategoryOpen={handleCategoryOpen}
      onCategorySettingsOpen={handleCategorySettingsOpen}
    />
  {/key}
{/snippet}

{#snippet promptRow(props: PromptTreePromptRowProps)}
  {@const isActive = isTreeEntryActive(
    props.row.categoryId ?? props.row.folder.id,
    promptIdToPromptNavigationRow(props.row.promptId)
  )}
  {@const isDragging = isPromptRowDragging(props.row.folder.id, props.row.promptId)}
  {@const promptContent = props.row.folder.kind === 'template'
    ? templateById[props.row.promptId]!
    : promptById[props.row.promptId]!}
  {@const promptTitle =
    promptTreeTitleById[props.row.promptId] ?? getPromptTitleText(promptContent)}

  <!-- Recreate edge registrations when virtual row reuse changes which row owns tree start. -->
  {#key props.row.isFirstTreeRow}
    <PromptTreePromptRow
      folderId={props.row.categoryId ?? props.row.folder.id}
      promptId={props.row.promptId}
      {promptTitle}
      status={promptById[props.row.promptId]?.status}
      isEdited={promptEditedById[props.row.promptId] ?? false}
      {isActive}
      {isDragging}
      {isPromptDragActive}
      indentCount={props.row.indentCount}
      isLastRow={props.row.isLastRow}
      isFirstTreeRow={props.row.isFirstTreeRow}
      getPromptDroppableOptions={isCompletedMode
        ? undefined
        : () =>
            getPromptTreePromptDroppableOptions(
              props.rowId,
              props.row.isFirstTreeRow ? 'top-and-bottom' : 'bottom',
              (edge) => ({
                folderId: props.row.folder.id,
                categoryId: props.row.categoryId,
                targetEntryId: props.row.promptId,
                position: edge === 'top' ? 'before' : 'after'
              })
            )}
      promptDragOptions={isCompletedMode
        ? undefined
        : getPromptRowDragOptions(
            props.row.folder.id,
            props.row.categoryId,
            props.row.promptId,
            promptTitle,
            props.row.folder.kind
          )}
      onPromptSelect={handlePromptTreePromptSelect}
    />
  {/key}
{/snippet}

{#snippet emptyStateRow()}
  {#if isCompletedMode}
    <div
      class="sidebarPromptTreeEmptyState px-2 py-2 text-center"
      data-testid="prompt-tree-empty-state"
    >
      <p class="sidebarPromptTreeEmptyTitle">No completed prompts were found in this folder.</p>
    </div>
  {:else}
    <PromptDropTarget
      getOptions={() =>
        getPromptTreePromptDroppableOptions('empty-state', 'top', () => ({
          folderId: screenRootFolder!.id,
          categoryId: null,
          targetEntryId: null,
          position: 'after'
        }))}
      class="relative h-full"
    >
      {#snippet children({ isOver, isBlocked, edge })}
        <div
          class="sidebarPromptTreeEmptyState px-2 py-2 text-center"
          data-testid="prompt-tree-empty-state"
        >
          <p class="sidebarPromptTreeEmptyTitle">
            {screenRootFolder?.kind === 'template'
              ? 'No templates found in this folder.'
              : 'No active prompts were found in this folder.'}
          </p>
          <p class="mt-2">
            Click the Add {screenRootFolder?.kind === 'template' ? 'Template' : 'Prompt'} button to
            create your first {screenRootFolder?.kind === 'template' ? 'template' : 'prompt'}.
          </p>
        </div>
        {#if isOver && edge}
          <DropIndicator
            testId="prompt-tree-empty-drop-indicator"
            insetStart={getPromptTreeDropIndicatorInset(0)}
            {edge}
            {isBlocked}
          />
        {/if}
      {/snippet}
    </PromptDropTarget>
  {/if}
{/snippet}

{#snippet promptTreeCategoryRowOverlay({ row, rowId }: PromptTreeCategoryRowProps)}
  {@const promptHoveredEdge = getPromptTreeDropTargetEdge(rowId)}
  {@const categoryHoveredEdge = getPromptTreeCategoryDropTargetEdge(rowId)}
  {@const hoveredEdge = promptHoveredEdge ?? categoryHoveredEdge}
  {@const isBlocked = promptHoveredEdge
    ? promptTreePromptDroppableState.isBlocked(rowId)
    : promptTreeCategoryDroppableState.isBlocked(rowId)}

  {#if hoveredEdge}
    <DropIndicator
      testId={categoryDropIndicatorTestId(row.category)}
      insetStart={getPromptTreeDropIndicatorInset(
        row.indentCount + (hoveredEdge === 'bottom' ? 1 : 0)
      )}
      edge={hoveredEdge}
      {isBlocked}
    />
  {/if}
{/snippet}

{#snippet promptTreeRowOverlay({ row, rowId }: PromptTreePromptRowProps)}
  {@const hoveredEdge = getPromptTreeDropTargetEdge(rowId)}
  {@const isBlocked = promptTreePromptDroppableState.isBlocked(rowId)}
  {@const testId = folderPromptDropIndicatorTestId(row.promptId)}

  {#if hoveredEdge}
    <DropIndicator
      {testId}
      insetStart={getPromptTreeDropIndicatorInset(row.indentCount)}
      edge={hoveredEdge}
      {isBlocked}
    />
  {/if}
{/snippet}

{#snippet bottomSpacerRow(props)}
  {#if isCompletedMode}
    <div class="h-full" style={`height:${props.rowHeightPx}px;`} aria-hidden="true"></div>
  {:else}
    <PromptDropTarget
      getOptions={() => getPromptTreeCategoryDroppableOptions('bottom-spacer', null)}
      class="relative h-full"
      style={`height:${props.rowHeightPx}px;`}
      data-testid={promptTreeBottomSpacerDropTargetTestId}
    />
  {/if}
{/snippet}

{#snippet promptTreeBottomSpacerRowOverlay({ rowId }: PromptTreeBottomSpacerRowProps)}
  {@const edge = getPromptTreeCategoryDropTargetEdge(rowId)}

  {#if edge}
    <DropIndicator
      testId={promptTreeBottomSpacerDropIndicatorTestId}
      insetStart={getPromptTreeDropIndicatorInset(0)}
      {edge}
      isBlocked={promptTreeCategoryDroppableState.isBlocked(rowId)}
    />
  {/if}
{/snippet}

      </PromptTreeVirtualList>
      </div>
    {/if}
  {/if}
</div>

<style>
  .sidebarPromptTreeEmptyStatus {
    background: transparent;
    border: 0;
    color: var(--ui-muted-text);
    cursor: pointer;
    font-size: 12px;
    padding: 12px 16px;
    text-align: left;
  }

  .sidebarPromptTreeEmptyStatus:hover,
  .sidebarPromptTreeEmptyStatus:focus-visible {
    color: var(--ui-normal-text);
  }
</style>
