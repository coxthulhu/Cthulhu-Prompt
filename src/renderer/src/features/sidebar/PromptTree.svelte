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
  import { getPromptDisplayTitle as getPromptTitleText } from '@shared/promptFallbackTitle'
  import {
    getPromptNavigationContext,
    promptIdToPromptNavigationRow,
    promptNavigationRowToPersistedEntryId,
    type PromptNavigationRow
  } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    setPromptFolderPromptTreeEntryIdWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import type { PromptFolder } from '@shared/PromptFolder'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem,
    type VirtualWindowRowComponentProps
  } from '../virtualizer/virtualWindowTypes'
  import DropIndicator from '../drag-drop/DropIndicator.svelte'
  import { createPromptTreePromptDragController } from './promptTreeDrag'
  import PromptTreePromptRow from './PromptTreePromptRow.svelte'
  import { folderPromptDropIndicatorTestId } from './promptTreeTestIds'

  type FolderListState = 'no-workspace' | 'loading' | 'empty' | 'ready'

  type PromptTreeRow =
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
    onAllPromptFoldersCollapsedChange,
    onPromptFolderSelect
  } = $props<{
    promptFolders: PromptFolder[]
    folderListState: FolderListState
    selectedPromptFolderId?: string | null
    expandAllRequestVersion?: number
    collapseAllRequestVersion?: number
    isPromptFoldersScreenActive?: boolean
    onAllPromptFoldersCollapsedChange: (isCollapsed: boolean) => void
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
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let lastTrackedTreeRowId = $state<string | null>(null)
  let lastExpandAllRequestVersion = $state(0)
  let lastCollapseAllRequestVersion = $state(0)
  const promptNavigation = getPromptNavigationContext()
  const workspaceSelection = getWorkspaceSelectionContext()
  const promptDraftQuery = useLiveQuery(promptDraftCollection) as {
    data: PromptDraftRecord[]
  }

  const promptTreeTitleById = $derived.by(() => {
    const titlesById: Record<string, string> = {}

    for (const promptDraft of promptDraftQuery.data) {
      if (!promptDraft) {
        continue
      }

      titlesById[promptDraft.id] = getPromptTitleText(promptDraft)
    }

    return titlesById
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

  const PROMPT_TREE_ROW_CONTENT_INSET = '10px'

  const folderPromptRowId = (folderId: string, promptId: string): string =>
    `${folderId}:prompt:${promptId}`
  const promptTreePromptDroppableState = createDroppableStateRegistry<string>()

  const getPromptTreeDroppableOptions = (
    rowId: string,
    allowedEdges: DroppableAllowedEdges,
    getDropPayload: (edge: DroppableEdge | null) => PromptHandleDropPayload,
    canDrop?: (payload: PromptHandleDragPayload, edge: DroppableEdge | null) => boolean
  ): DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges,
    canDrop: canDrop ?? (() => true),
    payload: getDropPayload,
    state: promptTreePromptDroppableState.getState(rowId)
  })

  const canDropOnPromptTreePromptRow = (
    folder: PromptFolder,
    promptId: string,
    payload: PromptHandleDragPayload,
    edge: DroppableEdge | null
  ): boolean => {
    if (payload.fromId === promptId) {
      return false
    }

    if (payload.sourceFolderId !== folder.id) {
      return true
    }

    const draggedIndex = folder.promptIds.indexOf(payload.fromId)
    const targetIndex = folder.promptIds.indexOf(promptId)

    // Reject same-folder prompt-row edges that would leave the dragged row in place.
    return !(
      (edge === 'bottom' && targetIndex === draggedIndex - 1) ||
      (edge === 'top' && targetIndex === draggedIndex + 1)
    )
  }

  const getPromptTreeDropTargetEdge = (rowId: string): DroppableEdge | null =>
    promptTreePromptDroppableState.edge(rowId)

  const selectMovedPrompt = (promptFolderId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)

    promptNavigation.select({
      folderId: promptFolderId,
      row,
      source: 'prompt-move',
      forceVersionBump: true
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderPromptTreeEntryIdWithAutosave(
        workspaceId,
        promptFolderId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    onPromptFolderSelect(promptFolderId)
  }

  const trackedNavigationRow = $derived.by((): PromptNavigationRow | null => {
    if (!isPromptFoldersScreenActive || !selectedPromptFolder) {
      return null
    }

    if (promptNavigation.selectedFolderId !== selectedPromptFolder.id) {
      return null
    }

    return promptNavigation.selectedRow
  })

  const promptTreePromptDrag = createPromptTreePromptDragController({
    getPromptFolders: () => promptFolders,
    onPromptMove: (move) => {
      if (move.sourcePromptFolderId === move.destinationPromptFolderId) {
        return
      }

      selectMovedPrompt(move.destinationPromptFolderId, move.promptId)
    }
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
    if (!selectedPromptFolder || !trackedNavigationRow) {
      return null
    }

    return trackedNavigationRow === 'folder-settings'
      ? null
      : folderPromptRowId(selectedPromptFolder.id, trackedNavigationRow.slice('prompt:'.length))
  })

  const isTreeEntryActive = (folderId: string, row: PromptNavigationRow): boolean => {
    if (!isPromptFoldersScreenActive || !promptNavigation.selectedRow) {
      return false
    }

    return promptNavigation.selectedFolderId === folderId && promptNavigation.selectedRow === row
  }

  const isPromptRowDragging = (folderId: string, promptId: string): boolean => {
    const draggedPromptRow = promptDragState.draggedPromptRow
    return draggedPromptRow?.folderId === folderId && draggedPromptRow.promptId === promptId
  }
  const isPromptDragActive = $derived(promptDragState.draggedPromptRow !== null)

  const handlePromptTreeEntrySelect = (promptFolderId: string, row: PromptNavigationRow) => {
    const isSameFolderActive =
      isPromptFoldersScreenActive && selectedPromptFolder?.id === promptFolderId

    promptNavigation.select({
      folderId: promptFolderId,
      row,
      source: 'tree-click',
      forceVersionBump: true
    })

    if (!isSameFolderActive) {
      onPromptFolderSelect(promptFolderId)
    }
  }

  const handlePromptTreePromptSelect = (promptFolderId: string, promptId: string) => {
    handlePromptTreeEntrySelect(promptFolderId, promptIdToPromptNavigationRow(promptId))
  }

  // Side effect: report the current tree collapse state to the sidebar action button.
  $effect(() => {
    onAllPromptFoldersCollapsedChange(false)
  })

  // Side effect: keep request versions consumed while header collapse/expand is paused.
  $effect(() => {
    if (expandAllRequestVersion === lastExpandAllRequestVersion) {
      return
    }

    lastExpandAllRequestVersion = expandAllRequestVersion
  })

  // Side effect: keep request versions consumed while header collapse/expand is paused.
  $effect(() => {
    if (collapseAllRequestVersion === lastCollapseAllRequestVersion) {
      return
    }

    lastCollapseAllRequestVersion = collapseAllRequestVersion
  })

  // Side effect: keep the tracked prompt tree row visible while following prompt-folder scroll.
  $effect(() => {
    const nextTrackedRowId = trackedTreeRowId
    const currentFolderId = selectedPromptFolder?.id ?? null

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

    lastTrackedTreeRowId = nextTrackedRowId
    scrollToWithinWindowBand(nextTrackedRowId, PROMPT_TREE_ROW_CENTER_OFFSET_PX, 'minimal')
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptTreeRow>[] => {
    const items: VirtualWindowItem<PromptTreeRow>[] = []

    if (selectedPromptFolder) {
      for (const promptId of selectedPromptFolder.promptIds) {
        items.push({
          id: folderPromptRowId(selectedPromptFolder.id, promptId),
          row: {
            kind: 'folder-prompt',
            folder: selectedPromptFolder,
            promptId
          }
        })
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

{#snippet folderPromptRow(props)}
  {@const isActive = isTreeEntryActive(
    props.row.folder.id,
    promptIdToPromptNavigationRow(props.row.promptId)
  )}
  {@const isDragging = isPromptRowDragging(props.row.folder.id, props.row.promptId)}
  {@const promptTitle =
    promptTreeTitleById[props.row.promptId] ?? getPromptDisplayTitle(props.row.promptId)}

  <PromptTreePromptRow
    folderId={props.row.folder.id}
    promptId={props.row.promptId}
    {promptTitle}
    {isActive}
    {isDragging}
    {isPromptDragActive}
    getPromptDroppableOptions={() =>
      getPromptTreeDroppableOptions(
        props.rowId,
        'top-and-bottom',
        (edge) => ({
          kind: 'prompt',
          folderId: props.row.folder.id,
          promptId: props.row.promptId,
          edge: edge ?? 'bottom'
        }),
        (payload, edge) =>
          canDropOnPromptTreePromptRow(props.row.folder, props.row.promptId, payload, edge)
      )}
    promptDragOptions={getPromptRowDragOptions(
      props.row.folder.id,
      props.row.promptId,
      promptTitle
    )}
    onPromptSelect={handlePromptTreePromptSelect}
  />
{/snippet}

{#snippet promptTreeRowOverlay({ row, rowId }: PromptTreeOverlayRowProps)}
  {@const hoveredEdge = getPromptTreeDropTargetEdge(rowId)}
  {@const testId = folderPromptDropIndicatorTestId(row.promptId)}

  {#if hoveredEdge}
    <DropIndicator {testId} insetStart={PROMPT_TREE_ROW_CONTENT_INSET} edge={hoveredEdge} />
  {/if}
{/snippet}

{#snippet bottomSpacerRow()}
  <div aria-hidden="true"></div>
{/snippet}
