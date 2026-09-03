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
    type PromptClientStateRecord,
    promptClientStateCollection
  } from '@renderer/data/Collections/PromptClientStateCollection'
  import { promptCollection } from '@renderer/data/Collections/PromptCollection'
  import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
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
  } from '@renderer/data/UiState/WorkspaceUiStateAutosave.svelte.ts'
  import type { PromptFolder } from '@shared/PromptFolder'
  import { isFinalPromptStatus, type Prompt } from '@shared/Prompt'
  import { getMarkdownContentCategoryOrder } from '@shared/MarkdownContent'
  import type { PromptTemplate } from '@shared/PromptTemplate'
  import {
    getFinalPromptFolderScreenModeDefinition,
    PromptFolderScreenMode
  } from '@renderer/features/prompt-folders/promptFolderScreenMode'
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
  import { collectFinalizedPrompts } from '../prompt-folders/promptFolderCompletedPrompts'
  import { moveCategory } from '@renderer/data/Mutations/CategoryMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import {
    createPromptTreePromptDragController,
    resolvePromptTreePromptMove
  } from './promptTreeDrag'
  import { createBlankPromptInFolder } from '../prompt-folders/createBlankPromptInFolder'
  import { createBlankPromptTemplateInFolder } from '../prompt-folders/createBlankPromptTemplateInFolder'
  import {
    PROMPT_FOLDER_CATEGORY_TOP_OFFSET_PX,
    PROMPT_FOLDER_VERTICAL_BIAS_PX
  } from '../prompt-folders/promptFolderScrollOffsets'

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
  /** Whether a category add-to-top action is waiting for persistence. */
  let isCreatingCategoryContent = $state(false)
  const promptNavigation = getPromptNavigationContext()
  const workspaceSelection = getWorkspaceSelectionContext()
  const promptClientStateQuery = useLiveQuery(promptClientStateCollection) as {
    data: PromptClientStateRecord[]
  }
  const promptQuery = useLiveQuery(promptCollection) as {
    data: Prompt[]
  }
  const promptTemplateQuery = useLiveQuery(promptTemplateCollection) as {
    data: PromptTemplate[]
  }
  /** Live category metadata used by the selected root folder's tree projection. */
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
  /** Final-status metadata for this tree, or null for the Active tree. */
  const finalModeDefinition = $derived(getFinalPromptFolderScreenModeDefinition(screenMode))
  /** Whether this tree renders an automatically ordered final status. */
  const isFinalMode = $derived(finalModeDefinition !== null)
  /** Drag payload section identity for this fixed status tree. */
  const dragStatusSection = $derived(screenMode)
  /** Finalized prompts belonging to this tree's exact final status. */
  const selectedFinalizedPrompts = $derived.by(() => {
    if (!screenRootFolder || screenRootFolder.kind === 'template') {
      return []
    }

    if (!finalModeDefinition) {
      return []
    }

    return collectFinalizedPrompts({
      rootFolder: screenRootFolder,
      status: finalModeDefinition.status,
      statusByPromptId: Object.fromEntries(
        Object.values(promptById).map((prompt) => [prompt.id, prompt.status])
      ),
      finalizedAtByPromptId: Object.fromEntries(
        Object.values(promptById).map((prompt) => [prompt.id, prompt.finalizedAt ?? null])
      )
    })
  })
  /** Loaded active prompt count used to replace an empty status tree with its navigation link. */
  const selectedActivePromptCount = $derived.by(() => {
    if (!screenRootFolder || screenRootFolder.kind === 'template') return 0

    return getMarkdownContentCategoryOrder(screenRootFolder).categories.reduce(
      (count, group) =>
        count +
        group.entries.filter(
          (entry) =>
            entry.kind === 'prompt' &&
            Boolean(promptById[entry.id]) &&
            !isFinalPromptStatus(promptById[entry.id]!.status)
        ).length,
      0
    )
  })
  /** Prompt count for this tree's fixed active or final status. */
  const selectedStatusPromptCount = $derived(
    isFinalMode ? selectedFinalizedPrompts.length : selectedActivePromptCount
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
    return getMarkdownContentCategoryOrder(screenRootFolder).categories.flatMap((group) =>
      group.categoryId && categoryById[group.categoryId] ? [group.categoryId] : []
    )
  })
  /** Empty Active trees still render their category headers as navigable content. */
  const isSelectedStatusTreeEmpty = $derived(
    selectedStatusPromptCount === 0 && (isFinalMode || categoryTreeIds.length === 0)
  )

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

    return resolvePromptTreePromptMove(promptFolders, payload, dropPayload) !== null
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
    getPromptFolders: () => promptFolders
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
      contentKind,
      statusSection: dragStatusSection
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
        ...(row === 'category-details'
          ? {
              scrollType: 'vertical-bias' as const,
              verticalBiasPx: PROMPT_FOLDER_CATEGORY_TOP_OFFSET_PX
            }
          : {
              scrollType: 'vertical-bias' as const,
              verticalBiasPx: PROMPT_FOLDER_VERTICAL_BIAS_PX
            }),
        expandDetails: source !== 'category-open',
        expandContent: source === 'category-open'
      },
      treeExpansion: source === 'category-open' ? 'owner' : undefined
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

  /** Creates content at the start of a category and reveals its editor. */
  const handleCategoryAddToTop = async (categoryId: string): Promise<void> => {
    /** Root folder that owns both the category and its new content. */
    const rootFolder = screenRootFolder
    if (!rootFolder || isFinalMode || isCreatingCategoryContent) return

    isCreatingCategoryContent = true
    /** Optimistic creation and its matching persistence promise. */
    const creation =
      rootFolder.kind === 'template'
        ? createBlankPromptTemplateInFolder(rootFolder.id, null, categoryId)
        : createBlankPromptInFolder(rootFolder.id, null, categoryId)
    /** Stable ID generated for the new prompt or template. */
    const contentId = 'templateId' in creation ? creation.templateId : creation.promptId
    /** Navigation row that selects the new content. */
    const row = promptIdToPromptNavigationRow(contentId)

    onScreenModeSelect(screenMode)
    promptNavigation.select({
      screenRootFolderId: rootFolder.id,
      contentOwnerId: categoryId,
      row,
      source: 'prompt-tree-create',
      forceRequest: true,
      contentReveal: {
        scrollType: 'vertical-bias',
        verticalBiasPx: PROMPT_FOLDER_VERTICAL_BIAS_PX
      },
      focusPromptId: contentId,
      treeExpansion: 'owner'
    })

    /** Selected workspace whose category selection is persisted. */
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderSelectedEntryIdWithAutosave(
        workspaceId,
        rootFolder.id,
        categoryId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    if (!isPromptFoldersScreenActive) {
      onScreenRootFolderSelect(rootFolder.id)
    }

    await runIpcBestEffort(() => creation.persistence)
    isCreatingCategoryContent = false
  }

  /** Opens this empty tree's status view while retaining the root folder selection. */
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
      if (isFinalMode) {
        for (const [promptIndex, finalizedPrompt] of selectedFinalizedPrompts.entries()) {
          const ownerFolder = promptFolderById[finalizedPrompt.contentOwnerId]
          if (!ownerFolder) continue
          items.push({
            id: contentPromptRowId(ownerFolder.id, finalizedPrompt.promptId),
            row: {
              kind: 'prompt',
              folder: ownerFolder,
              categoryId: null,
              promptId: finalizedPrompt.promptId,
              indentCount: 0,
              isLastRow: promptIndex === selectedFinalizedPrompts.length - 1,
              isFirstTreeRow: promptIndex === 0
            }
          })
        }
      } else {
        /** Loaded active entries projected in FolderOrder group order. */
        const groups = getMarkdownContentCategoryOrder(screenRootFolder).categories
        /** Uncategorized content shown without a category header. */
        const uncategorizedEntries = groups[0]?.entries.filter((entry) =>
          entry.kind === 'template'
            ? Boolean(templateById[entry.id])
            : Boolean(promptById[entry.id]) &&
              !isFinalPromptStatus(promptById[entry.id]!.status)
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
                !isFinalPromptStatus(promptById[entry.id]!.status)
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

        if (
          screenRootFolder.kind === 'template' &&
          uncategorizedEntries.length === 0 &&
          groups.length === 1
        ) {
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
    {#if screenRootFolder?.kind === 'prompt' && isSelectedStatusTreeEmpty}
      <PromptDropTarget
        getOptions={() =>
          getPromptTreePromptDroppableOptions('empty-status', 'top', () => ({
            folderId: screenRootFolder!.id,
            categoryId: null,
            targetEntryId: null,
            position: 'after',
            statusSection: dragStatusSection
          }))}
        class="relative"
      >
        {#snippet children({ isOver, isBlocked, edge })}
          <button
            type="button"
            class="sidebarPromptTreeEmptyStatus"
            data-testid={`prompt-tree-${screenMode}-empty-status`}
            onclick={handleEmptyStatusSelect}
          >
            <span class="sidebarPromptTreeEmptyStatusLabel">
              No {finalModeDefinition?.label.toLowerCase() ?? 'active'} prompts. Click to view.
            </span>
          </button>
          {#if isOver && edge}
            <DropIndicator
              testId={`prompt-tree-${screenMode}-empty-drop-indicator`}
              insetStart={getPromptTreeDropIndicatorInset(0)}
              {edge}
              {isBlocked}
            />
          {/if}
        {/snippet}
      </PromptDropTarget>
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
      contentLabel={screenRootFolder?.kind === 'template' ? 'Template' : 'Prompt'}
      isAddToTopDisabled={isCreatingCategoryContent}
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
      onCategoryAddToTop={isFinalMode ? undefined : handleCategoryAddToTop}
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
      getPromptDroppableOptions={() =>
        getPromptTreePromptDroppableOptions(
          props.rowId,
          props.row.isFirstTreeRow ? 'top-and-bottom' : 'bottom',
          (edge) => ({
            folderId: props.row.folder.id,
            categoryId: props.row.categoryId,
            targetEntryId: props.row.promptId,
            position: edge === 'top' ? 'before' : 'after',
            statusSection: dragStatusSection
          })
        )}
      promptDragOptions={getPromptRowDragOptions(
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
  <PromptDropTarget
    getOptions={() =>
      getPromptTreePromptDroppableOptions('empty-state', 'top', () => ({
        folderId: screenRootFolder!.id,
        categoryId: null,
        targetEntryId: null,
        position: 'after',
        statusSection: dragStatusSection
      }))}
    class="relative h-full"
  >
    {#snippet children({ isOver, isBlocked, edge })}
      <div
        class="sidebarPromptTreeEmptyState px-2 py-2 text-center"
        data-testid="prompt-tree-empty-state"
      >
        <p class="sidebarPromptTreeEmptyTitle">No templates found in this folder.</p>
        <p class="mt-2">Click the Add Template button to create your first template.</p>
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
  {#if isFinalMode}
    <PromptDropTarget
      getOptions={() =>
        getPromptTreePromptDroppableOptions('bottom-spacer', 'top', () => ({
          folderId: screenRootFolder!.id,
          categoryId: null,
          targetEntryId: null,
          position: 'after',
          statusSection: dragStatusSection
        }))}
      class="relative h-full"
      style={`height:${props.rowHeightPx}px;`}
    />
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
  {@const edge = isFinalMode
    ? getPromptTreeDropTargetEdge(rowId)
    : getPromptTreeCategoryDropTargetEdge(rowId)}

  {#if edge}
    <DropIndicator
      testId={promptTreeBottomSpacerDropIndicatorTestId}
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

<style>
  .sidebarPromptTreeEmptyStatus {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-muted-text);
    cursor: pointer;
    display: flex;
    font-size: 12px;
    height: 32px;
    padding: 0 16px;
    text-align: left;
    width: 100%;
  }

  .sidebarPromptTreeEmptyStatusLabel {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebarPromptTreeEmptyStatus:hover,
  .sidebarPromptTreeEmptyStatus:focus-visible {
    color: var(--ui-normal-text);
  }
</style>
