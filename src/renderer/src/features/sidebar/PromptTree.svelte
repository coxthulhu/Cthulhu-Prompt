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
    type PromptNavigationRow
  } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import {
    lookupWorkspacePersistedPromptFolderShowingAllPromptsState,
    lookupWorkspacePersistedPromptFolderExpandedState,
    setPromptFolderExpandedStateWithAutosave,
    setPromptFolderShowingAllPromptsStateWithAutosave
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
  import PromptTreeFolderRow from './PromptTreeFolderRow.svelte'
  import PromptTreePromptRow from './PromptTreePromptRow.svelte'
  import PromptTreeVisibilityToggleRow from './PromptTreeVisibilityToggleRow.svelte'
  import {
    folderPromptDropIndicatorTestId,
    folderPromptVisibilityDropIndicatorTestId
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
        kind: 'folder-prompt-visibility-toggle'
        folder: PromptFolder
        isShowingAll: boolean
        hiddenPromptCount: number
        lastVisiblePromptId: string
      }
    | {
        kind: 'bottom-spacer'
      }

  type PromptTreeOverlayRow = Extract<
    PromptTreeRow,
    { kind: 'prompt-folder' | 'folder-prompt' | 'folder-prompt-visibility-toggle' }
  >
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
  const PROMPT_TREE_PROMPT_VISIBILITY_ROW_CONTENT_HEIGHT_PX = 22
  const PROMPT_TREE_VISIBLE_PROMPT_LIMIT = 5
  const PROMPT_TREE_FOLDER_ROW_HEIGHT_PX =
    PROMPT_TREE_FOLDER_ROW_CONTENT_HEIGHT_PX + PROMPT_TREE_ROW_EMPTY_BLOCK_SPACE_PX * 2
  const PROMPT_TREE_PROMPT_ROW_HEIGHT_PX =
    PROMPT_TREE_PROMPT_ROW_CONTENT_HEIGHT_PX + PROMPT_TREE_ROW_EMPTY_BLOCK_SPACE_PX * 2
  const PROMPT_TREE_PROMPT_VISIBILITY_ROW_HEIGHT_PX =
    PROMPT_TREE_PROMPT_VISIBILITY_ROW_CONTENT_HEIGHT_PX + PROMPT_TREE_ROW_EMPTY_BLOCK_SPACE_PX * 2

  const rowRegistry = defineVirtualWindowRowRegistry<PromptTreeRow>({
    'prompt-folder': {
      estimateHeight: () => PROMPT_TREE_FOLDER_ROW_HEIGHT_PX,
      overlayRow: {
        snippet: promptTreeRowOverlay
      },
      snippet: promptFolderRow
    },
    'folder-prompt': {
      estimateHeight: () => PROMPT_TREE_PROMPT_ROW_HEIGHT_PX,
      overlayRow: {
        snippet: promptTreeRowOverlay
      },
      snippet: folderPromptRow
    },
    'folder-prompt-visibility-toggle': {
      estimateHeight: () => PROMPT_TREE_PROMPT_VISIBILITY_ROW_HEIGHT_PX,
      overlayRow: {
        snippet: promptTreeRowOverlay
      },
      snippet: folderPromptVisibilityToggleRow
    },
    'bottom-spacer': {
      estimateHeight: () => PROMPT_TREE_FOLDER_ROW_HEIGHT_PX,
      snippet: bottomSpacerRow
    }
  })

  const PROMPT_TREE_ROW_CENTER_OFFSET_PX = 14
  let expandedFolderStates = $state<Record<string, boolean>>({})
  let showingAllPromptStates = $state<Record<string, boolean>>({})
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

      titlesById[promptDraft.id] = getPromptTitleText(promptDraft)
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

  const lookupPersistedFolderShowingAllPromptsState = (folderId: string): boolean => {
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) {
      return false
    }

    return (
      lookupWorkspacePersistedPromptFolderShowingAllPromptsState(workspaceId, folderId) ?? false
    )
  }

  const isFolderExpanded = (folderId: string): boolean =>
    expandedFolderStates[folderId] ?? lookupPersistedFolderExpandedState(folderId)

  const isFolderShowingAllPrompts = (folderId: string): boolean =>
    showingAllPromptStates[folderId] ?? lookupPersistedFolderShowingAllPromptsState(folderId)

  const areAllPromptFoldersCollapsed = $derived.by(() =>
    promptFolders.every((folder) => !isFolderExpanded(folder.id))
  )

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

  const setFolderShowingAllPrompts = (folderId: string, isShowingAll: boolean) => {
    if (isFolderShowingAllPrompts(folderId) === isShowingAll) {
      return
    }

    showingAllPromptStates = {
      ...showingAllPromptStates,
      [folderId]: isShowingAll
    }

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) {
      return
    }

    setPromptFolderShowingAllPromptsStateWithAutosave(workspaceId, folderId, isShowingAll)
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
  const folderPromptVisibilityToggleRowId = (folderId: string): string =>
    `${folderId}:prompt-visibility-toggle`
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

  const handlePromptFolderOpen = (promptFolderId: string) => {
    onPromptFolderSelect(promptFolderId)
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

  const isTrackedPromptHiddenByVisibilityLimit = $derived.by((): boolean => {
    if (!selectedPromptFolderId || !trackedNavigationRow?.startsWith('prompt:')) {
      return false
    }

    if (
      !isFolderExpanded(selectedPromptFolderId) ||
      isFolderShowingAllPrompts(selectedPromptFolderId)
    ) {
      return false
    }

    const selectedFolder = promptFolders.find((folder) => folder.id === selectedPromptFolderId)
    if (!selectedFolder) {
      return false
    }

    const promptId = trackedNavigationRow.slice('prompt:'.length)
    return selectedFolder.promptIds.indexOf(promptId) >= PROMPT_TREE_VISIBLE_PROMPT_LIMIT
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
  }

  const handlePromptTreePromptSelect = (promptFolderId: string, promptId: string) => {
    handlePromptTreeEntrySelect(promptFolderId, promptIdToPromptNavigationRow(promptId))
  }

  // Side effect: clear local folder expand overrides when switching workspaces.
  $effect(() => {
    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId === lastWorkspaceId) {
      return
    }

    lastWorkspaceId = workspaceId
    expandedFolderStates = {}
    showingAllPromptStates = {}
  })

  // Side effect: report the current tree collapse state to the sidebar action button.
  $effect(() => {
    onAllPromptFoldersCollapsedChange(areAllPromptFoldersCollapsed)
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

    if (isTrackedPromptHiddenByVisibilityLimit) {
      setFolderShowingAllPrompts(currentFolderId, true)
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
        const isShowingAll = isFolderShowingAllPrompts(folder.id)
        const visiblePromptIds = isShowingAll
          ? folder.promptIds
          : folder.promptIds.slice(0, PROMPT_TREE_VISIBLE_PROMPT_LIMIT)

        for (const promptId of visiblePromptIds) {
          items.push({
            id: folderPromptRowId(folder.id, promptId),
            row: {
              kind: 'folder-prompt',
              folder,
              promptId
            }
          })
        }

        if (folder.promptIds.length > PROMPT_TREE_VISIBLE_PROMPT_LIMIT) {
          const lastVisiblePromptId = visiblePromptIds[visiblePromptIds.length - 1]
          const hiddenPromptCount = folder.promptIds.length - visiblePromptIds.length
          if (lastVisiblePromptId) {
            items.push({
              id: folderPromptVisibilityToggleRowId(folder.id),
              row: {
                kind: 'folder-prompt-visibility-toggle',
                folder,
                isShowingAll,
                hiddenPromptCount,
                lastVisiblePromptId
              }
            })
          }
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

  <PromptTreeFolderRow
    folder={props.row.folder}
    {isActive}
    {isSettingsActive}
    {isPromptDragActive}
    isExpanded={isFolderExpanded(props.row.folder.id)}
    isShowingAllPrompts={isFolderShowingAllPrompts(props.row.folder.id)}
    visiblePromptLimit={PROMPT_TREE_VISIBLE_PROMPT_LIMIT}
    getFolderPromptDroppableOptions={() =>
      getPromptTreeDroppableOptions(props.rowId, 'none', () => ({
        kind: 'folder',
        folderId: props.row.folder.id
      }))}
    onFolderExpandedChange={setFolderExpanded}
    onPromptFolderOpen={handlePromptFolderOpen}
    onFolderSettingsOpen={(folderId) => handlePromptTreeEntrySelect(folderId, 'folder-settings')}
    onPromptVisibilityChange={setFolderShowingAllPrompts}
  />
{/snippet}

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

{#snippet folderPromptVisibilityToggleRow(props)}
  <PromptTreeVisibilityToggleRow
    folder={props.row.folder}
    isShowingAll={props.row.isShowingAll}
    {isPromptDragActive}
    hiddenPromptCount={props.row.hiddenPromptCount}
    getVisibilityDroppableOptions={() =>
      getPromptTreeDroppableOptions(
        props.rowId,
        'bottom',
        () => ({
          kind: 'prompt',
          folderId: props.row.folder.id,
          promptId: props.row.lastVisiblePromptId,
          edge: 'bottom'
        }),
        (payload) =>
          canDropOnPromptTreePromptRow(
            props.row.folder,
            props.row.lastVisiblePromptId,
            payload,
            'bottom'
          )
      )}
    onPromptVisibilityChange={setFolderShowingAllPrompts}
  />
{/snippet}

{#snippet promptTreeRowOverlay({ row, rowId }: PromptTreeOverlayRowProps)}
  {@const hoveredEdge = getPromptTreeDropTargetEdge(rowId)}
  {@const testId =
    row.kind === 'folder-prompt-visibility-toggle'
      ? folderPromptVisibilityDropIndicatorTestId(row.folder)
      : row.kind === 'folder-prompt'
        ? folderPromptDropIndicatorTestId(row.promptId)
        : null}

  {#if hoveredEdge && testId}
    <DropIndicator
      {testId}
      insetStart={row.kind === 'prompt-folder' ? '10px' : PROMPT_TREE_CHILD_ROW_CONTENT_INSET}
      edge={hoveredEdge}
    />
  {/if}
{/snippet}

{#snippet bottomSpacerRow()}
  <div aria-hidden="true"></div>
{/snippet}
