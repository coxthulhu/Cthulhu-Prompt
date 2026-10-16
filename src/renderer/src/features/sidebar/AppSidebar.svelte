<script lang="ts">
  import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
  import { getPromptStatusFolderDefinition } from '@shared/domain/prompt/Prompt'
  import { onMount } from 'svelte'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteMap } from 'svelte/reactivity'
  import type {
    DraggableOptions,
    DroppableOptions
  } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { createDroppableStateRegistry } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import {
    PROMPT_COLLECTION_SELECTOR_DRAG_TYPE,
    type PromptCollectionDragPayload
  } from '@renderer/features/prompt-drag-drop/promptCollectionDrag'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload,
  } from '@renderer/features/prompt-drag-drop/promptHandleDrag'
  import type { ScreenId } from '@renderer/app/screens'
  import { isPromptCollectionScreen } from '@shared/domain/user-persistence/UserPersistence'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    ArrowUpToLine,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    FolderCog,
    Layers,
    MoreHorizontal,
    Plus,
    Trash2
  } from 'lucide-svelte'
  import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
  import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
  import { promptsCollection } from '@renderer/data/Collections/PromptsCollection'
  import { promptTemplatesCollection } from '@renderer/data/Collections/PromptTemplatesCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { movePromptCollection } from '@renderer/data/Mutations/WorkspaceMutations'
  import {
    PROMPT_STATUS_ACCORDION_PERSISTENCE_ID
  } from '@renderer/data/UiState/autosave/WorkspaceUiStateAutosave.svelte.ts'
  import { PROMPT_COLLECTION_VERTICAL_BIAS_PX } from '../prompt-collections/promptCollectionScrollOffsets'
  import {
    PROMPT_STATUS_FOLDER_REGISTRY,
    PromptStatusFolderId,
    type Prompt
  } from '@shared/domain/prompt/Prompt'
  import type { PromptTemplate } from '@shared/domain/prompt-template/PromptTemplate'
  import {
    type PromptCollection,
    type PromptCollectionKind
  } from '@shared/domain/prompt-collection/PromptCollection'
  import {
    getMarkdownContentCategoryOrder,
    getOrderedMarkdownContentIds
  } from '@shared/domain/markdown-content/MarkdownContent'
  import type { Category } from '@shared/domain/category/Category'
  import { getAllWorkspaceCollectionEntries, type Workspace } from '@shared/domain/workspace/Workspace'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupDetailed.svelte'
  import DropdownPopupSimple, {
    type DropdownPopupItem
  } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupSimple.svelte'
  import SelectorButton from '@renderer/common/cthulhu-ui/selectors/SelectorButton.svelte'
  import DetailedSelectorButton from '@renderer/common/cthulhu-ui/selectors/DetailedSelectorButton.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import { createConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import Accordion from '@renderer/features/sidebar/accordion/Accordion.svelte'
  import AccordionSection from '@renderer/features/sidebar/accordion/AccordionSection.svelte'
  import { promptEntryDragState } from '@renderer/features/prompt-drag-drop/promptEntryDragState.svelte.ts'
  import { resolvePromptTreePromptMove } from '@renderer/features/prompt-tree/promptTreeDrag'
  import { getPromptStatusGroupCounts, promptStatusGroups, sidebarPromptStatusGroups } from '../prompt-collections/promptStatusGroups'
  import { formatPromptModifiedRelative } from '@renderer/features/prompt-editor/promptModifiedTime'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { PromptCollectionScreenMode } from '@renderer/features/prompt-collections/promptCollectionScreenMode'
  import { saveCategories } from '@renderer/data/Mutations/CategoryMutations'
  import CreatePromptCollectionDialog from '../prompt-collections/CreatePromptCollectionDialog.svelte'
  import ManageCategoriesDialog, {
    type ManagedCategoryInput,
    type ManageCategoriesDialogOpenOptions
  } from '../prompt-collections/ManageCategoriesDialog.svelte'
  import PromptTree from '@renderer/features/prompt-tree/PromptTree.svelte'

  type CreatePromptCollectionDialogHandle = {
    openDialog: () => void
  }

  type ManageCategoriesDialogHandle = {
    /** Opens category management with an optional category-specific target. */
    openDialog: (options?: ManageCategoriesDialogOpenOptions) => void
  }

  type PromptTreeBulkExpansionRequest = {
    /** Category workflow that owns this toolbar request. */
    statusFolderId: PromptStatusFolderId
    screenCollectionId: string
    isExpanded: boolean
  }

  let {
    activeScreen,
    isWorkspaceReady = false,
    isWorkspaceLoading = false,
    screenCollectionId = null,
    promptCollectionScreenMode = PromptCollectionScreenMode.Active,
    shownFinalStatusGroups = {},
    collectionKind = 'prompt',
    onPromptCollectionModeChange,
    onFinalStatusGroupShownChange,
    onScreenCollectionSelect,
    onDeleteSelectedPromptCollection
  } = $props<{
    activeScreen: ScreenId
    isWorkspaceReady?: boolean
    isWorkspaceLoading?: boolean
    screenCollectionId?: string | null
    promptCollectionScreenMode?: PromptCollectionScreenMode
    /** Visibility for each toggleable finalized group. */
    shownFinalStatusGroups?: Partial<Record<PromptStatusFolderId, boolean>>
    /** collection kind displayed by this sidebar instance. */
    collectionKind?: PromptCollectionKind
    onPromptCollectionModeChange: (nextMode: PromptCollectionScreenMode) => void
    /** Updates one finalized group's visibility. */
    onFinalStatusGroupShownChange: (groupId: PromptStatusFolderId, isShown: boolean) => void
    onScreenCollectionSelect: (screenCollectionId: string) => void
    onDeleteSelectedPromptCollection: (screenCollectionId: string) => void
  }>()

  const workspaceSelection = getWorkspaceSelectionContext()
  const promptNavigation = getPromptNavigationContext()
  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
  }
  const promptCollectionQuery = useLiveQuery((q) =>
    q.from({ promptCollection: promptCollectionsCollection })
  ) as { data: PromptCollection[] }
  const categoryQuery = useLiveQuery(categoryCollection) as { data: Category[] }
  const promptQuery = useLiveQuery(promptsCollection) as { data: Prompt[] }
  const promptTemplateQuery = useLiveQuery(promptTemplatesCollection) as {
    data: PromptTemplate[]
  }

  const selectedWorkspace = $derived.by(() => {
    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId

    for (const workspace of workspaceQuery.data) {
      if (workspace?.id === selectedWorkspaceId) {
        return workspace
      }
    }

    return null
  })

  /** Every workspace collection resolved in task-then-template order. */
  const workspacePromptCollections = $derived.by((): PromptCollection[] => {
    if (!selectedWorkspace) {
      return []
    }

    const promptCollectionById = new SvelteMap<string, PromptCollection>()
    for (const promptCollection of promptCollectionQuery.data) {
      if (!promptCollection) {
        continue
      }

      promptCollectionById.set(promptCollection.id, promptCollection)
    }

    return getAllWorkspaceCollectionEntries(selectedWorkspace)
      .map((entry) => promptCollectionById.get(entry.id))
      .filter((promptCollection): promptCollection is PromptCollection => promptCollection !== undefined)
  })
  /** Collections eligible for the current activity's selector and tree. */
  const promptCollections = $derived(
    workspacePromptCollections.filter((collection) => collection.kind === collectionKind)
  )
  const collectionListState = $derived<'no-workspace' | 'loading' | 'empty' | 'ready'>(
    isWorkspaceLoading
      ? 'loading'
      : !isWorkspaceReady
        ? 'no-workspace'
        : promptCollections.length === 0
          ? 'empty'
          : 'ready'
  )

  /** Empty selector item specialized to the active collection kind. */
  const promptCollectionSelectorPlaceholder = $derived<DropdownPopupDetailedItem>({
    id: 'no-prompt-collections',
    label: 'No collections',
    detail: 'Create one from the menu',
    icon: collectionKind === 'template' ? Layers : FileText
  })
  /** Collection-creation action specialized to the active collection kind. */
  const promptCollectionSelectorFooterItem = $derived<DropdownPopupDetailedItem>({
    id: 'add-prompt-collection',
    label: 'Create Collection',
    detail:
      collectionKind === 'template'
        ? 'Create a prompt template collection'
        : 'Create a task prompt collection',
    icon: Plus,
    testId: 'sidebar-prompt-collection-dropdown-add-item'
  })
  let draggedPromptCollectionSelectorId = $state<string | null>(null)
  // Local preview order lets the dropdown reorder live without persisting until drop.
  let promptCollectionSelectorDragSourceIds = $state<string[] | null>(null)
  let promptCollectionSelectorPreviewIds = $state<string[] | null>(null)
  let promptCollectionSelectorItemsElement = $state<HTMLElement | null>(null)
  let createPromptCollectionDialog = $state<CreatePromptCollectionDialogHandle | null>(null)
  let manageCategoriesDialog = $state<ManageCategoriesDialogHandle | null>(null)
  let nowMs = $state(Date.now())

  // Side effect: keep collection-selector relative modified labels fresh while the app is open.
  onMount(() => {
    const intervalId = window.setInterval(() => {
      nowMs = Date.now()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  })

  const formatPromptCollectionModifiedRelative = (modifiedAt: string): string => {
    const relativeTime = formatPromptModifiedRelative(modifiedAt, nowMs)
    return `${relativeTime[0]!.toUpperCase()}${relativeTime.slice(1)}`
  }

  const promptCollectionDropdownCollections = $derived.by((): PromptCollection[] => {
    if (!promptCollectionSelectorPreviewIds) {
      return promptCollections
    }

    const promptCollectionById = new SvelteMap<string, PromptCollection>()
    for (const promptCollection of promptCollections) {
      promptCollectionById.set(promptCollection.id, promptCollection)
    }

    return promptCollectionSelectorPreviewIds
      .map((promptCollectionId) => promptCollectionById.get(promptCollectionId))
      .filter((promptCollection): promptCollection is PromptCollection => promptCollection !== undefined)
  })
  const promptCollectionDropdownItems = $derived.by((): DropdownPopupDetailedItem[] => {
    const promptById = new Map(promptQuery.data.map((prompt) => [prompt.id, prompt]))
    const templateById = new Map(
      promptTemplateQuery.data.map((template) => [template.id, template])
    )

    const getCollectionMetadata = (
      promptCollection: PromptCollection
    ): { promptCount: number; newestModifiedAt: string | null } => {
      let promptCount = 0
      let newestModifiedAt: string | null = null

      for (const entryId of (promptCollection.kind === 'template'
        ? getOrderedMarkdownContentIds(promptCollection, 'template')
        : Object.values(promptCollection.statusFolders).flatMap((layout) => layout.ordering === 'category'
          ? layout.categoryOrder.categories.flatMap((group) => group.entries.map((entry) => entry.id))
          : []))) {

        promptCount += 1
        const modifiedAt =
          promptCollection.kind === 'template'
            ? templateById.get(entryId)?.modifiedAt
            : promptById.get(entryId)?.modifiedAt
        if (!modifiedAt) continue
        if (!newestModifiedAt || modifiedAt > newestModifiedAt) newestModifiedAt = modifiedAt
      }

      return { promptCount, newestModifiedAt }
    }

    return promptCollectionDropdownCollections.map((promptCollection) => {
      const { promptCount, newestModifiedAt } = getCollectionMetadata(promptCollection)
      const detailParts: DropdownPopupDetailedItem['detailParts'] = [
        `${promptCount} ${promptCollection.kind === 'template' ? 'template' : 'prompt'}${promptCount === 1 ? '' : 's'}`
      ]

      if (newestModifiedAt) {
        detailParts.push({
          text: formatPromptCollectionModifiedRelative(newestModifiedAt),
          testId: 'sidebar-prompt-collection-modified-time'
        })
      }

      return {
        id: promptCollection.id,
        label: promptCollection.displayName,
        detailParts,
        icon: promptCollection.kind === 'template' ? Layers : FileText,
        testId: `sidebar-prompt-collection-dropdown-item-${promptCollection.id}`
      }
    })
  })
  const screenCollectionDropdownItem = $derived.by((): DropdownPopupDetailedItem => {
    if (promptCollectionDropdownItems.length === 0) {
      return promptCollectionSelectorPlaceholder
    }

    return (
      promptCollectionDropdownItems.find((item) => item.id === screenCollectionId) ??
      promptCollectionDropdownItems[0]!
    )
  })
  const screenCollection = $derived.by((): PromptCollection | null => {
    if (promptCollections.length === 0) {
      return null
    }

    return (
      promptCollections.find((promptCollection) => promptCollection.id === screenCollectionId) ??
      promptCollections[0]!
    )
  })
  /** Categories owned by the selected collection, preserved in Active status-folder order. */
  const selectedCollectionCategories = $derived.by((): Category[] => {
    if (!screenCollection) return []

    const categoryById = new Map(categoryQuery.data.map((category) => [category.id, category]))
    return getMarkdownContentCategoryOrder(
      screenCollection,
      PromptStatusFolderId.Active
    ).categories.flatMap(({ categoryId }) => {
      if (categoryId === null) return []
      const category = categoryById.get(categoryId)
      return category ? [category] : []
    })
  })
  const promptCollectionSelectorState = $derived(
    isWorkspaceReady && !isWorkspaceLoading ? 'enabled' : 'disabled'
  )
  const canToggleCategories = $derived(
    collectionListState === 'ready' &&
      screenCollection !== null
  )
  /** Category toolbar acts on the selected workflow, or the default while viewing final prompts. */
  const categoryToolbarGroupId = $derived(
    PROMPT_STATUS_FOLDER_REGISTRY[promptCollectionScreenMode].ordering === 'category'
      ? promptCollectionScreenMode
      : PromptCollectionScreenMode.Active
  )
  const promptTreeExpansionRequests =
    createConsumableRequestCoordinator<PromptTreeBulkExpansionRequest>()
  let areAllCategoriesCollapsed = $state(false)
  const promptCollectionSelectorPromptDroppableState = createDroppableStateRegistry<string>()
  const promptCollectionSelectorDragOpenTypes = [
    PROMPT_COLLECTION_SELECTOR_DRAG_TYPE,
    PROMPT_HANDLE_DRAG_TYPE
  ]
  /** Icon for expanding or collapsing every category in the active collection. */
  const categoryExpansionActionIcon = $derived(
    areAllCategoriesCollapsed ? ChevronsUpDown : ChevronsDownUp
  )
  /** Accessible label for the category expansion action. */
  const categoryExpansionActionLabel = $derived(
    areAllCategoriesCollapsed
      ? 'Expand All Categories'
      : 'Collapse All Categories'
  )
  const isTemplateCollection = $derived(screenCollection?.kind === 'template')
  /** Exact group counts shown in the accordion headers. */
  const selectedPromptStatusCounts = $derived(getPromptStatusGroupCounts(screenCollection, isTemplateCollection ? promptTemplateQuery.data.map((template) => ({ ...template, status: template.status ?? PromptTemplateStatus.Active })) : promptQuery.data))
  /** Category workflows are always present; finalized groups follow their toggles. */
  const visibleStatusGroups = $derived(
    sidebarPromptStatusGroups.filter((group) =>
      (!isTemplateCollection || group.id === 'active' || group.id === 'archived') && (group.ordering === 'category' || shownFinalStatusGroups[group.id])
    )
  )
  // Keep selected-collection overflow actions together as the toolbar gets tighter.
  const selectedPromptCollectionActionsItems = $derived.by((): DropdownPopupItem[] => [
    {
      id: 'delete-collection',
      label: 'Delete Collection',
      icon: Trash2,
      testId: 'delete-selected-prompt-collection-menu-item',
      variant: 'danger'
    }
  ])

  /** Toggles this collection's finalized section through the shared navigation handler. */
  const toggleFinalStatusGroup = (groupId: PromptStatusFolderId): void => {
    /** Visibility requested by this toolbar click. */
    const isShown = !shownFinalStatusGroups[groupId]
    onFinalStatusGroupShownChange(groupId, isShown)
  }

  /** Expands or collapses every category under the selected collection. */
  const handleCategoryExpansionAction = () => {
    const selectedCollectionId = screenCollection?.id
    if (!selectedCollectionId) return

    if (areAllCategoriesCollapsed) {
      promptTreeExpansionRequests.request({
        screenCollectionId: selectedCollectionId,
        statusFolderId: categoryToolbarGroupId,
        isExpanded: true
      })
      return
    }

    promptTreeExpansionRequests.request({
      screenCollectionId: selectedCollectionId,
      statusFolderId: categoryToolbarGroupId,
      isExpanded: false
    })
  }

  const handleSelectedPromptCollectionActionsSelect = (item: DropdownPopupItem) => {
    if (item.id === 'delete-collection' && screenCollection) {
      onDeleteSelectedPromptCollection(screenCollection.id)
    }
  }

  // Selects and reveals the collection overview formerly represented by the first tree row.
  const selectCollectionOverview = () => {
    // The selected collection owns both the toolbar state and the overview navigation target.
    const collectionId = screenCollection?.id
    if (!collectionId) return

    promptNavigation.select({
      screenCollectionId: collectionId,
      contentOwnerId: collectionId,
      row: 'collection-header',
      source: 'tree-click',
      forceRequest: true,
      contentReveal: {
        scrollType: 'vertical-bias',
        verticalBiasPx: PROMPT_COLLECTION_VERTICAL_BIAS_PX
      }
    })

    if (!isPromptCollectionScreen(activeScreen)) {
      onScreenCollectionSelect(collectionId)
    }
  }

  /** Opens category management for the currently selected collection. */
  const openManageCategoriesDialog = (): void => {
    manageCategoriesDialog?.openDialog()
  }

  /** Opens category management to one category selected from the prompt tree. */
  const openManageCategoryDialog = (categoryId: string): void => {
    manageCategoriesDialog?.openDialog({ categoryId })
  }

  /** Persists every retained category draft through one atomic mutation. */
  const handleSaveCategories = async (
    categories: ManagedCategoryInput[]
  ): Promise<boolean> => {
    const promptCollection = screenCollection
    const workspaceId = selectedWorkspace?.id
    if (!promptCollection || !workspaceId) return false

    return await runIpcBestEffort(
      async () => {
        await saveCategories(
          workspaceId,
          promptCollection.id,
          categories
        )
        return true
      },
      () => false
    )
  }

  const openCreatePromptCollectionDialog = () => {
    createPromptCollectionDialog?.openDialog()
  }

  const handlePromptCollectionDropdownSelect = (item: DropdownPopupDetailedItem) => {
    if (item.id === promptCollectionSelectorFooterItem.id) {
      openCreatePromptCollectionDialog()
      return
    }

    if (promptCollections.some((promptCollection) => promptCollection.id === item.id)) {
      onScreenCollectionSelect(item.id)
    }
  }

  const arePromptCollectionIdOrdersEqual = (left: string[], right: string[]): boolean => {
    return (
      left.length === right.length && left.every((collectionId, index) => collectionId === right[index])
    )
  }

  const reorderPromptCollectionIds = (
    collectionIds: string[],
    draggedCollectionId: string,
    targetIndex: number
  ): string[] => {
    const nextCollectionIds = collectionIds.filter((collectionId) => collectionId !== draggedCollectionId)
    if (nextCollectionIds.length === collectionIds.length) {
      return collectionIds
    }

    nextCollectionIds.splice(Math.min(targetIndex, nextCollectionIds.length), 0, draggedCollectionId)
    return nextCollectionIds
  }

  const getPromptCollectionPreviousEntryId = (collectionIds: string[], collectionId: string): string | null => {
    const collectionIndex = collectionIds.indexOf(collectionId)
    return collectionIndex <= 0 ? null : collectionIds[collectionIndex - 1]!
  }

  const isHoveringPromptCollectionSelectorFooter = (clientX: number, clientY: number): boolean => {
    const footerSelector = '[data-testid="sidebar-prompt-collection-dropdown-add-item"]'

    return document
      .elementsFromPoint(clientX, clientY)
      .some((element) => element instanceof Element && element.closest(footerSelector) !== null)
  }

  const resetPromptCollectionSelectorPreview = (): void => {
    const sourceIds = promptCollectionSelectorDragSourceIds
    const previewIds = promptCollectionSelectorPreviewIds
    if (sourceIds && previewIds && !arePromptCollectionIdOrdersEqual(sourceIds, previewIds)) {
      promptCollectionSelectorPreviewIds = sourceIds
    }
  }

  const getPromptCollectionSelectorTargetIndex = (
    clientY: number,
    itemCount: number
  ): number | null => {
    const itemsElement = promptCollectionSelectorItemsElement
    if (!itemsElement || itemCount === 0) {
      return null
    }

    const rect = itemsElement.getBoundingClientRect()
    const contentY = clientY - rect.top + itemsElement.scrollTop
    const rowPitch = itemsElement.scrollHeight / itemCount
    const rawIndex = Math.round(contentY / rowPitch - 0.5)

    return Math.max(0, Math.min(rawIndex, itemCount - 1))
  }

  const previewPromptCollectionSelectorReorder = (
    draggedCollectionId: string,
    clientX: number,
    clientY: number
  ): void => {
    if (isHoveringPromptCollectionSelectorFooter(clientX, clientY)) {
      resetPromptCollectionSelectorPreview()
      return
    }

    const currentPreviewIds =
      promptCollectionSelectorPreviewIds ?? promptCollections.map((promptCollection) => promptCollection.id)
    const targetIndex = getPromptCollectionSelectorTargetIndex(clientY, currentPreviewIds.length)
    if (targetIndex === null) {
      return
    }

    const nextPreviewIds = reorderPromptCollectionIds(currentPreviewIds, draggedCollectionId, targetIndex)

    if (!arePromptCollectionIdOrdersEqual(currentPreviewIds, nextPreviewIds)) {
      promptCollectionSelectorPreviewIds = nextPreviewIds
    }
  }

  const persistPromptCollectionSelectorReorder = (draggedCollectionId: string): void => {
    const workspaceId = workspaceSelection.selectedWorkspaceId
    const sourceIds = promptCollectionSelectorDragSourceIds
    const previewIds = promptCollectionSelectorPreviewIds
    if (
      !workspaceId ||
      !sourceIds ||
      !previewIds ||
      arePromptCollectionIdOrdersEqual(sourceIds, previewIds)
    ) {
      return
    }

    const previousEntryId = getPromptCollectionPreviousEntryId(previewIds, draggedCollectionId)
    void runIpcBestEffort(async () => {
      await movePromptCollection(workspaceId, draggedCollectionId, previousEntryId)
    })
  }

  const getPromptCollectionSelectorDraggableOptions = (
    item: DropdownPopupDetailedItem
  ): DraggableOptions<unknown, unknown> => ({
    dragType: PROMPT_COLLECTION_SELECTOR_DRAG_TYPE,
    payload: {
      collectionId: item.id
    },
    onDragStart: (payload) => {
      const collectionIds = promptCollections.map((promptCollection) => promptCollection.id)
      const draggedCollectionId = (payload as PromptCollectionDragPayload).collectionId
      draggedPromptCollectionSelectorId = draggedCollectionId
      promptCollectionSelectorDragSourceIds = collectionIds
      promptCollectionSelectorPreviewIds = collectionIds
    },
    onDragMove: (payload, clientX, clientY) => {
      previewPromptCollectionSelectorReorder(
        (payload as PromptCollectionDragPayload).collectionId,
        clientX,
        clientY
      )
    },
    onDragFinish: (result) => {
      if (!result.cancelled) {
        persistPromptCollectionSelectorReorder((result.sourcePayload as PromptCollectionDragPayload).collectionId)
      }
      draggedPromptCollectionSelectorId = null
      promptCollectionSelectorDragSourceIds = null
      promptCollectionSelectorPreviewIds = null
    }
  })

  /** Independent hover and rejection indicators for the workflow headers. */
  const statusHeaderDroppableState = createDroppableStateRegistry<PromptStatusFolderId>()

  /** Keeps a header transfer in the dragged prompt's retained category. */
  const getStatusHeaderDropPayload = (statusSection: PromptStatusFolderId): PromptHandleDropPayload => {
    /** Current prompt identity shared by editor and tree drag sources. */
    const draggedEntry = promptEntryDragState.draggedEntry
    return {
      collectionId: screenCollectionId,
      categoryId: draggedEntry?.kind === 'content'
        ? promptsCollection.get(draggedEntry.contentId)?.category ?? null
        : null,
      targetEntryId: null,
      position: 'before',
      statusSection
    }
  }

  /** Accepts cross-section prompt transfers only while the pointer is inside the header. */
  const getStatusHeaderDroppableOptions = (statusSection: PromptStatusFolderId): DroppableOptions => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges: 'none',
    snapDimensions: { x: 0, y: 0 },
    payload: () => getStatusHeaderDropPayload(statusSection),
    canDrop: (payload) => {
      /** Typed prompt source supplied by the shared prompt drag type. */
      const source = payload as PromptHandleDragPayload
      return getPromptStatusFolderDefinition(source.location.status).id !== statusSection &&
        resolvePromptTreePromptMove(promptCollectionQuery.data, source, getStatusHeaderDropPayload(statusSection)) !== null
    },
    indicator: statusHeaderDroppableState.getState(statusSection)
  })

  const getPromptCollectionSelectorPromptDroppableOptions = (
    item: DropdownPopupDetailedItem
  ): DroppableOptions<unknown, unknown> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges: 'none',
    // Collection selection requires the pointer to remain within the visible dropdown row.
    snapDimensions: { x: 0, y: 0 },
    payload: (): PromptHandleDropPayload => ({
      collectionId: item.id,
      targetEntryId: null,
      position: 'after',
      statusSection: promptEntryDragState.draggedEntry?.kind === 'content'
        ? getPromptStatusFolderDefinition(promptEntryDragState.draggedEntry.location.status).id
        : PromptCollectionScreenMode.Active
    }),
    canDrop: (payload) => {
      const entryPayload = payload as PromptHandleDragPayload
      if (getPromptStatusFolderDefinition(entryPayload.location.status).ordering !== 'category') return false
      const allCollections = promptCollectionQuery.data
      const destinationCollection = allCollections.find((collection) => collection.id === item.id)
      if (!destinationCollection) return false
      const dropPayload: PromptHandleDropPayload = {
        collectionId: item.id,
        targetEntryId: null,
        position: 'after',
        statusSection: getPromptStatusFolderDefinition(entryPayload.location.status).id
      }
      const sourceCollection = allCollections.find(
        (collection) => collection.id === entryPayload.location.promptCollectionId
      )
      if (!sourceCollection) return false
      // The dropdown would move a same-collection prompt to the top, but that route is too confusing.
      if (sourceCollection.id === destinationCollection.id) return false
      return (
        resolvePromptTreePromptMove(allCollections, entryPayload, dropPayload) !== null
      )
    },
    indicator: promptCollectionSelectorPromptDroppableState.getState(item.id)
  })

  const promptCollectionSelectorItemDragOptions = {
    getDraggableOptions: getPromptCollectionSelectorDraggableOptions,
    getRowDroppableOptions: getPromptCollectionSelectorPromptDroppableOptions,
    getDragHandleTestId: (item: DropdownPopupDetailedItem) =>
      `sidebar-prompt-collection-dropdown-drag-handle-${item.id}`,
    isDragging: (item: DropdownPopupDetailedItem) => draggedPromptCollectionSelectorId === item.id,
    isDraggingAny: () => draggedPromptCollectionSelectorId !== null,
    onItemsElementChange: (element: HTMLElement | null) => {
      promptCollectionSelectorItemsElement = element
    }
  }
