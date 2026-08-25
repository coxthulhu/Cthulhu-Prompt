<script lang="ts">
  import { onMount } from 'svelte'
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteMap } from 'svelte/reactivity'
  import type {
    DraggableOptions,
    DroppableOptions
  } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import { createDroppableStateRegistry } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import {
    PROMPT_FOLDER_SELECTOR_DRAG_TYPE,
    type PromptFolderDragPayload
  } from '@renderer/features/drag-drop/promptFolderDrag'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload,
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import { resolvePromptHandleDropMove } from '@renderer/features/drag-drop/promptHandleDrag'
  import type { ScreenId } from '@renderer/app/screens'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import {
    ArrowUpToLine,
    Check,
    CircleCheckBig,
    ChevronsDownUp,
    ChevronsUpDown,
    ExternalLink,
    Folder,
    FolderPlus,
    Layers,
    ListTodo,
    MoreHorizontal,
    Plus,
    Settings
  } from 'lucide-svelte'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
  import { promptCollection } from '@renderer/data/Collections/PromptCollection'
  import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { movePromptFolder } from '@renderer/data/Mutations/WorkspaceMutations'
  import { PromptStatus, type Prompt } from '@shared/Prompt'
  import type { PromptTemplate } from '@shared/PromptTemplate'
  import { getCategoryOrderCategoryIds, type PromptFolder } from '@shared/PromptFolder'
  import type { Category } from '@shared/Category'
  import type { Workspace } from '@shared/Workspace'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/DropdownPopupDetailed.svelte'
  import DropdownPopupSimple, {
    type DropdownPopupItem
  } from '@renderer/common/cthulhu-ui/DropdownPopupSimple.svelte'
  import SelectorButton from '@renderer/common/cthulhu-ui/SelectorButton.svelte'
  import DetailedSelectorButton from '@renderer/common/cthulhu-ui/DetailedSelectorButton.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import { createConsumableRequestCoordinator } from '@renderer/common/consumableRequestCoordinator.svelte.ts'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import Accordion from '@renderer/common/cthulhu-ui/Accordion.svelte'
  import AccordionSection from '@renderer/common/cthulhu-ui/AccordionSection.svelte'
  import { getWorkspaceFolderName } from '@renderer/features/workspace/workspaceDisplay'
  import { getPromptFolderActiveEntryIds } from '@renderer/data/Collections/PromptFolderEntries'
  import { formatPromptModifiedRelative } from '@renderer/features/prompt-editor/promptModifiedTime'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { PromptFolderScreenMode } from '@renderer/features/prompt-folders/promptFolderScreenMode'
  import { createCategory } from '@renderer/data/Mutations/CategoryMutations'
  import CreatePromptFolderDialog from '../prompt-folders/CreatePromptFolderDialog.svelte'
  import CreateCategoryDialog from '../prompt-folders/CreateCategoryDialog.svelte'
  import PromptTree from './PromptTree.svelte'

  type CreatePromptFolderDialogHandle = {
    openDialog: () => void
  }

  type CreateCategoryDialogHandle = {
    openDialog: () => void
  }

  type PromptTreeBulkExpansionRequest = {
    screenRootFolderId: string
    isExpanded: boolean
  }

  let {
    activeScreen,
    isWorkspaceReady = false,
    isWorkspaceLoading = false,
    workspacePath = null,
    screenRootFolderId = null,
    promptFolderScreenMode = PromptFolderScreenMode.Active,
    isCompletedPromptSectionShown = false,
    onPromptFolderModeChange,
    onCompletedPromptSectionShownChange,
    onScreenRootFolderSelect
  } = $props<{
    activeScreen: ScreenId
    isWorkspaceReady?: boolean
    isWorkspaceLoading?: boolean
    workspacePath?: string | null
    screenRootFolderId?: string | null
    promptFolderScreenMode?: PromptFolderScreenMode
    isCompletedPromptSectionShown?: boolean
    onPromptFolderModeChange: (nextMode: PromptFolderScreenMode) => void
    onCompletedPromptSectionShownChange: (isShown: boolean) => void
    onScreenRootFolderSelect: (screenRootFolderId: string) => void
  }>()

  /** Workspace-wide persistence key shared by every prompt folder's status accordion. */
  const PROMPT_STATUS_ACCORDION_PERSISTENCE_ID = 'sidebar-prompt-statuses'

  const workspaceSelection = getWorkspaceSelectionContext()
  const promptNavigation = getPromptNavigationContext()
  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
  }
  const promptFolderQuery = useLiveQuery((q) =>
    q.from({ promptFolder: promptFolderCollection })
  ) as { data: PromptFolder[] }
  const categoryQuery = useLiveQuery(categoryCollection) as { data: Category[] }
  const promptQuery = useLiveQuery(promptCollection) as { data: Prompt[] }
  const promptTemplateQuery = useLiveQuery(promptTemplateCollection) as {
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

  const rootPromptFolders = $derived.by((): PromptFolder[] => {
    if (!selectedWorkspace) {
      return []
    }

    const promptFolderById = new SvelteMap<string, PromptFolder>()
    for (const promptFolder of promptFolderQuery.data) {
      if (!promptFolder) {
        continue
      }

      promptFolderById.set(promptFolder.id, promptFolder)
    }

    return selectedWorkspace.entries
      .map((entry) => promptFolderById.get(entry.id))
      .filter((promptFolder): promptFolder is PromptFolder => promptFolder !== undefined)
  })
  const promptFolders = $derived(rootPromptFolders.filter((folder) => folder.kind !== 'template'))
  const promptTemplateFolders = $derived.by((): PromptFolder[] => {
    if (!selectedWorkspace) return []

    const promptFolderById = new SvelteMap<string, PromptFolder>()
    for (const promptFolder of promptFolderQuery.data) {
      if (promptFolder) promptFolderById.set(promptFolder.id, promptFolder)
    }

    return selectedWorkspace.entries
      .map((entry) => promptFolderById.get(entry.id))
      .filter(
        (promptFolder): promptFolder is PromptFolder => promptFolder?.kind === 'template'
      )
  })
  const folderListState = $derived<'no-workspace' | 'loading' | 'empty' | 'ready'>(
    isWorkspaceLoading
      ? 'loading'
      : !isWorkspaceReady
        ? 'no-workspace'
        : rootPromptFolders.length === 0
          ? 'empty'
          : 'ready'
  )

  const promptFolderSelectorPlaceholder: DropdownPopupDetailedItem = {
    id: 'no-prompt-folders',
    label: 'No folders',
    detail: 'Create one from the menu',
    icon: Folder
  }
  const promptFolderSelectorFooterItem: DropdownPopupDetailedItem = {
    id: 'add-prompt-folder',
    label: 'Create Folder',
    detail: 'Create a prompt or prompt template folder',
    icon: Plus,
    testId: 'sidebar-prompt-folder-dropdown-add-item'
  }
  let draggedPromptFolderSelectorId = $state<string | null>(null)
  // Local preview order lets the dropdown reorder live without persisting until drop.
  let promptFolderSelectorDragSourceIds = $state<string[] | null>(null)
  let promptFolderSelectorPreviewIds = $state<string[] | null>(null)
  let promptFolderSelectorItemsElement = $state<HTMLElement | null>(null)
  let createPromptFolderDialog = $state<CreatePromptFolderDialogHandle | null>(null)
  let createCategoryDialog = $state<CreateCategoryDialogHandle | null>(null)
  let nowMs = $state(Date.now())

  // Side effect: keep folder-selector relative modified labels fresh while the app is open.
  onMount(() => {
    const intervalId = window.setInterval(() => {
      nowMs = Date.now()
    }, 60_000)

    return () => window.clearInterval(intervalId)
  })

  const formatPromptFolderModifiedRelative = (modifiedAt: string): string => {
    const relativeTime = formatPromptModifiedRelative(modifiedAt, nowMs)
    return `${relativeTime[0]!.toUpperCase()}${relativeTime.slice(1)}`
  }

  const promptFolderDropdownFolders = $derived.by((): PromptFolder[] => {
    if (!promptFolderSelectorPreviewIds) {
      return rootPromptFolders
    }

    const promptFolderById = new SvelteMap<string, PromptFolder>()
    for (const promptFolder of rootPromptFolders) {
      promptFolderById.set(promptFolder.id, promptFolder)
    }

    return promptFolderSelectorPreviewIds
      .map((promptFolderId) => promptFolderById.get(promptFolderId))
      .filter((promptFolder): promptFolder is PromptFolder => promptFolder !== undefined)
  })
  const promptFolderDropdownItems = $derived.by((): DropdownPopupDetailedItem[] => {
    const promptById = new Map(promptQuery.data.map((prompt) => [prompt.id, prompt]))
    const templateById = new Map(
      promptTemplateQuery.data.map((template) => [template.id, template])
    )

    const getFolderMetadata = (
      promptFolder: PromptFolder
    ): { promptCount: number; newestModifiedAt: string | null } => {
      let promptCount = 0
      let newestModifiedAt: string | null = null

      for (const entry of promptFolder.categoryOrder.categories.flatMap((group) => group.entries)) {

        promptCount += 1
        const modifiedAt =
          promptFolder.kind === 'template'
            ? templateById.get(entry.id)?.modifiedAt
            : promptById.get(entry.id)?.modifiedAt
        if (!modifiedAt) continue
        if (!newestModifiedAt || modifiedAt > newestModifiedAt) newestModifiedAt = modifiedAt
      }

      return { promptCount, newestModifiedAt }
    }

    return promptFolderDropdownFolders.map((promptFolder) => {
      const { promptCount, newestModifiedAt } = getFolderMetadata(promptFolder)
      const detailParts: DropdownPopupDetailedItem['detailParts'] = [
        `${promptCount} ${promptFolder.kind === 'template' ? 'template' : 'prompt'}${promptCount === 1 ? '' : 's'}`
      ]

      if (newestModifiedAt) {
        detailParts.push({
          text: formatPromptFolderModifiedRelative(newestModifiedAt),
          testId: 'sidebar-prompt-folder-modified-time'
        })
      }

      return {
        id: promptFolder.id,
        label: promptFolder.displayName,
        detailParts,
        icon: promptFolder.kind === 'template' ? Layers : Folder,
        testId: `sidebar-prompt-folder-dropdown-item-${promptFolder.id}`
      }
    })
  })
  const screenRootFolderDropdownItem = $derived.by((): DropdownPopupDetailedItem => {
    if (promptFolderDropdownItems.length === 0) {
      return promptFolderSelectorPlaceholder
    }

    return (
      promptFolderDropdownItems.find((item) => item.id === screenRootFolderId) ??
      promptFolderDropdownItems[0]!
    )
  })
  const screenRootFolder = $derived.by((): PromptFolder | null => {
    if (rootPromptFolders.length === 0) {
      return null
    }

    return (
      rootPromptFolders.find((promptFolder) => promptFolder.id === screenRootFolderId) ??
      rootPromptFolders[0]!
    )
  })
  /** Categories owned by the selected root folder, preserved in folder order. */
  const selectedRootFolderCategories = $derived.by((): Category[] => {
    if (!screenRootFolder) return []

    const categoryById = new Map(categoryQuery.data.map((category) => [category.id, category]))
    return getCategoryOrderCategoryIds(screenRootFolder.categoryOrder).flatMap((categoryId) => {
      const category = categoryById.get(categoryId)
      return category ? [category] : []
    })
  })
  const promptFolderSelectorState = $derived(
    isWorkspaceReady && !isWorkspaceLoading ? 'enabled' : 'disabled'
  )
  const canToggleCategories = $derived(
    folderListState === 'ready' &&
      screenRootFolder !== null
  )
  const promptTreeExpansionRequests =
    createConsumableRequestCoordinator<PromptTreeBulkExpansionRequest>()
  let areAllCategoriesCollapsed = $state(false)
  const promptFolderSelectorPromptDroppableState = createDroppableStateRegistry<string>()
  const promptFolderSelectorDragOpenTypes = [
    PROMPT_FOLDER_SELECTOR_DRAG_TYPE,
    PROMPT_HANDLE_DRAG_TYPE
  ]
  /** Icon for expanding or collapsing every category in the active root folder. */
  const categoryExpansionActionIcon = $derived(
    areAllCategoriesCollapsed ? ChevronsUpDown : ChevronsDownUp
  )
  /** Accessible label for the category expansion action. */
  const categoryExpansionActionLabel = $derived(
    areAllCategoriesCollapsed
      ? 'Expand All Categories'
      : 'Collapse All Categories'
  )
  // Highlights the folder overview action only while its navigation target is active onscreen.
  const isFolderRootActive = $derived(
    activeScreen === 'prompt-folders' &&
      screenRootFolder !== null &&
      promptNavigation.screenRootFolderId === screenRootFolder.id &&
      promptNavigation.contentOwnerId === screenRootFolder.id &&
      promptNavigation.selectedRow === 'root-header'
  )
  const isTemplateFolder = $derived(screenRootFolder?.kind === 'template')
  /** Active and completed prompt totals displayed in the status accordion headers. */
  const selectedPromptStatusCounts = $derived.by(() => {
    if (!screenRootFolder || screenRootFolder.kind === 'template') {
      return { active: 0, completed: 0 }
    }

    /** Loaded prompt statuses indexed for entry counting. */
    const statusByPromptId = new Map(promptQuery.data.map((prompt) => [prompt.id, prompt.status]))
    /** Number of loaded non-completed prompts in active folder order. */
    let active = 0
    for (const group of screenRootFolder.categoryOrder.categories) {
      for (const entry of group.entries) {
        if (
          entry.kind === 'prompt' &&
          statusByPromptId.has(entry.id) &&
          statusByPromptId.get(entry.id) !== PromptStatus.Completed
        ) {
          active += 1
        }
      }
    }

    /** Number of loaded completed prompts owned by the selected root folder. */
    const completed = screenRootFolder.completedPromptIds.filter(
      (promptId) => statusByPromptId.get(promptId) === PromptStatus.Completed
    ).length
    return { active, completed }
  })
  const selectedFolderActionsLabel = $derived(
    isTemplateFolder ? 'Selected Prompt Template Folder Actions' : 'Selected Prompt Folder Actions'
  )
  // Keep selected-folder overflow actions together as the toolbar gets tighter.
  const selectedPromptFolderActionsItems: DropdownPopupItem[] = [
    {
      id: 'folder-settings',
      label: 'Open Folder Settings',
      icon: Settings,
      testId: 'open-selected-prompt-folder-settings-menu-item'
    }
  ]

  /** Expands or collapses every category under the selected root folder. */
  const handleCategoryExpansionAction = () => {
    const selectedRootFolderId = screenRootFolder?.id
    if (!selectedRootFolderId) return

    if (areAllCategoriesCollapsed) {
      promptTreeExpansionRequests.request({
        screenRootFolderId: selectedRootFolderId,
        isExpanded: true
      })
      return
    }

    promptTreeExpansionRequests.request({
      screenRootFolderId: selectedRootFolderId,
      isExpanded: false
    })
  }

  const openSelectedPromptFolderSettings = () => {
    // Root prompt folders no longer expose a settings destination.
  }

  const handleSelectedPromptFolderActionsSelect = (item: DropdownPopupItem) => {
    if (item.id === 'folder-settings') {
      openSelectedPromptFolderSettings()
    }
  }

  const openWorkspaceFolder = () => {
    const targetWorkspacePath = workspacePath
    if (!targetWorkspacePath) return

    // Hand off to the main process so Windows opens the folder in Explorer.
    void runIpcBestEffort(() =>
      ipcInvoke<void, string>('open-workspace-folder', targetWorkspacePath)
    )
  }

  /** Toggles whether the Completed status accordion section is rendered. */
  const toggleCompletedPromptSection = () => {
    onCompletedPromptSectionShownChange(!isCompletedPromptSectionShown)
  }

  // Selects and reveals the root folder overview formerly represented by the first tree row.
  const selectFolderRoot = () => {
    // The selected root owns both the toolbar state and the overview navigation target.
    const rootFolderId = screenRootFolder?.id
    if (!rootFolderId) return

    promptNavigation.select({
      screenRootFolderId: rootFolderId,
      contentOwnerId: rootFolderId,
      row: 'root-header',
      source: 'tree-click',
      forceRequest: true,
      contentReveal: { scrollType: 'center' }
    })

    if (activeScreen !== 'prompt-folders') {
      onScreenRootFolderSelect(rootFolderId)
    }
  }

  /** Opens category creation for the currently selected root folder. */
  const openCreateCategoryDialog = (): void => {
    createCategoryDialog?.openDialog()
  }

  /** Persists a validated category for the currently selected root folder. */
  const handleCreateCategory = async (displayName: string): Promise<boolean> => {
    const promptFolder = screenRootFolder
    if (!promptFolder) return false

    return await runIpcBestEffort(
      async () => {
        await createCategory(promptFolder.id, displayName)
        return true
      },
      () => false
    )
  }

  // Keep workspace header text aligned with the mockup's simple end-truncation style.
  const workspaceDisplay = $derived.by(() => {
    if (!workspacePath) {
      return {
        title: 'No Workspace Selected',
        path: 'Select a Workspace to Get Started'
      }
    }

    return {
      title: getWorkspaceFolderName(workspacePath),
      path: workspacePath
    }
  })

  const openCreatePromptFolderDialog = () => {
    createPromptFolderDialog?.openDialog()
  }

  const handlePromptFolderDropdownSelect = (item: DropdownPopupDetailedItem) => {
    if (item.id === promptFolderSelectorFooterItem.id) {
      openCreatePromptFolderDialog()
      return
    }

    if (rootPromptFolders.some((promptFolder) => promptFolder.id === item.id)) {
      onScreenRootFolderSelect(item.id)
    }
  }

  const arePromptFolderIdOrdersEqual = (left: string[], right: string[]): boolean => {
    return (
      left.length === right.length && left.every((folderId, index) => folderId === right[index])
    )
  }

  const reorderPromptFolderIds = (
    folderIds: string[],
    draggedFolderId: string,
    targetIndex: number
  ): string[] => {
    const nextFolderIds = folderIds.filter((folderId) => folderId !== draggedFolderId)
    if (nextFolderIds.length === folderIds.length) {
      return folderIds
    }

    nextFolderIds.splice(Math.min(targetIndex, nextFolderIds.length), 0, draggedFolderId)
    return nextFolderIds
  }

  const getPromptFolderPreviousEntryId = (folderIds: string[], folderId: string): string | null => {
    const folderIndex = folderIds.indexOf(folderId)
    return folderIndex <= 0 ? null : folderIds[folderIndex - 1]!
  }

  const isHoveringPromptFolderSelectorFooter = (clientX: number, clientY: number): boolean => {
    const footerSelector = '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'

    return document
      .elementsFromPoint(clientX, clientY)
      .some((element) => element instanceof Element && element.closest(footerSelector) !== null)
  }

  const resetPromptFolderSelectorPreview = (): void => {
    const sourceIds = promptFolderSelectorDragSourceIds
    const previewIds = promptFolderSelectorPreviewIds
    if (sourceIds && previewIds && !arePromptFolderIdOrdersEqual(sourceIds, previewIds)) {
      promptFolderSelectorPreviewIds = sourceIds
    }
  }

  const getPromptFolderSelectorTargetIndex = (
    clientY: number,
    itemCount: number
  ): number | null => {
    const itemsElement = promptFolderSelectorItemsElement
    if (!itemsElement || itemCount === 0) {
      return null
    }

    const rect = itemsElement.getBoundingClientRect()
    const contentY = clientY - rect.top + itemsElement.scrollTop
    const rowPitch = itemsElement.scrollHeight / itemCount
    const rawIndex = Math.round(contentY / rowPitch - 0.5)

    return Math.max(0, Math.min(rawIndex, itemCount - 1))
  }

  const previewPromptFolderSelectorReorder = (
    draggedFolderId: string,
    clientX: number,
    clientY: number
  ): void => {
    if (isHoveringPromptFolderSelectorFooter(clientX, clientY)) {
      resetPromptFolderSelectorPreview()
      return
    }

    const currentPreviewIds =
      promptFolderSelectorPreviewIds ?? rootPromptFolders.map((promptFolder) => promptFolder.id)
    const targetIndex = getPromptFolderSelectorTargetIndex(clientY, currentPreviewIds.length)
    if (targetIndex === null) {
      return
    }

    const nextPreviewIds = reorderPromptFolderIds(currentPreviewIds, draggedFolderId, targetIndex)

    if (!arePromptFolderIdOrdersEqual(currentPreviewIds, nextPreviewIds)) {
      promptFolderSelectorPreviewIds = nextPreviewIds
    }
  }

  const persistPromptFolderSelectorReorder = (draggedFolderId: string): void => {
    const workspaceId = workspaceSelection.selectedWorkspaceId
    const sourceIds = promptFolderSelectorDragSourceIds
    const previewIds = promptFolderSelectorPreviewIds
    if (
      !workspaceId ||
      !sourceIds ||
      !previewIds ||
      arePromptFolderIdOrdersEqual(sourceIds, previewIds)
    ) {
      return
    }

    const previousEntryId = getPromptFolderPreviousEntryId(previewIds, draggedFolderId)
    void runIpcBestEffort(async () => {
      await movePromptFolder(workspaceId, draggedFolderId, previousEntryId)
    })
  }

  const getPromptFolderSelectorDraggableOptions = (
    item: DropdownPopupDetailedItem
  ): DraggableOptions<unknown, unknown> => ({
    dragType: PROMPT_FOLDER_SELECTOR_DRAG_TYPE,
    payload: {
      folderId: item.id
    },
    onDragStart: (payload) => {
      const folderIds = rootPromptFolders.map((promptFolder) => promptFolder.id)
      const draggedFolderId = (payload as PromptFolderDragPayload).folderId
      draggedPromptFolderSelectorId = draggedFolderId
      promptFolderSelectorDragSourceIds = folderIds
      promptFolderSelectorPreviewIds = folderIds
    },
    onDragMove: (payload, clientX, clientY) => {
      previewPromptFolderSelectorReorder(
        (payload as PromptFolderDragPayload).folderId,
        clientX,
        clientY
      )
    },
    onDragFinish: (result) => {
      persistPromptFolderSelectorReorder((result.sourcePayload as PromptFolderDragPayload).folderId)
      draggedPromptFolderSelectorId = null
      promptFolderSelectorDragSourceIds = null
      promptFolderSelectorPreviewIds = null
    }
  })

  const getPromptFolderSelectorPromptDroppableOptions = (
    item: DropdownPopupDetailedItem
  ): DroppableOptions<unknown, unknown> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges: 'none',
    payload: (): PromptHandleDropPayload => ({
      folderId: item.id,
      targetEntryId: null,
      position: 'after'
    }),
    canDrop: (payload) => {
      const entryPayload = payload as PromptHandleDragPayload
      const allFolders = promptFolderQuery.data
      const destinationFolder = allFolders.find((folder) => folder.id === item.id)
      if (!destinationFolder) return false
      const dropPayload: PromptHandleDropPayload = {
        folderId: item.id,
        targetEntryId: null,
        position: 'after'
      }
      const sourceFolder = allFolders.find(
        (folder) => folder.id === entryPayload.sourceFolderId
      )
      if (!sourceFolder) return false
      // The dropdown would move a same-folder prompt to the top, but that route is too confusing.
      if (sourceFolder.id === destinationFolder.id) return false
      if (
        entryPayload.contentKind !== destinationFolder.kind ||
        sourceFolder.kind !== destinationFolder.kind
      ) {
        return false
      }
      return (
        resolvePromptHandleDropMove(
          sourceFolder.id,
          getPromptFolderActiveEntryIds(sourceFolder),
          entryPayload.fromId,
          dropPayload,
          getPromptFolderActiveEntryIds(destinationFolder)
        ) !== null
      )
    },
    indicator: promptFolderSelectorPromptDroppableState.getState(item.id)
  })

  const promptFolderSelectorItemDragOptions = {
    getDraggableOptions: getPromptFolderSelectorDraggableOptions,
    getRowDroppableOptions: getPromptFolderSelectorPromptDroppableOptions,
    getDragHandleTestId: (item: DropdownPopupDetailedItem) =>
      `sidebar-prompt-folder-dropdown-drag-handle-${item.id}`,
    isDragging: (item: DropdownPopupDetailedItem) => draggedPromptFolderSelectorId === item.id,
    isDraggingAny: () => draggedPromptFolderSelectorId !== null,
    onItemsElementChange: (element: HTMLElement | null) => {
      promptFolderSelectorItemsElement = element
    }
  }
