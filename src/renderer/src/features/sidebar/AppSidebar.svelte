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
    type PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import type { ScreenId } from '@renderer/app/screens'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import { ChevronsDownUp, Clock, ExternalLink, Folder, Plus, Settings } from 'lucide-svelte'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { movePromptFolder } from '@renderer/data/Mutations/WorkspaceMutations'
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { Workspace } from '@shared/Workspace'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/DropdownPopupDetailed.svelte'
  import SelectorButton from '@renderer/common/cthulhu-ui/SelectorButton.svelte'
  import SelectorButtonWithDropdown from '@renderer/common/cthulhu-ui/SelectorButtonWithDropdown.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import { getWorkspaceFolderName } from '@renderer/features/workspace/workspaceDisplay'
  import { formatPromptModifiedRelative } from '@renderer/features/prompt-editor/promptModifiedTime'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import CreatePromptFolderDialog from '../prompt-folders/CreatePromptFolderDialog.svelte'
  import PromptTree from './PromptTree.svelte'

  type CreatePromptFolderDialogHandle = {
    openDialog: () => void
  }

  let {
    activeScreen,
    isWorkspaceReady = false,
    isWorkspaceLoading = false,
    workspacePath = null,
    selectedPromptFolderId = null,
    onPromptFolderSelect
  } = $props<{
    activeScreen: ScreenId
    isWorkspaceReady?: boolean
    isWorkspaceLoading?: boolean
    workspacePath?: string | null
    selectedPromptFolderId?: string | null
    onPromptFolderSelect: (promptFolderId: string) => void
  }>()

  const workspaceSelection = getWorkspaceSelectionContext()
  const promptNavigation = getPromptNavigationContext()
  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
  }
  const promptFolderQuery = useLiveQuery((q) =>
    q.from({ promptFolder: promptFolderCollection })
  ) as { data: PromptFolder[] }

  const selectedWorkspace = $derived.by(() => {
    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId

    for (const workspace of workspaceQuery.data) {
      if (workspace?.id === selectedWorkspaceId) {
        return workspace
      }
    }

    return null
  })

  const promptFolders = $derived.by((): PromptFolder[] => {
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

    return selectedWorkspace.promptFolderIds
      .map((promptFolderId) => promptFolderById.get(promptFolderId))
      .filter((promptFolder): promptFolder is PromptFolder => promptFolder !== undefined)
  })

  const folderListState = $derived<'no-workspace' | 'loading' | 'empty' | 'ready'>(
    isWorkspaceLoading
      ? 'loading'
      : !isWorkspaceReady
        ? 'no-workspace'
        : promptFolders.length === 0
          ? 'empty'
          : 'ready'
  )

  const promptFolderSelectorPlaceholder: DropdownPopupDetailedItem = {
    id: 'no-prompt-folders',
    label: 'No prompt folders',
    detail: 'Create one from the menu',
    icon: Folder
  }
  const promptFolderSelectorFooterItem: DropdownPopupDetailedItem = {
    id: 'add-prompt-folder',
    label: 'Add Prompt Folder',
    detail: 'Create a new prompt folder',
    icon: Plus,
    testId: 'sidebar-prompt-folder-dropdown-add-item'
  }
  let draggedPromptFolderSelectorId = $state<string | null>(null)
  // Local preview order lets the dropdown reorder live without persisting until drop.
  let promptFolderSelectorDragSourceIds = $state<string[] | null>(null)
  let promptFolderSelectorPreviewIds = $state<string[] | null>(null)
  let promptFolderSelectorItemsElement = $state<HTMLElement | null>(null)
  let createPromptFolderDialog = $state<CreatePromptFolderDialogHandle | null>(null)
  let nowMs = $state(Date.now())

  // Side effect: keep folder-selector relative modified labels fresh while the app is open.
  onMount(() => {
    const intervalId = window.setInterval(() => {
      nowMs = Date.now()
    }, 60_000)

    return () => {
      window.clearInterval(intervalId)
    }
  })

  const capitalizeFirst = (value: string): string =>
    value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`

  const formatPromptFolderModifiedRelative = (modifiedAt: string): string =>
    capitalizeFirst(formatPromptModifiedRelative(modifiedAt, nowMs))

  const promptFolderDropdownFolders = $derived.by((): PromptFolder[] => {
    if (!promptFolderSelectorPreviewIds) {
      return promptFolders
    }

    const promptFolderById = new SvelteMap<string, PromptFolder>()
    for (const promptFolder of promptFolders) {
      promptFolderById.set(promptFolder.id, promptFolder)
    }

    return promptFolderSelectorPreviewIds
      .map((promptFolderId) => promptFolderById.get(promptFolderId))
      .filter((promptFolder): promptFolder is PromptFolder => promptFolder !== undefined)
  })
  const promptFolderDropdownItems = $derived.by((): DropdownPopupDetailedItem[] =>
    promptFolderDropdownFolders.map((promptFolder) => {
      const promptCount = promptFolder.promptIds.length
      const detailParts: DropdownPopupDetailedItem['detailParts'] = [
        `${promptCount} prompt${promptCount === 1 ? '' : 's'}`
      ]

      if (promptCount > 0 && promptFolder.modifiedAt) {
        detailParts.push({
          text: formatPromptFolderModifiedRelative(promptFolder.modifiedAt),
          icon: Clock,
          testId: 'sidebar-prompt-folder-modified-time'
        })
      }

      return {
        id: promptFolder.id,
        label: promptFolder.displayName,
        detailParts,
        icon: Folder,
        testId: `sidebar-prompt-folder-dropdown-item-${promptFolder.id}`
      }
    })
  )
  const selectedPromptFolderDropdownItem = $derived.by((): DropdownPopupDetailedItem => {
    if (promptFolderDropdownItems.length === 0) {
      return promptFolderSelectorPlaceholder
    }

    return (
      promptFolderDropdownItems.find((item) => item.id === selectedPromptFolderId) ??
      promptFolderDropdownItems[0]!
    )
  })
  const selectedPromptFolder = $derived.by((): PromptFolder | null => {
    if (promptFolders.length === 0) {
      return null
    }

    return (
      promptFolders.find((promptFolder) => promptFolder.id === selectedPromptFolderId) ??
      promptFolders[0]!
    )
  })
  const promptFolderSelectorState = $derived(
    isWorkspaceReady && !isWorkspaceLoading ? 'enabled' : 'disabled'
  )
  const canTogglePromptFolders = $derived(folderListState === 'ready' && promptFolders.length > 0)
  let expandAllPromptFoldersVersion = $state(0)
  let collapseAllPromptFoldersVersion = $state(0)
  const promptFolderSelectorPromptDroppableState = createDroppableStateRegistry<string>()
  const promptFolderSelectorDragOpenTypes = [
    PROMPT_FOLDER_SELECTOR_DRAG_TYPE,
    PROMPT_HANDLE_DRAG_TYPE
  ]
  const promptFolderExpansionActionIcon = ChevronsDownUp
  const promptFolderExpansionActionLabel = 'Collapse All Prompt Folders'

  const handlePromptFolderExpansionAction = () => {
    // Collapse All is paused until subfolders make tree expansion meaningful again.
  }

  const openSelectedPromptFolderSettings = () => {
    const promptFolder = selectedPromptFolder
    if (!promptFolder) return

    promptNavigation.select({
      folderId: promptFolder.id,
      row: 'folder-settings',
      source: 'tree-click',
      forceVersionBump: true
    })
    onPromptFolderSelect(promptFolder.id)
  }

  const openWorkspaceFolder = () => {
    const targetWorkspacePath = workspacePath
    if (!targetWorkspacePath) return

    // Hand off to the main process so Windows opens the folder in Explorer.
    void runIpcBestEffort(() =>
      ipcInvoke<void, string>('open-workspace-folder', targetWorkspacePath)
    )
  }

  // Keep workspace header text aligned with the mockup's simple end-truncation style.
  const workspaceDisplay = $derived.by(() => {
    if (!workspacePath) {
      return {
        title: 'No Workspace Selected',
        path: ''
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

    if (promptFolders.some((promptFolder) => promptFolder.id === item.id)) {
      onPromptFolderSelect(item.id)
    }
  }

  const arePromptFolderIdOrdersEqual = (left: string[], right: string[]): boolean => {
    return left.length === right.length && left.every((folderId, index) => folderId === right[index])
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

  const getPromptFolderOrderAfterId = (
    folderIds: string[],
    folderId: string
  ): string | null => {
    const folderIndex = folderIds.indexOf(folderId)
    return folderIndex <= 0 ? null : folderIds[folderIndex - 1]!
  }

  const isHoveringPromptFolderSelectorFooter = (clientX: number, clientY: number): boolean => {
    const footerSelector = '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'

    return document
      .elementsFromPoint(clientX, clientY)
      .some(
        (element) => element instanceof Element && element.closest(footerSelector) !== null
      )
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
      promptFolderSelectorPreviewIds ?? promptFolders.map((promptFolder) => promptFolder.id)
    const targetIndex = getPromptFolderSelectorTargetIndex(clientY, currentPreviewIds.length)
    if (targetIndex === null) {
      return
    }

    const nextPreviewIds = reorderPromptFolderIds(
      currentPreviewIds,
      draggedFolderId,
      targetIndex
    )

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

    const orderAfterPromptFolderId = getPromptFolderOrderAfterId(previewIds, draggedFolderId)
    void runIpcBestEffort(async () => {
      await movePromptFolder(workspaceId, draggedFolderId, orderAfterPromptFolderId)
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
      const folderIds = promptFolders.map((promptFolder) => promptFolder.id)
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
      persistPromptFolderSelectorReorder(
        (result.sourcePayload as PromptFolderDragPayload).folderId
      )
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
      kind: 'folder',
      folderId: item.id
    }),
    canDrop: (payload) => (payload as PromptHandleDragPayload).sourceFolderId !== item.id,
    state: promptFolderSelectorPromptDroppableState.getState(item.id)
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
              baseVariant="muted"
              hoverVariant="glyph"
              testId="sidebar-open-workspace-folder-button"
              class="ml-0.5"
              onclick={openWorkspaceFolder}
            />
          {/if}
        </div>
        <p
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
        <SelectorButtonWithDropdown
          label="Prompt folder selector"
          items={promptFolderDropdownItems}
          selectedItem={selectedPromptFolderDropdownItem}
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
    <p class="cthulhuSidebarPromptSectionTitle">Prompts</p>
    {#if isWorkspaceReady}
      <div class="cthulhuSidebarPromptSectionActions">
        <IconButton
          icon={Settings}
          label="Open Selected Prompt Folder Settings"
          title="Open Selected Prompt Folder Settings"
          size="compact"
          disabled={!selectedPromptFolder}
          testId="open-selected-prompt-folder-settings-button"
          class="text-[var(--ui-secondary-icon-glyph)] hover:text-[var(--ui-hoverable-icon-glyph)]"
          onclick={openSelectedPromptFolderSettings}
        />
        <IconButton
          icon={promptFolderExpansionActionIcon}
          label={promptFolderExpansionActionLabel}
          title={promptFolderExpansionActionLabel}
          size="compact"
          disabled={!canTogglePromptFolders}
          testId="toggle-all-prompt-folders-button"
          class="text-[var(--ui-secondary-icon-glyph)] hover:text-[var(--ui-hoverable-icon-glyph)]"
          onclick={handlePromptFolderExpansionAction}
        />
        <CreatePromptFolderDialog
          bind:this={createPromptFolderDialog}
          {isWorkspaceReady}
          {promptFolders}
          isPromptFolderListLoading={isWorkspaceLoading}
          onCreated={(promptFolderId) => {
            onPromptFolderSelect(promptFolderId)
          }}
        />
      </div>
    {/if}
  </div>

  <div
    class="sidebarTopLevelInset flex min-h-0 flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:overflow-hidden"
  >
    <PromptTree
      {promptFolders}
      {folderListState}
      {selectedPromptFolderId}
      expandAllRequestVersion={expandAllPromptFoldersVersion}
      collapseAllRequestVersion={collapseAllPromptFoldersVersion}
      isPromptFoldersScreenActive={activeScreen === 'prompt-folders'}
      onAllPromptFoldersCollapsedChange={() => {}}
      {onPromptFolderSelect}
    />
  </div>
</aside>

<style>
  .cthulhuSidebarPromptSectionTitle {
    margin: 0;
    color: var(--ui-normal-text);
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
  }

  .cthulhuSidebarPromptSectionHeader {
    display: flex;
    min-height: 40px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 8px 0 12px;
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
