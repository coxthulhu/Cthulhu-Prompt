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
  import { promptCollection } from '@renderer/data/Collections/PromptCollection'
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
    lookupWorkspacePersistedPromptFolderPromptTreeExpandedState,
    setPromptFolderPromptTreeExpandedStateWithAutosave,
    setPromptFolderPromptTreeEntryIdWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { Prompt } from '@shared/Prompt'
  import { PromptFolderScreenMode } from '@renderer/features/prompt-folders/promptFolderScreenMode'
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
  import { folderPromptDropIndicatorTestId } from './promptTreeTestIds'

  type FolderListState = 'no-workspace' | 'loading' | 'empty' | 'ready'

  type PromptTreeRow =
    | {
        kind: 'folder'
        folder: PromptFolder
        indentCount: number
        isLastRow: boolean
        isSubfolder: boolean
      }
    | {
        kind: 'folder-prompt'
        folder: PromptFolder
        promptId: string
        indentCount: number
        isLastRow: boolean
        isNestedPrompt: boolean
      }
    | {
        kind: 'empty-state'
      }
    | {
        kind: 'bottom-spacer'
      }

  type PromptTreeOverlayRow = Extract<PromptTreeRow, { kind: 'folder-prompt' }>
  type PromptTreeOverlayRowProps = VirtualWindowRowComponentProps<PromptTreeOverlayRow>

  let {
    promptFolders,
    folderListState,
    screenRootFolderId = null,
    expandAllRequestVersion = 0,
    collapseAllRequestVersion = 0,
    isPromptFoldersScreenActive = false,
    screenMode = PromptFolderScreenMode.Active,
    onAllPromptFoldersCollapsedChange,
    onScreenRootFolderSelect
  } = $props<{
    promptFolders: PromptFolder[]
    folderListState: FolderListState
    screenRootFolderId?: string | null
    expandAllRequestVersion?: number
    collapseAllRequestVersion?: number
    isPromptFoldersScreenActive?: boolean
    screenMode?: PromptFolderScreenMode
    onAllPromptFoldersCollapsedChange: (isCollapsed: boolean) => void
    onScreenRootFolderSelect: (screenRootFolderId: string) => void
  }>()

  const PROMPT_TREE_ROW_EMPTY_BLOCK_SPACE_PX = 1
  const PROMPT_TREE_FOLDER_ROW_CONTENT_HEIGHT_PX = 30
  const PROMPT_TREE_PROMPT_ROW_CONTENT_HEIGHT_PX = 30
  const PROMPT_TREE_FOLDER_ROW_HEIGHT_PX =
    PROMPT_TREE_FOLDER_ROW_CONTENT_HEIGHT_PX + PROMPT_TREE_ROW_EMPTY_BLOCK_SPACE_PX * 2
  const PROMPT_TREE_PROMPT_ROW_HEIGHT_PX =
    PROMPT_TREE_PROMPT_ROW_CONTENT_HEIGHT_PX + PROMPT_TREE_ROW_EMPTY_BLOCK_SPACE_PX * 2

  const rowRegistry = defineVirtualWindowRowRegistry<PromptTreeRow>({
    folder: {
      estimateHeight: () => PROMPT_TREE_FOLDER_ROW_HEIGHT_PX,
      centerRowEligible: true,
      snippet: folderRow
    },
    'folder-prompt': {
      estimateHeight: () => PROMPT_TREE_PROMPT_ROW_HEIGHT_PX,
      overlayRow: {
        snippet: promptTreeRowOverlay
      },
      snippet: folderPromptRow
    },
    'empty-state': {
      estimateHeight: () => 86,
      snippet: emptyStateRow
    },
    'bottom-spacer': {
      estimateHeight: () => PROMPT_TREE_FOLDER_ROW_HEIGHT_PX,
      snippet: bottomSpacerRow
    }
  })

  const PROMPT_TREE_ROW_CENTER_OFFSET_PX = 14
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let lastTrackedTreeRowId = $state<string | null>(null)
  let lastTrackedTreeSelectionVersion = $state(0)
  let lastExpandAllRequestVersion = $state(0)
  let lastCollapseAllRequestVersion = $state(0)
  let promptTreeExpandedStates = $state<Record<string, boolean>>({})
  const promptNavigation = getPromptNavigationContext()
  const workspaceSelection = getWorkspaceSelectionContext()
  const promptDraftQuery = useLiveQuery(promptDraftCollection) as {
    data: PromptDraftRecord[]
  }
  const promptQuery = useLiveQuery(promptCollection) as {
    data: Prompt[]
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
  const getPromptIdsForFolder = (folder: PromptFolder): string[] =>
    folder.entryIds.filter((entryId) => promptById[entryId])
  const selectedCompletedPromptIds = $derived.by((): string[] => {
    if (!screenRootFolder) {
      return []
    }

    if (!isCompletedMode) {
      return []
    }

    return [...screenRootFolder.completedPromptIds].sort((leftPromptId, rightPromptId) => {
      const leftCompletedAt = promptById[leftPromptId]?.completedAt ?? ''
      const rightCompletedAt = promptById[rightPromptId]?.completedAt ?? ''
      return rightCompletedAt.localeCompare(leftCompletedAt)
    })
  })
  const PROMPT_TREE_ROW_CONTENT_INSET = '58px'

  const folderRootRowId = (folderId: string): string => `${folderId}:folder`
  const folderPromptRowId = (folderId: string, promptId: string): string =>
    `${folderId}:prompt:${promptId}`
  const promptTreePromptDroppableState = createDroppableStateRegistry<string>()
  const getPromptTreeExpandedStateKey = (promptFolderId: string): string =>
    `${workspaceSelection.selectedWorkspaceId ?? 'no-workspace'}:${promptFolderId}`

  const getPromptTreeFolderExpandedState = (promptFolderId: string): boolean => {
    const stateKey = getPromptTreeExpandedStateKey(promptFolderId)
    const localState = promptTreeExpandedStates[stateKey]
    if (localState !== undefined) {
      return localState
    }

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (!workspaceId) {
      return true
    }

    return (
      lookupWorkspacePersistedPromptFolderPromptTreeExpandedState(
        workspaceId,
        promptFolderId
      ) ?? true
    )
  }

  const setPromptTreeFolderExpandedState = (
    promptFolderId: string,
    isExpanded: boolean
  ): void => {
    const stateKey = getPromptTreeExpandedStateKey(promptFolderId)
    if (promptTreeExpandedStates[stateKey] === isExpanded) {
      return
    }

    promptTreeExpandedStates = {
      ...promptTreeExpandedStates,
      [stateKey]: isExpanded
    }

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderPromptTreeExpandedStateWithAutosave(
        workspaceId,
        promptFolderId,
        isExpanded
      )
    }
  }

  const collectPromptFolderTreeIds = (promptFolder: PromptFolder): string[] => {
    const folderIds = [promptFolder.id]

    for (const entryId of promptFolder.entryIds) {
      const childFolder = promptFolderById[entryId]
      if (childFolder) {
        folderIds.push(...collectPromptFolderTreeIds(childFolder))
      }
    }

    return folderIds
  }

  const promptFolderTreeIds = $derived.by((): string[] => {
    if (!screenRootFolder) {
      return []
    }

    return collectPromptFolderTreeIds(screenRootFolder)
  })

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

    const promptIds = getPromptIdsForFolder(folder)
    const draggedIndex = promptIds.indexOf(payload.fromId)
    const targetIndex = promptIds.indexOf(promptId)

    // Reject same-folder prompt-row edges that would leave the dragged row in place.
    return !(
      (edge === 'bottom' && targetIndex === draggedIndex - 1) ||
      (edge === 'top' && targetIndex === draggedIndex + 1)
    )
  }

  const canDropOnPromptTreeFolderRow = (
    folder: PromptFolder,
    payload: PromptHandleDragPayload
  ): boolean => {
    if (payload.sourceFolderId !== folder.id) {
      return true
    }

    return getPromptIdsForFolder(folder)[0] !== payload.fromId
  }

  const getPromptTreeDropTargetEdge = (rowId: string): DroppableEdge | null =>
    promptTreePromptDroppableState.edge(rowId)

  const selectMovedPrompt = (destinationRootFolderId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)

    promptNavigation.select({
      screenRootFolderId: destinationRootFolderId,
      rowOwnerFolderId: destinationRootFolderId,
      row,
      source: 'prompt-move',
      forceVersionBump: true
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderPromptTreeEntryIdWithAutosave(
        workspaceId,
        destinationRootFolderId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    onScreenRootFolderSelect(destinationRootFolderId)
  }

  const trackedNavigationRow = $derived.by((): PromptNavigationRow | null => {
    if (!isPromptFoldersScreenActive || !screenRootFolder) {
      return null
    }

    if (promptNavigation.screenRootFolderId !== screenRootFolder.id) {
      return null
    }

    return promptNavigation.selectedRow
  })

  const promptTreePromptDrag = createPromptTreePromptDragController({
    getPromptFolders: () => promptFolders,
    getPromptIdsForFolder,
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
    if (!screenRootFolder || !trackedNavigationRow || !promptNavigation.rowOwnerFolderId) {
      return null
    }

    return trackedNavigationRow === 'folder-settings'
      ? folderRootRowId(promptNavigation.rowOwnerFolderId)
      : folderPromptRowId(
          promptNavigation.rowOwnerFolderId,
          trackedNavigationRow.slice('prompt:'.length)
        )
  })

  const isTreeEntryActive = (rowOwnerFolderId: string, row: PromptNavigationRow): boolean => {
    if (!isPromptFoldersScreenActive || !promptNavigation.selectedRow) {
      return false
    }

    return (
      promptNavigation.screenRootFolderId === screenRootFolder?.id &&
      promptNavigation.rowOwnerFolderId === rowOwnerFolderId &&
      promptNavigation.selectedRow === row
    )
  }

  const isPromptRowDragging = (folderId: string, promptId: string): boolean => {
    const draggedPromptRow = promptDragState.draggedPromptRow
    return draggedPromptRow?.folderId === folderId && draggedPromptRow.promptId === promptId
  }
  const isPromptDragActive = $derived(promptDragState.draggedPromptRow !== null)

  const handlePromptTreeEntrySelect = (
    rowOwnerFolderId: string,
    row: PromptNavigationRow,
    source: 'tree-click' | 'folder-open' = 'tree-click'
  ) => {
    const rootFolderId = screenRootFolder?.id
    if (!rootFolderId) return
    const isSameRootActive = isPromptFoldersScreenActive

    promptNavigation.select({
      screenRootFolderId: rootFolderId,
      rowOwnerFolderId,
      row,
      source,
      forceVersionBump: true
    })

    if (!isSameRootActive) {
      onScreenRootFolderSelect(rootFolderId)
    }
  }

  const handlePromptTreePromptSelect = (promptFolderId: string, promptId: string) => {
    handlePromptTreeEntrySelect(promptFolderId, promptIdToPromptNavigationRow(promptId))
  }

  const handlePromptTreeFolderExpandedChange = (promptFolderId: string, isExpanded: boolean) => {
    setPromptTreeFolderExpandedState(promptFolderId, isExpanded)
  }

  const handlePromptTreeFolderOpen = (promptFolderId: string) => {
    handlePromptTreeEntrySelect(promptFolderId, 'folder-settings', 'folder-open')
  }

  const handlePromptTreeFolderSettingsOpen = (promptFolderId: string) => {
    handlePromptTreeEntrySelect(promptFolderId, 'folder-settings')
  }

  // Side effect: report the current tree collapse state to the sidebar action button.
  $effect(() => {
    const areAllPromptFoldersCollapsed =
      promptFolderTreeIds.length > 0 &&
      promptFolderTreeIds.every(
        (promptFolderId) => !getPromptTreeFolderExpandedState(promptFolderId)
      )

    onAllPromptFoldersCollapsedChange(
      areAllPromptFoldersCollapsed
    )
  })

  // Side effect: expand the selected root folder and every loaded subfolder on header request.
  $effect(() => {
    if (expandAllRequestVersion === lastExpandAllRequestVersion) {
      return
    }

    lastExpandAllRequestVersion = expandAllRequestVersion
    for (const promptFolderId of promptFolderTreeIds) {
      setPromptTreeFolderExpandedState(promptFolderId, true)
    }
  })

  // Side effect: collapse the selected root folder and every loaded subfolder on header request.
  $effect(() => {
    if (collapseAllRequestVersion === lastCollapseAllRequestVersion) {
      return
    }

    lastCollapseAllRequestVersion = collapseAllRequestVersion
    for (const promptFolderId of promptFolderTreeIds) {
      setPromptTreeFolderExpandedState(promptFolderId, false)
    }
  })

  // Side effect: keep the tracked prompt tree row visible while following prompt-folder scroll.
  $effect(() => {
    const nextTrackedRowId = trackedTreeRowId
    const currentFolderId = screenRootFolder?.id ?? null

    if (!scrollToWithinWindowBand) {
      return
    }

    if (!nextTrackedRowId) {
      lastTrackedTreeRowId = null
      return
    }

    if (
      nextTrackedRowId === lastTrackedTreeRowId &&
      promptNavigation.selectionVersion === lastTrackedTreeSelectionVersion
    ) {
      return
    }

    if (!currentFolderId) return

    lastTrackedTreeRowId = nextTrackedRowId
    lastTrackedTreeSelectionVersion = promptNavigation.selectionVersion
    scrollToWithinWindowBand(nextTrackedRowId, PROMPT_TREE_ROW_CENTER_OFFSET_PX, 'minimal')
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptTreeRow>[] => {
    const items: VirtualWindowItem<PromptTreeRow>[] = []

    if (screenRootFolder) {
      const addPromptFolderRows = (
        promptFolder: PromptFolder,
        indentCount: number,
        isLastRow: boolean
      ): void => {
        items.push({
          id: folderRootRowId(promptFolder.id),
          row: {
            kind: 'folder',
            folder: promptFolder,
            indentCount,
            isLastRow,
            isSubfolder: promptFolder.id !== screenRootFolder.id
          }
        })

        if (!getPromptTreeFolderExpandedState(promptFolder.id)) {
          return
        }

        const childEntryIds = promptFolder.entryIds.filter(
          (entryId) => promptById[entryId] || promptFolderById[entryId]
        )

        for (const [entryIndex, entryId] of childEntryIds.entries()) {
          const isLastChild = entryIndex === childEntryIds.length - 1
          const childFolder = promptFolderById[entryId]

          if (childFolder) {
            addPromptFolderRows(childFolder, indentCount + 1, isLastChild)
            continue
          }

          items.push({
            id: folderPromptRowId(promptFolder.id, entryId),
            row: {
              kind: 'folder-prompt',
              folder: promptFolder,
              promptId: entryId,
              indentCount: indentCount + 1,
              isLastRow: isLastChild,
              isNestedPrompt: promptFolder.id !== screenRootFolder.id
            }
          })
        }
      }

      if (isCompletedMode) {
        items.push({
          id: folderRootRowId(screenRootFolder.id),
          row: {
            kind: 'folder',
            folder: screenRootFolder,
            indentCount: 0,
            isLastRow: true,
            isSubfolder: false
          }
        })

        if (getPromptTreeFolderExpandedState(screenRootFolder.id)) {
          if (selectedCompletedPromptIds.length === 0) {
            items.push({
              id: `${screenRootFolder.id}:empty-state`,
              row: {
                kind: 'empty-state'
              }
            })
          } else {
            for (const [promptIndex, promptId] of selectedCompletedPromptIds.entries()) {
              items.push({
                id: folderPromptRowId(screenRootFolder.id, promptId),
                row: {
                  kind: 'folder-prompt',
                  folder: screenRootFolder,
                  promptId,
                  indentCount: 1,
                  isLastRow: promptIndex === selectedCompletedPromptIds.length - 1,
                  isNestedPrompt: false
                }
              })
            }
          }
        }
      } else {
        addPromptFolderRows(screenRootFolder, 0, true)

        if (getPromptTreeFolderExpandedState(screenRootFolder.id) && items.length === 1) {
          items.push({
            id: `${screenRootFolder.id}:empty-state`,
            row: {
              kind: 'empty-state'
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
        overlayScrollbar
        leftScrollPaddingPx={0}
        rightScrollPaddingPx={0}
        testId="prompt-tree-virtual-window"
        spacerTestId="prompt-tree-virtual-window-spacer"
        bind:scrollToWithinWindowBand
      />
    </div>
  {/if}
</div>

{#snippet folderRow(props)}
  {@const isSettingsActive = isTreeEntryActive(props.row.folder.id, 'folder-settings')}

  <PromptTreeFolderRow
    folder={props.row.folder}
    isActive={isSettingsActive}
    {isSettingsActive}
    {isPromptDragActive}
    isExpanded={getPromptTreeFolderExpandedState(props.row.folder.id)}
    indentCount={props.row.indentCount}
    isLastRow={props.row.isLastRow}
    getFolderPromptDroppableOptions={isCompletedMode || props.row.isSubfolder
      ? undefined
      : () =>
          getPromptTreeDroppableOptions(
            props.rowId,
            'none',
            () => ({
              kind: 'folder',
              folderId: props.row.folder.id
            }),
            (payload) => canDropOnPromptTreeFolderRow(props.row.folder, payload)
          )}
    onFolderExpandedChange={handlePromptTreeFolderExpandedChange}
    onPromptFolderOpen={handlePromptTreeFolderOpen}
    onFolderSettingsOpen={handlePromptTreeFolderSettingsOpen}
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
    indentCount={props.row.indentCount}
    isLastRow={props.row.isLastRow}
    getPromptDroppableOptions={isCompletedMode || props.row.isNestedPrompt
      ? undefined
      : () =>
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
    promptDragOptions={isCompletedMode || props.row.isNestedPrompt
      ? undefined
      : getPromptRowDragOptions(props.row.folder.id, props.row.promptId, promptTitle)}
    onPromptSelect={handlePromptTreePromptSelect}
  />
{/snippet}

{#snippet emptyStateRow()}
  <div
    class="sidebarPromptTreeEmptyState px-2 py-2 text-center"
    data-testid="prompt-tree-empty-state"
  >
    <p class="sidebarPromptTreeEmptyTitle">
      {isCompletedMode ? 'No completed prompts found in this folder' : 'No prompts found in this folder.'}
    </p>
    {#if !isCompletedMode}
      <p class="mt-2">Click the Add Prompt button to create your first prompt.</p>
    {/if}
  </div>
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
