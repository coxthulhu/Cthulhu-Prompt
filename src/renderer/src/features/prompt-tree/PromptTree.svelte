<script lang="ts">
  import { getPromptLocation } from '@renderer/data/Mutations/PromptLocationMutations'
  import { emptyItemsLabel } from '@renderer/common/emptyStateText'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { Loader } from 'lucide-svelte'
  import {
    createDroppableStateRegistry,
    type DroppableAllowedEdges,
    type DroppableEdge,
    type DroppableOptions,
    type DraggableOptions
  } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import {
    CATEGORY_DRAG_TYPE,
    PROMPT_HANDLE_DRAG_TYPE,
    resolveCategoryDropPreviousCategoryId,
    type CategoryDragPayload,
    type CategoryDropPayload,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload
  } from '@renderer/features/prompt-drag-drop/promptHandleDrag'
  import { createPromptDragGhost } from '@renderer/features/prompt-drag-drop/promptDragGhost'
  import {
    clearPromptEntryDrag,
    promptEntryDragState,
    startCategoryDrag
  } from '@renderer/features/prompt-drag-drop/promptEntryDragState.svelte.ts'
  import {
    type PromptClientStateRecord,
    promptClientStateCollection
  } from '@renderer/data/Collections/PromptClientStateCollection'
  import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
  import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
  import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
  import { getPromptDisplayTitle as getPromptTitleText } from '@shared/domain/prompt/promptFallbackTitle'
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
    setPromptCollectionSelectedEntryIdWithAutosave
  } from '@renderer/data/UiState/autosave/WorkspaceUiStateAutosave.svelte.ts'
  import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
  import { getPromptStatusFolderDefinition, PROMPT_STATUS_FOLDER_REGISTRY, type Prompt } from '@shared/domain/prompt/Prompt'
  import { getMarkdownContentCategoryOrder } from '@shared/domain/markdown-content/MarkdownContent'
  import type { PromptTemplate } from '@shared/domain/prompt-template/PromptTemplate'
  import {
    getFinalPromptCollectionScreenModeDefinition,
    PromptCollectionScreenMode
  } from '@renderer/features/prompt-collections/promptCollectionScreenMode'
  import {
    type VirtualWindowScrollApi,
    type VirtualWindowItem,
    type VirtualWindowViewportMetrics
  } from '@renderer/common/virtual-window/virtualWindowTypes'
  import PromptTreeVirtualList, {
    type PromptTreeBottomSpacerRowProps,
    type PromptTreeCategoryRowProps,
    type PromptTreePromptRowProps,
    type PromptTreeRow
  } from './PromptTreeVirtualList.svelte'
  import DropIndicator from '@renderer/common/drag-drop/DropIndicator.svelte'
  import DropTarget from '@renderer/common/drag-drop/DropTarget.svelte'
  import PromptTreeCategoryRow from './PromptTreeCategoryRow.svelte'
  import PromptTreeInlineActionRow from './PromptTreeInlineActionRow.svelte'
  import PromptTreePromptRow from './PromptTreePromptRow.svelte'
  import {
    categoryDropIndicatorTestId,
    categoryEmptyActionTestId,
    collectionPromptDropIndicatorTestId,
    promptTreeBottomSpacerDropIndicatorTestId,
    promptTreeBottomSpacerDropTargetTestId
  } from './promptTreeTestIds'
  import { collectFinalizedPrompts } from '../prompt-collections/promptCollectionCompletedPrompts'
  import { moveCategory } from '@renderer/data/Mutations/CategoryMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import {
    createPromptTreePromptDragController,
    resolvePromptTreePromptMove
  } from './promptTreeDrag'
  import { createBlankPromptInCollection } from '../prompt-collections/createBlankPromptInCollection'
  import { createBlankPromptTemplateInCollection } from '../prompt-collections/createBlankPromptTemplateInCollection'
  import {
    PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX,
    PROMPT_COLLECTION_VERTICAL_BIAS_PX
  } from '../prompt-collections/promptCollectionScrollOffsets'

  type CollectionListState = 'no-workspace' | 'loading' | 'empty' | 'ready'
  type PromptTreeBulkExpansionRequest = {
    /** Exact category workflow receiving this toolbar request. */
    statusFolderId: PromptCollectionScreenMode
    screenCollectionId: string
    isExpanded: boolean
  }

  let {
    promptCollections,
    collectionListState,
    screenCollectionId = null,
    expansionRequests,
    isPromptCollectionsScreenActive = false,
    screenMode = PromptCollectionScreenMode.Active,
    onAllCategoriesCollapsedChange,
    onScreenModeSelect,
    onManageCategory,
    onScreenCollectionSelect
  } = $props<{
    promptCollections: PromptCollection[]
    collectionListState: CollectionListState
    screenCollectionId?: string | null
    expansionRequests: ConsumableRequestCoordinator<PromptTreeBulkExpansionRequest>
    isPromptCollectionsScreenActive?: boolean
    screenMode?: PromptCollectionScreenMode
    onAllCategoriesCollapsedChange: (isCollapsed: boolean) => void
    onScreenModeSelect: (screenMode: PromptCollectionScreenMode) => void
    /** Opens category management to one tree category. */
    onManageCategory: (categoryId: string) => void
    onScreenCollectionSelect: (screenCollectionId: string) => void
  }>()

  const PROMPT_TREE_ROW_CENTER_OFFSET_PX = 14
  let scrollApi = $state<VirtualWindowScrollApi | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
  let categoryTreeExpandedStates = $state<Record<string, boolean>>({})
  /** Whether a prompt-tree creation action is waiting for persistence. */
  let isCreatingTreeContent = $state(false)
  const promptNavigation = getPromptNavigationContext()
  const workspaceSelection = getWorkspaceSelectionContext()
  const promptClientStateQuery = useLiveQuery(promptClientStateCollection) as {
    data: PromptClientStateRecord[]
  }
  const promptQuery = useLiveQuery(promptsCollection) as {
    data: Prompt[]
  }
  const promptTemplateQuery = useLiveQuery(promptTemplatesCollection) as {
    data: PromptTemplate[]
  }
  /** Live category metadata used by the selected collection's tree projection. */
  const categoryQuery = useLiveQuery(categoryCollection)

  const promptTreeTitleById = $derived.by(() => {
    const titlesById: Record<string, string> = {}

    for (const prompt of promptQuery.data) {
      if (!prompt) {
        continue
      }

      titlesById[prompt.id] = getPromptTitleText(prompt)
    }
    for (const template of promptTemplateQuery.data) {
      titlesById[template.id] = getPromptTitleText(template)
    }

    return titlesById
  })
  // Maps prompt IDs to the session-latched edited state displayed by prompt-tree accents.
  const promptEditedById = $derived.by(() =>
    Object.fromEntries(
      promptClientStateQuery.data.map((clientState) => [clientState.id, clientState.isEdited])
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
  const promptCollectionById = $derived.by(() => {
    const promptCollectionsById: Record<string, PromptCollection> = {}

    for (const promptCollection of promptCollections) {
      promptCollectionsById[promptCollection.id] = promptCollection
    }

    return promptCollectionsById
  })
  const templateById = $derived.by(() =>
    Object.fromEntries(promptTemplateQuery.data.map((template) => [template.id, template]))
  )
  /** Loaded category metadata indexed by stable ID. */
  const categoryById = $derived(
    Object.fromEntries(categoryQuery.data.map((category) => [category.id, category]))
  )

  const screenCollection = $derived.by((): PromptCollection | null => {
    if (promptCollections.length === 0) {
      return null
    }

    return (
      promptCollections.find((promptCollection) => promptCollection.id === screenCollectionId) ??
      promptCollections[0]!
    )
  })
  /** Registry metadata for this exact workflow tree. */
  const statusGroup = $derived(PROMPT_STATUS_FOLDER_REGISTRY[screenMode])
  /** Template trees have their own selector namespace. */
  const testIdGroup = $derived(screenCollection?.kind === 'template' && screenMode === 'active' ? 'template' : screenMode)
  /** Virtualization test identity distinguishes simultaneously mounted trees. */
  const virtualWindowTestId = $derived(`prompt-tree-${testIdGroup}-virtual-window`)
  /** Final-status metadata for this tree, or null for a category-ordered tree. */
  const finalModeDefinition = $derived(getFinalPromptCollectionScreenModeDefinition(screenMode))
  /** Whether this tree renders an automatically ordered final status. */
  const isFinalMode = $derived(finalModeDefinition !== null)
  /** Drag payload section identity for this fixed status tree. */
  const dragStatusSection = $derived(screenMode)
  /** Finalized prompts belonging to this tree's exact final status. */
  const selectedFinalizedPrompts = $derived.by(() => {
    if (!screenCollection) {
      return []
    }

    if (!finalModeDefinition) {
      return []
    }

    return collectFinalizedPrompts({
      collection: screenCollection,
      statusFolderId: screenMode,
      statusByPromptId: Object.fromEntries(
        Object.values(screenCollection.kind === 'template' ? templateById : promptById).map((prompt) => [prompt.id, prompt.status])
      ),
      finalizedAtByPromptId: Object.fromEntries(
        Object.values(screenCollection.kind === 'template' ? templateById : promptById).map((prompt) => [prompt.id, prompt.finalizedAt ?? null])
      )
    })
  })
  /** Loaded active prompt count used to replace an empty status tree with its navigation link. */
  const selectedOrderedPromptCount = $derived.by(() => {
    if (!screenCollection || isFinalMode) return 0

    return getMarkdownContentCategoryOrder(screenCollection, screenMode).categories.reduce(
      (count, group) =>
        count +
        group.entries.filter(
          (entry) =>
            entry.kind === 'template'
              ? Boolean(templateById[entry.id])
              : Boolean(promptById[entry.id]) &&
                getPromptStatusFolderDefinition(promptById[entry.id]!.status).id === screenMode
        ).length,
      0
    )
  })
  /** Prompt count for this tree's fixed active or final status. */
  const selectedStatusPromptCount = $derived(
    isFinalMode ? selectedFinalizedPrompts.length : selectedOrderedPromptCount
  )
  const PROMPT_TREE_DROP_INDICATOR_BASE_INSET_PX = 15
  const PROMPT_TREE_INDENT_WIDTH_PX = 12
  const getPromptTreeDropIndicatorInset = (indentCount: number): string =>
    `${PROMPT_TREE_DROP_INDICATOR_BASE_INSET_PX + indentCount * PROMPT_TREE_INDENT_WIDTH_PX}px`

  /** Returns the virtual-row ID for a category header. */
  const categoryRowId = (categoryId: string): string => `${categoryId}:category`
  /** Returns the virtual-row ID for content owned by a collection group or category. */
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
    if (!screenCollection || isFinalMode) return []
    return getMarkdownContentCategoryOrder(screenCollection, screenMode).categories.flatMap((group) =>
      group.categoryId && categoryById[group.categoryId] ? [group.categoryId] : []
    )
  })
  /** Empty Active trees still render their category headers as navigable content. */
  const isSelectedStatusTreeEmpty = $derived(
    selectedStatusPromptCount === 0 && (isFinalMode || categoryTreeIds.length === 0)
  )

  const findContentOwnerPath = (
    collection: PromptCollection,
    contentOwnerId: string
  ): string[] | null => {
    if (collection.id === contentOwnerId) return [collection.id]
    return categoryById[contentOwnerId] ? [collection.id, contentOwnerId] : null
  }

  const isSameNavigationTarget = (
    left: PromptNavigationTarget,
    right: PromptNavigationTarget
  ): boolean =>
    left.screenCollectionId === right.screenCollectionId &&
    left.contentOwnerId === right.contentOwnerId &&
    left.row === right.row

  /** Maps overview navigation to the first content entry in this status tree. */
  const getPromptTreeRowId = (target: PromptNavigationTarget): string | null => {
    if (target.row === 'collection-header') {
      return virtualItems.find((item) => item.row.kind === 'prompt' || item.row.kind === 'category')?.id ?? null
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
    const destinationCollection = promptCollectionById[dropPayload.collectionId]
    if (!destinationCollection) return false

    const sourceCollection = promptCollectionById[payload.location.promptCollectionId]
    if (!sourceCollection) return false
    if (
      payload.contentKind !== destinationCollection.kind ||
      sourceCollection.kind !== destinationCollection.kind
    ) {
      return false
    }

    return resolvePromptTreePromptMove(promptCollections, payload, dropPayload) !== null
  }

  /** Builds a category-only target for the boundary before a category or at tree bottom. */
  const getPromptTreeCategoryDroppableOptions = (
    rowId: string,
    nextCategoryId: string | null
  ): DroppableOptions<CategoryDragPayload, CategoryDropPayload> => ({
    dragType: `${CATEGORY_DRAG_TYPE}:${screenMode}`,
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

  /** Maps a category header edge to either Uncategorized start or category start. */
  const getPromptTreeCategoryPromptDropPayload = (
    categoryId: string,
    isFirstTreeRow: boolean,
    edge: DroppableEdge | null
  ): PromptHandleDropPayload => {
    /** Top edge of the first header is the empty Uncategorized start boundary. */
    const destinationCategoryId = isFirstTreeRow && edge === 'top' ? null : categoryId
    return {
      collectionId: screenCollection!.id,
      categoryId: destinationCategoryId,
      targetEntryId: null,
      position: 'after',
      statusSection: dragStatusSection
    }
  }

  const getPromptTreeDropTargetEdge = (rowId: string): DroppableEdge | null =>
    promptTreePromptDroppableState.edge(rowId)

  /** Returns the active category boundary edge for one virtual row. */
  const getPromptTreeCategoryDropTargetEdge = (rowId: string): DroppableEdge | null =>
    promptTreeCategoryDroppableState.edge(rowId)

  const promptDragController = createPromptTreePromptDragController({
    getPromptCollections: () => promptCollections
  })

  const getPromptRowDragOptions = (
    collectionId: string,
    promptId: string,
    title: string,
    contentKind: import('@shared/domain/prompt-collection/PromptCollection').PromptCollectionContentKind
  ): DraggableOptions<PromptHandleDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: {
      fromId: promptId,
      location: getPromptLocation(collectionId, promptId),
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
    dragType: `${CATEGORY_DRAG_TYPE}:${screenMode}`,
    payload: { categoryId },
    createGhost: () => createPromptDragGhost(displayName, 'category'),
    onDragStart: (payload) => {
      startCategoryDrag(payload.categoryId)
    },
    onDragFinish: ({ sourcePayload, dropPayload }) => {
      clearPromptEntryDrag()
      if (!screenCollection || !dropPayload) return
      /** Category predecessor represented by the selected boundary. */
      const previousCategoryId = resolveCategoryDropPreviousCategoryId(
        categoryTreeIds,
        sourcePayload.categoryId,
        dropPayload.nextCategoryId
      )
      if (previousCategoryId === undefined) return
      void runIpcBestEffort(() =>
        moveCategory(screenCollection.id, sourcePayload.categoryId, previousCategoryId, screenMode)
      )
    }
  })

  /** Highlights the first entry for the overview, or the explicitly selected content row. */
  const isTreeEntryActive = (contentOwnerId: string, row: PromptNavigationRow): boolean => {
    if (
      !isPromptCollectionsScreenActive ||
      promptNavigation.screenCollectionId !== screenCollection?.id ||
      !promptNavigation.selectedRow
    ) {
      return false
    }

    if (promptNavigation.selectedRow === 'collection-header') {
      return virtualItems[0]?.id === (
        row === 'category-details'
          ? categoryRowId(contentOwnerId)
          : contentPromptRowId(contentOwnerId, promptNavigationRowToPersistedEntryId(row))
      )
    }

    return (
      promptNavigation.contentOwnerId === contentOwnerId &&
      promptNavigation.selectedRow === row
    )
  }

  const isPromptRowDragging = (collectionId: string, promptId: string): boolean => {
    const draggedEntry = promptEntryDragState.draggedEntry
    return (
      draggedEntry?.kind === 'content' &&
      draggedEntry.location.promptCollectionId === collectionId &&
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
    const collectionId = screenCollection?.id
    if (!collectionId) return
    const isSameCollectionActive = isPromptCollectionsScreenActive

    onScreenModeSelect(screenMode)
    promptNavigation.select({
      screenCollectionId: collectionId,
      contentOwnerId,
      row,
      source,
      navigationHighlightPromptId,
      forceRequest: true,
      contentReveal: {
        ...(row === 'category-details'
          ? {
              scrollType: 'vertical-bias' as const,
              verticalBiasPx: PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX
            }
          : {
              scrollType: 'vertical-bias' as const,
              verticalBiasPx: PROMPT_COLLECTION_VERTICAL_BIAS_PX
            }),
        expandContent: source === 'category-open'
      },
      treeExpansion: source === 'category-open' ? 'owner' : undefined
    })

    if (!isSameCollectionActive) {
      onScreenCollectionSelect(collectionId)
    }
  }

  /** Selects a prompt owned by either the collection or a category. */
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

  /** Opens the shared management dialog to the selected tree category. */
  const handleCategorySettingsOpen = (categoryId: string) => {
    onManageCategory(categoryId)
  }

  /** Creates content at the start of the collection or a category and reveals its editor. */
  const handleTreeContentAddToTop = async (categoryId: string | null): Promise<void> => {
    /** collection that owns the destination and its new content. */
    const collection = screenCollection
    if (!collection || isFinalMode || isCreatingTreeContent) return

    isCreatingTreeContent = true
    /** Optimistic creation and its matching persistence promise. */
    const creation =
      collection.kind === 'template'
        ? createBlankPromptTemplateInCollection(collection.id, null, categoryId)
        : createBlankPromptInCollection(collection.id, null, categoryId, screenMode)
    /** Stable ID generated for the new prompt or template. */
    const contentId = 'templateId' in creation ? creation.templateId : creation.promptId
    /** Navigation row that selects the new content. */
    const row = promptIdToPromptNavigationRow(contentId)

    onScreenModeSelect(screenMode)
    promptNavigation.select({
      screenCollectionId: collection.id,
      contentOwnerId: categoryId ?? collection.id,
      row,
      source: 'prompt-tree-create',
      forceRequest: true,
      contentReveal: {
        scrollType: 'vertical-bias',
        verticalBiasPx: PROMPT_COLLECTION_VERTICAL_BIAS_PX
      },
      focusPromptId: contentId,
      treeExpansion: 'owner'
    })

    /** Selected workspace whose category selection is persisted. */
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptCollectionSelectedEntryIdWithAutosave(
        workspaceId,
        collection.id,
        categoryId ?? collection.id,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    if (!isPromptCollectionsScreenActive) {
      onScreenCollectionSelect(collection.id)
    }

    await runIpcBestEffort(() => creation.persistence)
    isCreatingTreeContent = false
  }

  /** Opens this empty tree's status view while retaining the collection selection. */
  const handleEmptyStatusSelect = (): void => {
    onScreenModeSelect(screenMode)
  }

  // Side effect: report the current tree collapse state to the sidebar action button.
  $effect(() => {
    if (isFinalMode) return
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
      isFinalMode ||
      !request ||
      collectionListState !== 'ready' ||
      request.payload.statusFolderId !== screenMode ||
      request.payload.screenCollectionId !== screenCollection?.id
    ) {
      return
    }

    expansionRequests.consume(request, ({ isExpanded }) => {
      for (const categoryId of categoryTreeIds) {
        setPromptTreeCategoryExpandedState(categoryId, isExpanded)
      }
    })
  })

  // Side effect: expose a requested tree row once its collection path is available.
  $effect(() => {
    const request = promptNavigation.treeExpansionRequests.pending
    const collection = screenCollection
    if (
      !request ||
      !collection ||
      !isPromptCollectionsScreenActive ||
      collectionListState !== 'ready' ||
      request.payload.screenCollectionId !== collection.id
    ) {
      return
    }

    const contentOwnerPath = findContentOwnerPath(collection, request.payload.contentOwnerId)
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

    if (screenCollection) {
      if (isFinalMode) {
        for (const [promptIndex, finalizedPrompt] of selectedFinalizedPrompts.entries()) {
          const ownerCollection = promptCollectionById[finalizedPrompt.contentOwnerId]
          if (!ownerCollection) continue
          items.push({
            id: contentPromptRowId(ownerCollection.id, finalizedPrompt.promptId),
            row: {
              kind: 'prompt',
              collection: ownerCollection,
              categoryId: null,
              promptId: finalizedPrompt.promptId,
              indentCount: 0,
              isLastRow: promptIndex === selectedFinalizedPrompts.length - 1,
              isFirstTreeRow: promptIndex === 0
            }
          })
        }
      } else {
        /** Loaded active entries projected in CategoryOrder group order. */
        const groups = getMarkdownContentCategoryOrder(screenCollection, screenMode).categories
        /** Uncategorized content shown without a category header. */
        const uncategorizedEntries = groups[0]?.entries.filter((entry) =>
          entry.kind === 'template'
            ? Boolean(templateById[entry.id])
            : Boolean(promptById[entry.id]) &&
              getPromptStatusFolderDefinition(promptById[entry.id]!.status).id === screenMode
        ) ?? []
        for (const [entryIndex, entry] of uncategorizedEntries.entries()) {
          items.push({
            id: contentPromptRowId(screenCollection.id, entry.id),
            row: {
              kind: 'prompt',
              collection: screenCollection,
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
                getPromptStatusFolderDefinition(promptById[entry.id]!.status).id === screenMode
          )
          const isExpanded = getPromptTreeCategoryExpandedState(category.id)
          /** Whether this category header is the first rendered active tree row. */
          const isFirstTreeRow = items.length === 0
          items.push({
            id: categoryRowId(category.id),
            row: {
              kind: 'category',
              category,
              collection: screenCollection,
              indentCount: 0,
              isFirstTreeRow,
              endsVisibleBranch: groupIndex === groups.length - 2 &&
                !isExpanded
            }
          })
          if (!isExpanded) continue
          if (categoryEntries.length === 0) {
            items.push({
              id: `${category.id}:empty-category`,
              row: {
                kind: 'empty-category',
                category,
                indentCount: 1,
                isLastRow: true
              }
            })
          }
          for (const [entryIndex, entry] of categoryEntries.entries()) {
            items.push({
              id: contentPromptRowId(category.id, entry.id),
              row: {
                kind: 'prompt',
                collection: screenCollection,
                categoryId: category.id,
                promptId: entry.id,
                indentCount: 1,
                isLastRow: entryIndex === categoryEntries.length - 1,
                isFirstTreeRow: false
              }
            })
          }
        }

        if (
          screenCollection.kind === 'template' &&
          uncategorizedEntries.length === 0 &&
          groups.length === 1
        ) {
          items.push({
            id: `${screenCollection.id}:empty-state`,
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
    const collectionId = screenCollection?.id
    const expansionRequest = promptNavigation.treeExpansionRequests.pending
    if (
      !request ||
      !collectionId ||
      !isPromptCollectionsScreenActive ||
      collectionListState !== 'ready' ||
      request.payload.screenCollectionId !== collectionId ||
      !scrollApi ||
      !viewportMetrics?.heightPx ||
      (expansionRequest &&
        isSameNavigationTarget(expansionRequest.payload, request.payload))
    ) {
      return
    }

    if (request.payload.row === 'collection-header' && isSelectedStatusTreeEmpty) {
      promptNavigation.treeRevealRequests.consume(request, () => undefined)
      return
    }

    const rowId = getPromptTreeRowId(request.payload)
    if (!rowId) return
    if (!virtualItems.some((item) => item.id === rowId)) return

    promptNavigation.treeRevealRequests.consume(request, () => {
      scrollApi!.scrollToWithinWindowBand(rowId, PROMPT_TREE_ROW_CENTER_OFFSET_PX, 'minimal')
    })
  })
</script>

<div class="sidebarPromptTree flex min-h-0 flex-1 flex-col">
  {#if collectionListState === 'loading'}
    <div class="sidebarPromptTreeStatus flex items-center gap-2 px-2 text-sm">
      <Loader class="size-4 animate-spin" />
      Loading collections...
    </div>
  {:else if collectionListState === 'empty'}
    <div class="sidebarPromptTreeStatus px-2 text-sm">Create a collection to get started.</div>
  {:else if collectionListState === 'ready'}
    {#if screenCollection && isSelectedStatusTreeEmpty && (screenCollection.kind === 'prompt' || isFinalMode)}
      <DropTarget
        getOptions={() =>
          getPromptTreePromptDroppableOptions('empty-status', 'top', () => ({
            collectionId: screenCollection!.id,
            categoryId: null,
            targetEntryId: null,
            position: 'after',
            statusSection: dragStatusSection
          }))}
        class="relative"
      >
        {#snippet children({ isOver, isBlocked, edge })}
          <PromptTreeInlineActionRow
            text={`${emptyItemsLabel('prompt', statusGroup.label)}. Click to ${isFinalMode ? 'view' : 'add'}.`}
            testId={`prompt-tree-${screenMode}-empty-status`}
            onclick={isFinalMode ? handleEmptyStatusSelect : () => handleTreeContentAddToTop(null)}
          />
          {#if isOver && edge}
            <DropIndicator
              testId={`prompt-tree-${screenMode}-empty-drop-indicator`}
              insetStart={getPromptTreeDropIndicatorInset(0)}
              {edge}
              {isBlocked}
            />
          {/if}
        {/snippet}
      </DropTarget>
    {:else}
      <div class="flex min-h-0 flex-1 flex-col">
      <PromptTreeVirtualList
        items={virtualItems}
        testId={virtualWindowTestId}
        spacerTestId={`${virtualWindowTestId}-spacer`}
        bind:scrollApi
        bind:viewportMetrics
      >
{#snippet collectionRow()}
  <!-- Collection navigation lives in the sidebar toolbar, so this shared row renderer stays empty. -->
{/snippet}

{#snippet categoryRow(props: PromptTreeCategoryRowProps)}
  {@const isSettingsActive = isTreeEntryActive(props.row.category.id, 'category-details')}

  <!-- Recreate edge registrations when virtual row reuse changes which row owns tree start. -->
  {#key props.row.isFirstTreeRow}
    <PromptTreeCategoryRow
      {testIdGroup}
      category={props.row.category}
      isActive={isSettingsActive}
      isDragging={isCategoryRowDragging(props.row.category.id)}
      {isPromptDragActive}
      showDropOverHighlight={false}
      isExpanded={getPromptTreeCategoryExpandedState(props.row.category.id)}
      indentCount={props.row.indentCount}
      endsVisibleBranch={props.row.endsVisibleBranch}
      contentLabel={screenCollection?.kind === 'template' ? 'Template' : 'Prompt'}
      isAddToTopDisabled={isCreatingTreeContent}
      getCategoryContentDroppableOptions={isFinalMode
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
      getCategoryOrderDroppableOptions={isFinalMode
        ? undefined
        : () => getPromptTreeCategoryDroppableOptions(props.rowId, props.row.category.id)}
      categoryDragOptions={!isFinalMode
        ? getCategoryRowDragOptions(props.row.category.id, props.row.category.displayName)
        : undefined}
      onCategoryExpandedChange={handleCategoryExpandedChange}
      onCategoryOpen={handleCategoryOpen}
      onCategorySettingsOpen={handleCategorySettingsOpen}
      onCategoryAddToTop={isFinalMode ? undefined : handleTreeContentAddToTop}
    />
  {/key}
{/snippet}

{#snippet promptRow(props: PromptTreePromptRowProps)}
  {@const isActive = isTreeEntryActive(
    props.row.categoryId ?? props.row.collection.id,
    promptIdToPromptNavigationRow(props.row.promptId)
  )}
  {@const isDragging = isPromptRowDragging(props.row.collection.id, props.row.promptId)}
  {@const promptContent = props.row.collection.kind === 'template'
    ? templateById[props.row.promptId]!
    : promptById[props.row.promptId]!}
  {@const promptTitle =
    promptTreeTitleById[props.row.promptId] ?? getPromptTitleText(promptContent)}

  <!-- Recreate edge registrations when virtual row reuse changes which row owns tree start. -->
  {#key props.row.isFirstTreeRow}
    <PromptTreePromptRow
      {testIdGroup}
      collectionId={props.row.categoryId ?? props.row.collection.id}
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
      getPromptDroppableOptions={() =>
        getPromptTreePromptDroppableOptions(
          props.rowId,
          props.row.isFirstTreeRow ? 'top-and-bottom' : 'bottom',
          (edge) => ({
            collectionId: props.row.collection.id,
            categoryId: props.row.categoryId,
            targetEntryId: props.row.promptId,
            position: edge === 'top' ? 'before' : 'after',
            statusSection: dragStatusSection
          })
        )}
      promptDragOptions={getPromptRowDragOptions(
        props.row.collection.id,
        props.row.promptId,
        promptTitle,
        props.row.collection.kind
      )}
      onPromptSelect={handlePromptTreePromptSelect}
    />
  {/key}
{/snippet}

<!-- Offers the category's existing creation action with the compact inline-row appearance. -->
{#snippet emptyCategoryRow({ row })}
  <PromptTreeInlineActionRow
    text="Category is empty. Click to add."
    indentCount={row.indentCount}
    isLastRow={row.isLastRow}
    testId={categoryEmptyActionTestId(row.category, testIdGroup)}
    onclick={() => handleTreeContentAddToTop(row.category.id)}
  />
{/snippet}

{#snippet emptyStateRow()}
  <DropTarget
    getOptions={() =>
      getPromptTreePromptDroppableOptions('empty-state', 'top', () => ({
        collectionId: screenCollection!.id,
        categoryId: null,
        targetEntryId: null,
        position: 'after',
        statusSection: dragStatusSection
      }))}
    class="relative h-full"
  >
    {#snippet children({ isOver, isBlocked, edge })}
      <PromptTreeInlineActionRow
        text={`${emptyItemsLabel('template')}. Click to add.`}
        testId={`prompt-tree-${testIdGroup}-empty-state`}
        onclick={() => handleTreeContentAddToTop(null)}
      />
      {#if isOver && edge}
        <DropIndicator
          testId={`prompt-tree-${testIdGroup}-empty-drop-indicator`}
          insetStart={getPromptTreeDropIndicatorInset(0)}
          {edge}
          {isBlocked}
        />
      {/if}
    {/snippet}
  </DropTarget>
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
      testId={categoryDropIndicatorTestId(row.category, testIdGroup)}
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
  {@const testId = collectionPromptDropIndicatorTestId(row.promptId, testIdGroup)}

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
  {#if isFinalMode}
    <DropTarget
      getOptions={() =>
        getPromptTreePromptDroppableOptions('bottom-spacer', 'top', () => ({
          collectionId: screenCollection!.id,
          categoryId: null,
          targetEntryId: null,
          position: 'after',
          statusSection: dragStatusSection
        }))}
      class="relative h-full"
      style={`height:${props.rowHeightPx}px;`}
    />
  {:else}
    <DropTarget
      getOptions={() => getPromptTreeCategoryDroppableOptions('bottom-spacer', null)}
      class="relative h-full"
      style={`height:${props.rowHeightPx}px;`}
      data-testid={promptTreeBottomSpacerDropTargetTestId(testIdGroup)}
    />
  {/if}
{/snippet}

{#snippet promptTreeBottomSpacerRowOverlay({ rowId }: PromptTreeBottomSpacerRowProps)}
  {@const edge = isFinalMode
    ? getPromptTreeDropTargetEdge(rowId)
    : getPromptTreeCategoryDropTargetEdge(rowId)}

  {#if edge}
    <DropIndicator
      testId={promptTreeBottomSpacerDropIndicatorTestId(testIdGroup)}
      insetStart={getPromptTreeDropIndicatorInset(0)}
      {edge}
      isBlocked={isFinalMode
        ? promptTreePromptDroppableState.isBlocked(rowId)
        : promptTreeCategoryDroppableState.isBlocked(rowId)}
    />
  {/if}
{/snippet}

      </PromptTreeVirtualList>
      </div>
    {/if}
  {/if}
</div>
