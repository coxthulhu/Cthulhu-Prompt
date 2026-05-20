<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import {
    ArrowRight,
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    Loader,
    Settings
  } from 'lucide-svelte'
  import {
    createDroppableStateRegistry,
    draggable,
    droppable,
    type DroppableAllowedEdges,
    type DroppableEdge,
    type DroppableOptions,
    type DraggableOptions
  } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import { createPromptDragGhost } from '@renderer/features/drag-drop/promptDragGhost'
  import { promptDragState } from '@renderer/features/drag-drop/promptDragState.svelte.ts'
  import {
    type PromptDraftRecord,
    promptDraftCollection
  } from '@renderer/data/Collections/PromptDraftCollection'
  import { getPromptDisplayTitle } from '@renderer/data/UiState/PromptFolderScreenData.svelte.ts'
  import {
    getPromptNavigationContext,
    promptIdToPromptNavigationRow,
    type PromptNavigationRow
  } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    lookupWorkspacePersistedPromptFolderExpandedState,
    setPromptFolderExpandedStateWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import type { PromptFolder } from '@shared/PromptFolder'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem,
    type VirtualWindowRowComponentProps
  } from '../virtualizer/virtualWindowTypes'
  import PromptTreeDropIndicator from './PromptTreeDropIndicator.svelte'
  import { createPromptTreePromptDragController } from './promptTreeDrag'
  import {
    folderIconTestId,
    folderOpenTestId,
    folderPromptDropIndicatorTestId,
    folderPromptTestId,
    folderSettingsIconTestId,
    folderSettingsTestId,
    folderToggleTestId
  } from './promptTreeTestIds'

  type FolderListState = 'no-workspace' | 'loading' | 'empty' | 'ready'

  type PromptTreeRow =
    | {
        kind: 'prompt-folder'
        folder: PromptFolder
      }
    | {
        kind: 'folder-prompt'
        folder: PromptFolder
        promptId: string
      }
    | {
        kind: 'bottom-spacer'
      }

  type PromptTreeOverlayRow = Extract<PromptTreeRow, { kind: 'folder-prompt' }>
  type PromptTreeOverlayRowProps = VirtualWindowRowComponentProps<PromptTreeOverlayRow>

  let {
    promptFolders,
    folderListState,
    selectedPromptFolderId = null,
    expandAllRequestVersion = 0,
    collapseAllRequestVersion = 0,
    isPromptFoldersScreenActive = false,
    onPromptFolderSelect
  } = $props<{
    promptFolders: PromptFolder[]
    folderListState: FolderListState
    selectedPromptFolderId?: string | null
    expandAllRequestVersion?: number
    collapseAllRequestVersion?: number
    isPromptFoldersScreenActive?: boolean
    onPromptFolderSelect: (promptFolderId: string) => void
  }>()

  const PROMPT_TREE_ROW_EMPTY_BLOCK_SPACE_PX = 1
  const PROMPT_TREE_FOLDER_ROW_CONTENT_HEIGHT_PX = 36
  const PROMPT_TREE_PROMPT_ROW_CONTENT_HEIGHT_PX = 30
  const PROMPT_TREE_FOLDER_ROW_HEIGHT_PX =
    PROMPT_TREE_FOLDER_ROW_CONTENT_HEIGHT_PX + PROMPT_TREE_ROW_EMPTY_BLOCK_SPACE_PX * 2
  const PROMPT_TREE_PROMPT_ROW_HEIGHT_PX =
    PROMPT_TREE_PROMPT_ROW_CONTENT_HEIGHT_PX + PROMPT_TREE_ROW_EMPTY_BLOCK_SPACE_PX * 2

  const rowRegistry = defineVirtualWindowRowRegistry<PromptTreeRow>({
    'prompt-folder': {
      estimateHeight: () => PROMPT_TREE_FOLDER_ROW_HEIGHT_PX,
      snippet: promptFolderRow
    },
    'folder-prompt': {
      estimateHeight: () => PROMPT_TREE_PROMPT_ROW_HEIGHT_PX,
      overlayRow: {
        snippet: promptTreeRowOverlay
      },
      snippet: folderPromptRow
    },
    'bottom-spacer': {
      estimateHeight: () => PROMPT_TREE_FOLDER_ROW_HEIGHT_PX,
      snippet: bottomSpacerRow
    }
  })

  const PROMPT_TREE_ROW_CENTER_OFFSET_PX = 14
  let expandedFolderStates = $state<Record<string, boolean>>({})
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let lastTrackedTreeRowId = $state<string | null>(null)
  let lastExpandAllRequestVersion = $state(0)
  let lastCollapseAllRequestVersion = $state(0)
  const promptNavigation = getPromptNavigationContext()
  const workspaceSelection = getWorkspaceSelectionContext()
  let lastWorkspaceId = $state<string | null>(workspaceSelection.selectedWorkspaceId)
  const promptDraftQuery = useLiveQuery(promptDraftCollection) as {
    data: PromptDraftRecord[]
  }

  const promptTreeTitleById = $derived.by(() => {
    const titlesById: Record<string, string> = {}

    for (const promptDraft of promptDraftQuery.data) {
      if (!promptDraft) {
        continue
      }

      const trimmedTitle = promptDraft.title.trim()
      titlesById[promptDraft.id] =
        trimmedTitle.length > 0 ? trimmedTitle : `Prompt ${promptDraft.promptFolderCount}`
    }

    return titlesById
  })

  const lookupPersistedFolderExpandedState = (folderId: string): boolean => {
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) {
      return true
    }

    return lookupWorkspacePersistedPromptFolderExpandedState(workspaceId, folderId) ?? true
  }

  const isFolderExpanded = (folderId: string): boolean =>
    expandedFolderStates[folderId] ?? lookupPersistedFolderExpandedState(folderId)

  const setFolderExpanded = (folderId: string, isExpanded: boolean) => {
    if (isFolderExpanded(folderId) === isExpanded) {
      return
    }

    expandedFolderStates = {
      ...expandedFolderStates,
      [folderId]: isExpanded
    }

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) {
      return
    }

    setPromptFolderExpandedStateWithAutosave(workspaceId, folderId, isExpanded)
  }

  const toggleFolderExpanded = (folderId: string) => {
    setFolderExpanded(folderId, !isFolderExpanded(folderId))
  }

  const expandAllPromptFolders = () => {
    for (const folder of promptFolders) {
      setFolderExpanded(folder.id, true)
    }
  }

  const collapseAllPromptFolders = () => {
    for (const folder of promptFolders) {
      setFolderExpanded(folder.id, false)
    }
  }

  const PROMPT_TREE_CHILD_ROW_CONTENT_INSET = '38px'

  const folderPromptRowId = (folderId: string, promptId: string): string =>
    `${folderId}:prompt:${promptId}`
  const promptTreeDroppableState = createDroppableStateRegistry<string>()

  const getPromptTreeDroppableOptions = (
    rowId: string,
    allowedEdges: DroppableAllowedEdges,
    getDropPayload: (edge: DroppableEdge | null) => PromptHandleDropPayload
  ): DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges,
    payload: getDropPayload,
    state: promptTreeDroppableState.getState(rowId)
  })

  const isPromptTreeDropTargetOver = (rowId: string): boolean =>
    promptTreeDroppableState.isOver(rowId)

  const getPromptTreeDropTargetEdge = (rowId: string): DroppableEdge | null =>
    promptTreeDroppableState.edge(rowId)

  const getPromptTreeDropIndicatorTestId = (row: PromptTreeOverlayRow): string =>
    folderPromptDropIndicatorTestId(row.promptId)

  const blurButtonAfterMouseClick = (event: MouseEvent) => {
    // Side effect: keep action-slot visibility stable by defocusing only real mouse clicks.
    if (event.detail === 0) {
      return
    }

    const button = event.currentTarget
    if (button instanceof HTMLButtonElement) {
      button.blur()
    }
  }

  const handleFolderToggleClick = (folderId: string, event: MouseEvent) => {
    toggleFolderExpanded(folderId)
    blurButtonAfterMouseClick(event)
  }

  const handlePromptFolderOpen = (promptFolderId: string, event: MouseEvent) => {
    onPromptFolderSelect(promptFolderId)
    blurButtonAfterMouseClick(event)
  }

  const trackedNavigationRow = $derived.by((): PromptNavigationRow | null => {
    if (!isPromptFoldersScreenActive || !selectedPromptFolderId) {
      return null
    }

    if (promptNavigation.selectedFolderId !== selectedPromptFolderId) {
      return null
    }

    return promptNavigation.selectedRow
  })

  const promptTreePromptDrag = createPromptTreePromptDragController({
    getPromptFolders: () => promptFolders
  })

  const getPromptRowDragOptions = (
    folderId: string,
    promptId: string,
    title: string
  ): DraggableOptions<PromptHandleDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: {
      fromId: promptId,
      sourceFolderId: folderId
    },
    createGhost: () => createPromptDragGhost(title),
    onDragStart: promptTreePromptDrag.handleDragStart,
    onDragFinish: promptTreePromptDrag.handleDragFinish
  })

  const trackedTreeRowId = $derived.by((): string | null => {
    if (!selectedPromptFolderId || !trackedNavigationRow) {
      return null
    }

    return trackedNavigationRow === 'folder-settings'
      ? selectedPromptFolderId
      : folderPromptRowId(selectedPromptFolderId, trackedNavigationRow.slice('prompt:'.length))
  })

  const isTreeEntryActive = (folderId: string, row: PromptNavigationRow): boolean => {
    if (!isPromptFoldersScreenActive || !promptNavigation.selectedRow) {
      return false
    }

    return (
      promptNavigation.selectedFolderId === folderId && promptNavigation.selectedRow === row
    )
  }

  const isPromptRowDragging = (folderId: string, promptId: string): boolean => {
    const draggedPromptRow = promptDragState.draggedPromptRow
    return draggedPromptRow?.folderId === folderId && draggedPromptRow.promptId === promptId
  }

  const handlePromptTreeEntrySelect = (
    promptFolderId: string,
    row: PromptNavigationRow,
    event: MouseEvent
  ) => {
    const isSameFolderActive =
      isPromptFoldersScreenActive && selectedPromptFolderId === promptFolderId

    promptNavigation.select({
      folderId: promptFolderId,
      row,
      source: 'tree-click',
      forceVersionBump: true
    })

    if (!isSameFolderActive) {
      onPromptFolderSelect(promptFolderId)
    }

    blurButtonAfterMouseClick(event)
  }

  // Side effect: clear local folder expand overrides when switching workspaces.
  $effect(() => {
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId === lastWorkspaceId) {
      return
    }

    lastWorkspaceId = workspaceId
    expandedFolderStates = {}
  })

  // Side effect: respond to the sidebar header action by expanding every prompt folder.
  $effect(() => {
    if (expandAllRequestVersion === lastExpandAllRequestVersion) {
      return
    }

    lastExpandAllRequestVersion = expandAllRequestVersion
    expandAllPromptFolders()
  })

  // Side effect: respond to the sidebar header action by collapsing every prompt folder.
  $effect(() => {
    if (collapseAllRequestVersion === lastCollapseAllRequestVersion) {
      return
    }

    lastCollapseAllRequestVersion = collapseAllRequestVersion
    collapseAllPromptFolders()
  })

  // Side effect: keep the tracked prompt tree row visible while following prompt-folder scroll.
  $effect(() => {
    const nextTrackedRowId = trackedTreeRowId
    const currentFolderId = selectedPromptFolderId

    if (!scrollToWithinWindowBand) {
      return
    }

    if (!nextTrackedRowId) {
      lastTrackedTreeRowId = null
      return
    }

    if (nextTrackedRowId === lastTrackedTreeRowId) {
      return
    }

    if (!currentFolderId) return

    if (!isFolderExpanded(currentFolderId)) {
      setFolderExpanded(currentFolderId, true)
      return
    }

    lastTrackedTreeRowId = nextTrackedRowId
    scrollToWithinWindowBand(nextTrackedRowId, PROMPT_TREE_ROW_CENTER_OFFSET_PX, 'minimal')
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptTreeRow>[] => {
    const items: VirtualWindowItem<PromptTreeRow>[] = []

    for (const folder of promptFolders) {
      items.push({
        id: folder.id,
        row: {
          kind: 'prompt-folder',
          folder
        }
      })

      if (isFolderExpanded(folder.id)) {
        for (const promptId of folder.promptIds) {
          items.push({
            id: folderPromptRowId(folder.id, promptId),
            row: {
              kind: 'folder-prompt',
              folder,
              promptId
            }
          })
        }
      }
    }

    // Keep one folder row of trailing space at the end of the tree.
    items.push({
      id: 'bottom-spacer',
      row: {
        kind: 'bottom-spacer'
      }
    })

    return items
  })
</script>

<div class="flex min-h-0 flex-1 flex-col">
  {#if folderListState === 'no-workspace'}
    <div class="sidebarPromptTreeStatus px-2 text-xs">Select a Workspace to Get Started</div>
  {:else if folderListState === 'loading'}
    <div class="sidebarPromptTreeStatus flex items-center gap-2 px-2 text-xs">
      <Loader class="size-4 animate-spin" />
      Loading folders...
    </div>
  {:else if folderListState === 'empty'}
    <div class="sidebarPromptTreeStatus px-2 text-xs">Create a Prompt Folder to Get Started</div>
  {:else}
    <div class="flex min-h-0 flex-1 flex-col">
      <SvelteVirtualWindow
        items={virtualItems}
        {rowRegistry}
        rowHeightGridPx={2}
        leftScrollPaddingPx={0}
        rightScrollPaddingPx={1}
        testId="prompt-tree-virtual-window"
        spacerTestId="prompt-tree-virtual-window-spacer"
        bind:scrollToWithinWindowBand
      />
    </div>
  {/if}
</div>

{#snippet promptFolderRow(props)}
  {@const isActive = isPromptFoldersScreenActive && selectedPromptFolderId === props.row.folder.id}
  {@const isSettingsActive = isTreeEntryActive(props.row.folder.id, 'folder-settings')}
  {@const isDropTargetOver = isPromptTreeDropTargetOver(props.rowId)}

  <div
    use:droppable={getPromptTreeDroppableOptions(props.rowId, 'none', () => ({
      kind: 'folder',
      folderId: props.row.folder.id
    }))}
    class="sidebarPromptTreeFolderRow"
  >
    <div
      class="sidebarPromptTreeRow group"
      data-active={isActive ? 'true' : 'false'}
      data-over={isDropTargetOver ? 'true' : 'false'}
    >
      <button
        type="button"
        aria-label={`${isFolderExpanded(props.row.folder.id) ? 'Collapse' : 'Expand'} ${props.row.folder.displayName}`}
        aria-expanded={isFolderExpanded(props.row.folder.id)}
        onclick={(event) => handleFolderToggleClick(props.row.folder.id, event)}
        data-testid={folderToggleTestId(props.row.folder)}
        class="sidebarPromptTreeToggleButton"
      >
        <span class="sidebarPromptTreeChevronWrap">
          {#if isFolderExpanded(props.row.folder.id)}
            <ChevronDown class="sidebarPromptTreeChevronIcon" />
          {:else}
            <ChevronRight class="sidebarPromptTreeChevronIcon" />
          {/if}
        </span>
        <Folder
          class="sidebarPromptTreeFolderIcon"
          data-testid={folderIconTestId(props.row.folder)}
        />
        <span class="sidebarPromptTreeFolderLabel">{props.row.folder.displayName}</span>
      </button>

      <!-- Count and actions share one slot; hover/focus swaps visibility. -->
      <div class="sidebarPromptTreeActionSlot">
        <span class="sidebarPromptTreeCountBadge sidebarPromptTreeCountInActionSlot">
          {props.row.folder.promptIds.length}
        </span>
        <div class="sidebarPromptTreeFolderActions">
          <button
            type="button"
            aria-label={`Folder settings for ${props.row.folder.displayName}`}
            aria-current={isSettingsActive ? 'true' : undefined}
            onclick={(event) =>
              handlePromptTreeEntrySelect(props.row.folder.id, 'folder-settings', event)}
            data-testid={folderSettingsTestId(props.row.folder)}
            data-active={isSettingsActive ? 'true' : 'false'}
            class="sidebarPromptTreeActionButton"
          >
            <Settings
              class="size-4"
              data-testid={folderSettingsIconTestId(props.row.folder)}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            aria-label={`Open ${props.row.folder.displayName}`}
            onclick={(event) => handlePromptFolderOpen(props.row.folder.id, event)}
            data-testid={folderOpenTestId(props.row.folder)}
            data-size="default"
            data-active={isActive}
            class="sidebarPromptTreeActionButton"
          >
            <ArrowRight class="size-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
{/snippet}

{#snippet folderPromptRow(props)}
  {@const isActive = isTreeEntryActive(
    props.row.folder.id,
    promptIdToPromptNavigationRow(props.row.promptId)
  )}
  {@const isDragging = isPromptRowDragging(props.row.folder.id, props.row.promptId)}
  {@const promptTitle =
    promptTreeTitleById[props.row.promptId] ?? getPromptDisplayTitle(props.row.promptId)}

  <div
    use:droppable={getPromptTreeDroppableOptions(props.rowId, 'top-and-bottom', (edge) => ({
      kind: 'prompt',
      folderId: props.row.folder.id,
      promptId: props.row.promptId,
      edge: edge ?? 'bottom'
    }))}
    class="sidebarPromptTreeSettingsRow"
  >
    <button
      use:draggable={getPromptRowDragOptions(
        props.row.folder.id,
        props.row.promptId,
        promptTitle
      )}
      type="button"
      data-testid={folderPromptTestId(props.row.promptId)}
      data-active={isActive ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
      aria-current={isActive ? 'true' : undefined}
      onclick={(event) =>
        handlePromptTreeEntrySelect(
          props.row.folder.id,
          promptIdToPromptNavigationRow(props.row.promptId),
          event
        )}
      class="sidebarPromptTreeSettingsButton"
    >
      <FileText class="sidebarPromptTreeSettingsIcon" aria-hidden="true" />
      <span class="sidebarPromptTreeSettingsLabel">{promptTitle}</span>
    </button>
  </div>
{/snippet}

{#snippet promptTreeRowOverlay({ row, rowId }: PromptTreeOverlayRowProps)}
  {@const hoveredEdge = getPromptTreeDropTargetEdge(rowId)}

  {#if hoveredEdge}
    <PromptTreeDropIndicator
      testId={getPromptTreeDropIndicatorTestId(row)}
      insetStart={PROMPT_TREE_CHILD_ROW_CONTENT_INSET}
      edge={hoveredEdge}
    />
  {/if}
{/snippet}

{#snippet bottomSpacerRow()}
  <div aria-hidden="true"></div>
{/snippet}