</script>

<aside
  data-testid="app-sidebar"
  class="appSidebar flex h-full w-full flex-col text-sidebar-foreground/80"
>
  {#if collectionListState !== 'no-workspace'}
    <div class="sidebarTopLevelInsetWithInnerPadding py-1">
      {#if collectionListState === 'empty'}
        <SelectorButton
          icon={promptCollectionSelectorFooterItem.icon}
          text={promptCollectionSelectorFooterItem.label}
          detail={promptCollectionSelectorFooterItem.detail}
          showChevron={false}
          state={promptCollectionSelectorState}
          testId="sidebar-prompt-collection-add-button"
          onclick={openCreatePromptCollectionDialog}
        />
      {:else}
        <DetailedSelectorButton
          label="Collection selector"
          items={promptCollectionDropdownItems}
          selectedItem={screenCollectionDropdownItem}
          footerItem={promptCollectionSelectorFooterItem}
          state={promptCollectionSelectorState}
          itemDragOptions={promptCollectionSelectorItemDragOptions}
          selectionVariant="accent"
          dragOpenTypes={promptCollectionSelectorDragOpenTypes}
          testId="sidebar-prompt-collection-selector-menu"
          triggerTestId="sidebar-prompt-collection-selector-trigger"
          onselect={handlePromptCollectionDropdownSelect}
        />
      {/if}
    </div>
    <Separator />
  {/if}

  <div class="cthulhuSidebarPromptSectionHeader">
    {#if isWorkspaceReady}
      <div class="cthulhuSidebarPromptSectionActions">
        <IconButton
          icon={ArrowUpToLine}
          label="Go to Top"
          title="Go to Top"
          borderless
          baseVariant="dim"
          disabled={!screenCollection}
          testId="sidebar-collection-overview-button"
          onclick={selectCollectionOverview}
        />
        {#if screenCollection}
          {#each promptStatusGroups.filter((group) => group.ordering === 'finalizedAt' && (!isTemplateCollection || group.id === 'archived')) as group (group.id)}
            <IconButton
              icon={group.toggleIcon}
              label={`Show ${group.label} ${isTemplateCollection ? 'Templates' : 'Prompts'}`}
              title={`Show ${group.label} ${isTemplateCollection ? 'Templates' : 'Prompts'}`}
              borderless
              baseVariant="dim"
              disabled={!screenCollection}
              active={shownFinalStatusGroups[group.id] ?? false}
              testId={`toggle-${group.id}-prompts-button`}
              onclick={() => toggleFinalStatusGroup(group.id)}
            />
          {/each}
        {/if}
        <IconButton
          icon={categoryExpansionActionIcon}
          label={categoryExpansionActionLabel}
          title={categoryExpansionActionLabel}
          borderless
          baseVariant="dim"
          disabled={!canToggleCategories}
          testId="toggle-all-categories-button"
          onclick={handleCategoryExpansionAction}
        />
        <IconButton
          icon={FolderCog}
          label="Manage Categories"
          title="Manage Categories"
          borderless
          baseVariant="dim"
          disabled={!screenCollection}
          testId="sidebar-manage-categories-button"
          onclick={openManageCategoriesDialog}
        />
        <DropdownPopupSimple
          label="Selected Collection Actions"
          items={selectedPromptCollectionActionsItems}
          menuWidth="204px"
          testId="selected-prompt-collection-actions-menu"
          onselect={handleSelectedPromptCollectionActionsSelect}
        >
          {#snippet trigger(dropdown)}
            <IconButton
              icon={MoreHorizontal}
              label="Selected Collection Actions"
              title="Selected Collection Actions"
              borderless
              baseVariant="dim"
              disabled={!screenCollection}
              active={dropdown.open}
              ariaHaspopup={dropdown.ariaHaspopup}
              ariaExpanded={dropdown.ariaExpanded}
              buttonAction={dropdown.triggerAction}
              onclick={dropdown.toggle}
              testId="selected-prompt-collection-actions-button"
            />
          {/snippet}
        </DropdownPopupSimple>
        <CreatePromptCollectionDialog
          bind:this={createPromptCollectionDialog}
          {isWorkspaceReady}
          promptCollections={promptCollections}
          kind={collectionKind}
          isPromptCollectionListLoading={isWorkspaceLoading}
          onCreated={(promptCollectionId) => {
            onScreenCollectionSelect(promptCollectionId)
          }}
        />
      </div>
    {/if}
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-visible">
    {#if !screenCollection}
      <PromptTree
        promptCollections={promptCollections}
        {collectionListState}
        {screenCollectionId}
        screenMode={PromptCollectionScreenMode.Active}
        expansionRequests={promptTreeExpansionRequests}
        isPromptCollectionsScreenActive={isPromptCollectionScreen(activeScreen)}
        onAllCategoriesCollapsedChange={(isCollapsed) => {
          areAllCategoriesCollapsed = isCollapsed
        }}
        onScreenModeSelect={onPromptCollectionModeChange}
        onManageCategory={openManageCategoryDialog}
        {onScreenCollectionSelect}
      />
    {:else}
      <!-- Recreate the owner so conditionally visible sections register in rendered order. -->
      {#key visibleStatusGroups.map((group) => group.id).join(':')}
        <Accordion
          persistenceId={PROMPT_STATUS_ACCORDION_PERSISTENCE_ID}
          testId="sidebar-prompt-status-accordion"
          class="sidebarPromptStatusAccordion flex-1"
        >
          {#each visibleStatusGroups as group (group.id)}
            <AccordionSection
              id={group.id}
              label={group.label}
              icon={group.icon}
              count={selectedPromptStatusCounts[group.id]}
              initialExpandedHeightPx={group.id === PromptStatusFolderId.Active ? 400 : 200}
              headerDroppableOptions={getStatusHeaderDroppableOptions(group.id)}
            >
              <PromptTree
                promptCollections={promptCollections}
                {collectionListState}
                {screenCollectionId}
                screenMode={group.id}
                expansionRequests={promptTreeExpansionRequests}
                isPromptCollectionsScreenActive={isPromptCollectionScreen(activeScreen) &&
                  promptCollectionScreenMode === group.id}
                onAllCategoriesCollapsedChange={(isCollapsed) => {
                  if (group.id === categoryToolbarGroupId) areAllCategoriesCollapsed = isCollapsed
                }}
                onScreenModeSelect={onPromptCollectionModeChange}
                onManageCategory={openManageCategoryDialog}
                {onScreenCollectionSelect}
              />
            </AccordionSection>
          {/each}
        </Accordion>
      {/key}
    {/if}
  </div>
</aside>

<ManageCategoriesDialog
  bind:this={manageCategoriesDialog}
  categories={selectedCollectionCategories}
  collectionDisplayName={screenCollection?.displayName ?? ''}
  contentKind={screenCollection?.kind ?? 'prompt'}
  isWorkspaceReady={screenCollection !== null}
  onsubmit={handleSaveCategories}
/>

<style>
  .cthulhuSidebarPromptSectionHeader {
    display: flex;
    min-height: 40px;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }

  .cthulhuSidebarPromptSectionActions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
  }

  /* Allow tree-edge drop indicators to overlap adjacent status headers slightly. */
  .appSidebar :global(.sidebarPromptStatusAccordion.cthulhuUiAccordion),
  .appSidebar :global(.sidebarPromptStatusAccordion .cthulhuUiAccordionSection),
  .appSidebar :global(.sidebarPromptStatusAccordion .cthulhuUiAccordionContent) {
    overflow: visible;
  }

  .appSidebar :global(.sidebarPromptStatusAccordion .cthulhuUiAccordionContent) {
    position: relative;
    z-index: var(--z-chrome);
  }

</style>