</script>

<aside
  data-testid="app-sidebar"
  class="appSidebar flex h-full w-full flex-col text-sidebar-foreground/80"
>
  <div class="sidebarTopLevelInsetWithInnerPadding pt-4 pb-3">
    <div class="flex items-start gap-2">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center">
        <img
          class="h-8 w-8 object-contain"
          src={appIcon}
          alt="Cthulhu Prompt icon"
          title="Made in R'lyeh"
          draggable="false"
          ondragstart={(event) => event.preventDefault()}
        />
      </div>
      <div class="min-w-0 flex-1">
        <div class="cthulhuSidebarWorkspaceTitleRow">
          <h1
            data-testid="sidebar-workspace-name"
            class="cthulhuSidebarWorkspaceName truncate text-sm font-semibold tracking-tight"
          >
            {workspaceDisplay.title}
          </h1>
          {#if workspacePath}
            <IconButton
              icon={ExternalLink}
              label="Open Workspace Folder"
              title="Open Workspace Folder"
              size="tiny"
              borderless
              baseVariant="muted"
              hoverVariant="glyph"
              testId="sidebar-open-workspace-folder-button"
              class="ml-0.5"
              onclick={openWorkspaceFolder}
            />
          {/if}
        </div>
        <p
          data-testid="sidebar-workspace-subtitle"
          class="cthulhuSidebarWorkspacePath truncate pt-0.5 text-xs"
          title={workspacePath ?? undefined}
        >
          {workspaceDisplay.path}
        </p>
      </div>
    </div>
  </div>
  <Separator />

  {#if folderListState !== 'no-workspace'}
    <div class="sidebarTopLevelInsetWithInnerPadding py-1">
      {#if folderListState === 'empty'}
        <SelectorButton
          icon={promptFolderSelectorFooterItem.icon}
          text={promptFolderSelectorFooterItem.label}
          detail={promptFolderSelectorFooterItem.detail}
          showChevron={false}
          state={promptFolderSelectorState}
          testId="sidebar-prompt-folder-add-button"
          onclick={openCreatePromptFolderDialog}
        />
      {:else}
        <DetailedSelectorButton
          label="Folder selector"
          items={promptFolderDropdownItems}
          selectedItem={screenRootFolderDropdownItem}
          footerItem={promptFolderSelectorFooterItem}
          state={promptFolderSelectorState}
          itemDragOptions={promptFolderSelectorItemDragOptions}
          dragOpenTypes={promptFolderSelectorDragOpenTypes}
          testId="sidebar-prompt-folder-selector-menu"
          triggerTestId="sidebar-prompt-folder-selector-trigger"
          onselect={handlePromptFolderDropdownSelect}
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
          label="Show Folder Overview"
          title="Show Folder Overview"
          borderless
          disabled={!screenRootFolder}
          active={isFolderRootActive}
          testId="sidebar-folder-root-button"
          class="text-[var(--ui-secondary-icon-glyph)] hover:text-[var(--ui-hoverable-icon-glyph)]"
          onclick={selectFolderRoot}
        />
        {#if !isTemplateFolder}
          <IconButton
            icon={Check}
            label="Show Completed Prompts"
            title="Show Completed Prompts"
            borderless
            disabled={!screenRootFolder}
            active={isCompletedPromptSectionShown}
            testId="toggle-completed-prompts-button"
            class="text-[var(--ui-secondary-icon-glyph)] hover:text-[var(--ui-hoverable-icon-glyph)]"
            onclick={toggleCompletedPromptSection}
          />
        {/if}
        <IconButton
          icon={categoryExpansionActionIcon}
          label={categoryExpansionActionLabel}
          title={categoryExpansionActionLabel}
          borderless
          disabled={!canToggleCategories}
          testId="toggle-all-categories-button"
          class="text-[var(--ui-secondary-icon-glyph)] hover:text-[var(--ui-hoverable-icon-glyph)]"
          onclick={handleCategoryExpansionAction}
        />
        <IconButton
          icon={FolderPlus}
          label="Add Category"
          title="Add Category"
          borderless
          disabled={!screenRootFolder}
          testId="sidebar-add-category-button"
          class="text-[var(--ui-secondary-icon-glyph)] hover:text-[var(--ui-hoverable-icon-glyph)]"
          onclick={openCreateCategoryDialog}
        />
        <DropdownPopupSimple
          label={selectedFolderActionsLabel}
          items={selectedPromptFolderActionsItems}
          menuWidth="204px"
          testId="selected-prompt-folder-actions-menu"
          onselect={handleSelectedPromptFolderActionsSelect}
        >
          {#snippet trigger(dropdown)}
            <IconButton
              icon={MoreHorizontal}
              label={selectedFolderActionsLabel}
              title={selectedFolderActionsLabel}
              borderless
              disabled={!screenRootFolder}
              active={dropdown.open}
              ariaHaspopup={dropdown.ariaHaspopup}
              ariaExpanded={dropdown.ariaExpanded}
              buttonAction={dropdown.triggerAction}
              onclick={dropdown.toggle}
              testId="selected-prompt-folder-actions-button"
              class="text-[var(--ui-secondary-icon-glyph)] hover:text-[var(--ui-hoverable-icon-glyph)]"
            />
          {/snippet}
        </DropdownPopupSimple>
        <CreatePromptFolderDialog
          bind:this={createPromptFolderDialog}
          {isWorkspaceReady}
          {promptFolders}
          {promptTemplateFolders}
          isPromptFolderListLoading={isWorkspaceLoading}
          onCreated={(promptFolderId) => {
            onScreenRootFolderSelect(promptFolderId)
          }}
        />
      </div>
    {/if}
  </div>

  <div class="flex min-h-0 flex-1 flex-col overflow-visible">
    {#if screenRootFolder?.kind !== 'prompt'}
      <PromptTree
        promptFolders={rootPromptFolders}
        {folderListState}
        {screenRootFolderId}
        screenMode={PromptFolderScreenMode.Active}
        expansionRequests={promptTreeExpansionRequests}
        isPromptFoldersScreenActive={activeScreen === 'prompt-folders'}
        onAllCategoriesCollapsedChange={(isCollapsed) => {
          areAllCategoriesCollapsed = isCollapsed
        }}
        onScreenModeSelect={onPromptFolderModeChange}
        {onScreenRootFolderSelect}
      />
    {:else}
      <!-- Recreate the owner so conditionally visible sections register in rendered order. -->
      {#key isCompletedPromptSectionShown}
        <Accordion
          persistenceId={PROMPT_STATUS_ACCORDION_PERSISTENCE_ID}
          testId="sidebar-prompt-status-accordion"
          class="flex-1"
        >
          {#if isCompletedPromptSectionShown}
            <AccordionSection
              id="completed"
              label="COMPLETED"
              icon={CircleCheckBig}
              count={selectedPromptStatusCounts.completed}
            >
              <PromptTree
                promptFolders={rootPromptFolders}
                {folderListState}
                {screenRootFolderId}
                screenMode={PromptFolderScreenMode.Completed}
                virtualWindowTestId="prompt-tree-completed-virtual-window"
                expansionRequests={promptTreeExpansionRequests}
                isPromptFoldersScreenActive={activeScreen === 'prompt-folders' &&
                  promptFolderScreenMode === PromptFolderScreenMode.Completed}
                onAllCategoriesCollapsedChange={(isCollapsed) => {
                  areAllCategoriesCollapsed = isCollapsed
                }}
                onScreenModeSelect={onPromptFolderModeChange}
                {onScreenRootFolderSelect}
              />
            </AccordionSection>
          {/if}

          <AccordionSection
            id="active"
            label="ACTIVE"
            icon={ListTodo}
            count={selectedPromptStatusCounts.active}
          >
            <PromptTree
              promptFolders={rootPromptFolders}
              {folderListState}
              {screenRootFolderId}
              screenMode={PromptFolderScreenMode.Active}
              expansionRequests={promptTreeExpansionRequests}
              isPromptFoldersScreenActive={activeScreen === 'prompt-folders' &&
                promptFolderScreenMode === PromptFolderScreenMode.Active}
              onAllCategoriesCollapsedChange={(isCollapsed) => {
                areAllCategoriesCollapsed = isCollapsed
              }}
              onScreenModeSelect={onPromptFolderModeChange}
              {onScreenRootFolderSelect}
            />
          </AccordionSection>
        </Accordion>
      {/key}
    {/if}
  </div>
</aside>

<CreateCategoryDialog
  bind:this={createCategoryDialog}
  categories={selectedRootFolderCategories}
  isWorkspaceReady={screenRootFolder !== null}
  onsubmit={handleCreateCategory}
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

  .cthulhuSidebarWorkspaceName {
    min-width: 0;
    color: var(--ui-normal-text);
  }

  .cthulhuSidebarWorkspacePath {
    color: var(--ui-muted-text);
  }

  .cthulhuSidebarWorkspaceTitleRow {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 4px;
  }
</style>
