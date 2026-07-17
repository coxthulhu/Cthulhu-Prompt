<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteSet } from 'svelte/reactivity'
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
    isPromptHandleDragPayload,
    resolvePromptHandleDropMove,
    type PromptFolderEntryDragPayload,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload,
    type PromptTreeEntryDragPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import { resolvePromptFolderEntryDropMove } from '@renderer/features/drag-drop/promptFolderEntryDrag'
  import { createPromptDragGhost } from '@renderer/features/drag-drop/promptDragGhost'
  import {
    clearPromptEntryDrag,
    promptEntryDragState,
    startPromptFolderDrag
  } from '@renderer/features/drag-drop/promptEntryDragState.svelte.ts'
  import {
    type PromptDraftRecord,
    promptDraftCollection
  } from '@renderer/data/Collections/PromptDraftCollection'
  import { promptCollection } from '@renderer/data/Collections/PromptCollection'
  import { getPromptFolderActiveEntryIds } from '@renderer/data/Collections/PromptFolderEntries'
  import { getPromptDisplayTitle } from '@renderer/data/UiState/PromptFolderScreenData.svelte.ts'
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
    lookupWorkspacePersistedPromptFolderPromptTreeExpandedState,
    setPromptFolderPromptTreeExpandedStateWithAutosave,
    setPromptFolderPromptTreeEntryIdWithAutosave
  } from '@renderer/data/UiState/WorkspacePersistenceAutosave.svelte.ts'
  import type { PromptFolder } from '@shared/PromptFolder'
  import { PromptStatus, type Prompt } from '@shared/Prompt'
  import { PromptFolderScreenMode } from '@renderer/features/prompt-folders/promptFolderScreenMode'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem,
    type VirtualWindowRowComponentProps,
    type VirtualWindowViewportMetrics
  } from '../virtualizer/virtualWindowTypes'
  import DropIndicator from '../drag-drop/DropIndicator.svelte'
  import PromptDropTarget from '../drag-drop/PromptDropTarget.svelte'
  import { createPromptTreePromptDragController } from './promptTreeDrag'
  import PromptTreeFolderRow from './PromptTreeFolderRow.svelte'
  import PromptTreePromptRow from './PromptTreePromptRow.svelte'
  import {
    folderDropIndicatorTestId,
    folderPromptDropIndicatorTestId,
    promptTreeRootFolderDropIndicatorTestId,
    promptTreeRootFolderTestId,
    promptTreeBottomSpacerDropIndicatorTestId,
    promptTreeBottomSpacerDropTargetTestId
  } from './promptTreeTestIds'
  import { collectCompletedPrompts } from '../prompt-folders/promptFolderCompletedPrompts'
  import { movePromptFolder } from '@renderer/data/Mutations/WorkspaceMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

  type FolderListState = 'no-workspace' | 'loading' | 'empty' | 'ready'
  type PromptTreeBulkExpansionRequest = {
    screenRootFolderId: string
    isExpanded: boolean
  }

  type PromptTreeRow =
    | {
        kind: 'root-folder'
        folder: PromptFolder
      }
    | {
        kind: 'folder'
        folder: PromptFolder
        parentFolder: PromptFolder | null
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

  type PromptTreeFolderOverlayRow = Extract<PromptTreeRow, { kind: 'folder' }>
  type PromptTreeFolderOverlayRowProps = VirtualWindowRowComponentProps<PromptTreeFolderOverlayRow>
  type PromptTreeRootFolderOverlayRow = Extract<PromptTreeRow, { kind: 'root-folder' }>
  type PromptTreeRootFolderOverlayRowProps =
    VirtualWindowRowComponentProps<PromptTreeRootFolderOverlayRow>
  type PromptTreePromptOverlayRow = Extract<PromptTreeRow, { kind: 'folder-prompt' }>
  type PromptTreePromptOverlayRowProps = VirtualWindowRowComponentProps<PromptTreePromptOverlayRow>
  type PromptTreeBottomSpacerOverlayRow = Extract<PromptTreeRow, { kind: 'bottom-spacer' }>
  type PromptTreeBottomSpacerOverlayRowProps =
    VirtualWindowRowComponentProps<PromptTreeBottomSpacerOverlayRow>

  let {
    promptFolders,
    folderListState,
    screenRootFolderId = null,
    expansionRequests,
    isPromptFoldersScreenActive = false,
    screenMode = PromptFolderScreenMode.Active,
    onAllPromptFoldersCollapsedChange,
    onScreenRootFolderSelect
  } = $props<{
    promptFolders: PromptFolder[]
    folderListState: FolderListState
    screenRootFolderId?: string | null
    expansionRequests: ConsumableRequestCoordinator<PromptTreeBulkExpansionRequest>
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
    'root-folder': {
      estimateHeight: () => PROMPT_TREE_FOLDER_ROW_HEIGHT_PX,
      centerRowEligible: true,
      overlayRow: {
        snippet: promptTreeRootFolderRowOverlay
      },
      snippet: rootFolderRow
    },
    folder: {
      estimateHeight: () => PROMPT_TREE_FOLDER_ROW_HEIGHT_PX,
      centerRowEligible: true,
      overlayRow: {
        snippet: promptTreeFolderRowOverlay
      },
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
      overlayRow: {
        snippet: promptTreeBottomSpacerRowOverlay
      },
      snippet: bottomSpacerRow
    }
  })

  const PROMPT_TREE_ROW_CENTER_OFFSET_PX = 14
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let viewportMetrics = $state<VirtualWindowViewportMetrics | null>(null)
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
  const selectedCompletedPrompts = $derived.by(() => {
    if (!screenRootFolder) {
      return []
    }

    if (!isCompletedMode) {
      return []
    }

    return collectCompletedPrompts({
      rootFolder: screenRootFolder,
      descendantFolders: promptFolders.filter((folder) => folder.id !== screenRootFolder.id),
      statusByPromptId: Object.fromEntries(
        Object.values(promptById).map((prompt) => [prompt.id, prompt.status])
      ),
      completedAtByPromptId: Object.fromEntries(
        Object.values(promptById).map((prompt) => [prompt.id, prompt.completedAt ?? null])
      )
    })
  })
  const PROMPT_TREE_DROP_INDICATOR_BASE_INSET_PX = 15
  const PROMPT_TREE_INDENT_WIDTH_PX = 12
  const getPromptTreeDropIndicatorInset = (indentCount: number): string =>
    `${PROMPT_TREE_DROP_INDICATOR_BASE_INSET_PX + indentCount * PROMPT_TREE_INDENT_WIDTH_PX}px`

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
      lookupWorkspacePersistedPromptFolderPromptTreeExpandedState(workspaceId, promptFolderId) ??
      true
    )
  }

  const setPromptTreeFolderExpandedState = (promptFolderId: string, isExpanded: boolean): void => {
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
      setPromptFolderPromptTreeExpandedStateWithAutosave(workspaceId, promptFolderId, isExpanded)
    }
  }

  const collectPromptFolderTreeIds = (promptFolder: PromptFolder): string[] => {
    const folderIds = [promptFolder.id]

    for (const entry of promptFolder.entries) {
      if (entry.kind !== 'folder') continue
      const childFolder = promptFolderById[entry.id]
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

    return screenRootFolder.entries.flatMap((entry) => {
      if (entry.kind !== 'folder') return []
      const childFolder = promptFolderById[entry.id]
      return childFolder ? collectPromptFolderTreeIds(childFolder) : []
    })
  })

  const findPromptFolderPath = (
    currentFolder: PromptFolder,
    targetFolderId: string,
    visitedFolderIds = new SvelteSet<string>()
  ): string[] | null => {
    if (visitedFolderIds.has(currentFolder.id)) return null
    visitedFolderIds.add(currentFolder.id)
    if (currentFolder.id === targetFolderId) return [currentFolder.id]
    for (const entry of currentFolder.entries) {
      if (entry.kind !== 'folder') continue
      const childFolder = promptFolderById[entry.id]
      if (!childFolder) continue
      const childPath = findPromptFolderPath(childFolder, targetFolderId, visitedFolderIds)
      if (childPath) return [currentFolder.id, ...childPath]
    }
    return null
  }

  const isSameNavigationTarget = (
    left: PromptNavigationTarget,
    right: PromptNavigationTarget
  ): boolean =>
    left.screenRootFolderId === right.screenRootFolderId &&
    left.rowOwnerFolderId === right.rowOwnerFolderId &&
    left.row === right.row

  const getPromptTreeRowId = (target: PromptNavigationTarget): string => {
    if (target.row === 'folder-root') {
      return folderRootRowId(target.screenRootFolderId)
    }
    if (target.row === 'folder-settings') {
      return folderRootRowId(target.rowOwnerFolderId)
    }
    return folderPromptRowId(
      target.rowOwnerFolderId,
      promptNavigationRowToPersistedEntryId(target.row)
    )
  }

  const getPromptTreeDroppableOptions = (
    rowId: string,
    allowedEdges: DroppableAllowedEdges,
    getDropPayload: (edge: DroppableEdge | null) => PromptHandleDropPayload
  ): DroppableOptions<PromptTreeEntryDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    allowedEdges,
    canDrop: (payload, edge) => canDropOnPromptTree(payload, getDropPayload(edge)),
    payload: getDropPayload,
    state: promptTreePromptDroppableState.getState(rowId)
  })

  const canDropOnPromptTree = (
    payload: PromptTreeEntryDragPayload,
    dropPayload: PromptHandleDropPayload
  ): boolean => {
    if (!isPromptHandleDragPayload(payload)) {
      return (
        resolvePromptFolderEntryDropMove(
          promptFolders,
          getPromptFolderActiveEntryIds,
          payload.folderId,
          dropPayload
        ) !== null
      )
    }

    const sourceFolder = promptFolderById[payload.sourceFolderId]
    const destinationFolder = promptFolderById[dropPayload.folderId]
    if (!sourceFolder || !destinationFolder) return false

    return (
      resolvePromptHandleDropMove(
        sourceFolder.id,
        getPromptFolderActiveEntryIds(sourceFolder),
        payload.fromId,
        dropPayload,
        getPromptFolderActiveEntryIds(destinationFolder)
      ) !== null
    )
  }

  const getPromptTreeFolderDropPayload = (
    folder: PromptFolder,
    parentFolder: PromptFolder | null,
    edge: DroppableEdge | null
  ): PromptHandleDropPayload =>
    parentFolder && edge === 'top'
      ? { folderId: parentFolder.id, targetEntryId: folder.id, position: 'before' }
      : { folderId: folder.id, targetEntryId: null, position: 'after' }

  // The root row's bottom edge inserts before the first entry shown beneath it.
  const getPromptTreeRootStartDropPayload = (): PromptHandleDropPayload => {
    const rootEntryIds = getPromptFolderActiveEntryIds(screenRootFolder!)
    return {
      folderId: screenRootFolder!.id,
      targetEntryId: rootEntryIds[0] ?? null,
      position: rootEntryIds.length > 0 ? 'before' : 'after'
    }
  }

  const getPromptTreeBottomSpacerDropPayload = (): PromptHandleDropPayload => {
    const rootEntryIds = getPromptFolderActiveEntryIds(screenRootFolder!)
    return {
      folderId: screenRootFolder!.id,
      targetEntryId: rootEntryIds[rootEntryIds.length - 1] ?? null,
      position: 'after'
    }
  }

  const getPromptTreeDropTargetEdge = (rowId: string): DroppableEdge | null =>
    promptTreePromptDroppableState.edge(rowId)

  const selectMovedPrompt = (destinationRootFolderId: string, promptId: string): void => {
    const row = promptIdToPromptNavigationRow(promptId)
    const containingRootFolderId = findContainingRootFolderId(destinationRootFolderId)

    promptNavigation.select({
      screenRootFolderId: containingRootFolderId,
      rowOwnerFolderId: destinationRootFolderId,
      row,
      source: 'prompt-move',
      forceRequest: true,
      contentReveal: { scrollType: 'center' },
      treeExpansion: 'owner'
    })

    const workspaceId = workspaceSelection.selectedWorkspaceId
    if (workspaceId) {
      setPromptFolderPromptTreeEntryIdWithAutosave(
        workspaceId,
        destinationRootFolderId,
        promptNavigationRowToPersistedEntryId(row)
      )
    }

    onScreenRootFolderSelect(containingRootFolderId)
  }

  const findContainingRootFolderId = (folderId: string): string => {
    let containingRootId = folderId
    while (true) {
      const parent = promptFolders.find((folder) =>
        folder.entries.some((entry) => entry.kind === 'folder' && entry.id === containingRootId)
      )
      if (!parent) return containingRootId
      containingRootId = parent.id
    }
  }

  const selectMovedPromptFolder = (promptFolderId: string): void => {
    const destinationRootFolderId = findContainingRootFolderId(promptFolderId)
    promptNavigation.select({
      screenRootFolderId: destinationRootFolderId,
      rowOwnerFolderId: promptFolderId,
      row: 'folder-settings',
      source: 'folder-move',
      forceRequest: true,
      contentReveal: { scrollType: 'center', expandFolderSettings: false },
      treeExpansion: 'ancestors'
    })
    onScreenRootFolderSelect(destinationRootFolderId)
  }

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

  const getPromptFolderRowDragOptions = (
    folder: PromptFolder
  ): DraggableOptions<PromptFolderEntryDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: { folderId: folder.id },
    createGhost: () => createPromptDragGhost(folder.displayName, 'folder'),
    onDragStart: (payload) => {
      startPromptFolderDrag(payload.folderId)
    },
    onDragFinish: ({ sourcePayload, dropPayload }) => {
      clearPromptEntryDrag()
      const workspaceId = workspaceSelection.selectedWorkspaceId
      if (!workspaceId) return
      const move = resolvePromptFolderEntryDropMove(
        promptFolders,
        getPromptFolderActiveEntryIds,
        sourcePayload.folderId,
        dropPayload
      )
      if (!move) return

      void runIpcBestEffort(async () => {
        await movePromptFolder(
          workspaceId,
          move.promptFolderId,
          move.previousEntryId,
          move.destinationParentPromptFolderId
        )
        selectMovedPromptFolder(move.promptFolderId)
      })
    }
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
    const draggedEntry = promptEntryDragState.draggedEntry
    return (
      draggedEntry?.kind === 'prompt' &&
      draggedEntry.folderId === folderId &&
      draggedEntry.promptId === promptId
    )
  }
  const isPromptFolderRowDragging = (folderId: string): boolean => {
    const draggedEntry = promptEntryDragState.draggedEntry
    return draggedEntry?.kind === 'folder' && draggedEntry.folderId === folderId
  }
  const isPromptDragActive = $derived(promptEntryDragState.draggedEntry !== null)

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
      forceRequest: true,
      contentReveal:
        screenMode === PromptFolderScreenMode.Active
          ? {
              scrollType: 'center',
              expandFolderSettings: source !== 'folder-open'
            }
          : undefined
    })

    if (!isSameRootActive) {
      onScreenRootFolderSelect(rootFolderId)
    }
  }

  const handlePromptTreePromptSelect = (promptFolderId: string, promptId: string) => {
    handlePromptTreeEntrySelect(promptFolderId, promptIdToPromptNavigationRow(promptId))
  }

  const handlePromptTreeRootFolderSelect = () => {
    if (!screenRootFolder) return
    handlePromptTreeEntrySelect(screenRootFolder.id, 'folder-root')
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

    onAllPromptFoldersCollapsedChange(areAllPromptFoldersCollapsed)
  })

  // Side effect: apply a header expansion request once the selected tree is loaded.
  $effect(() => {
    const request = expansionRequests.pending
    if (
      !request ||
      folderListState !== 'ready' ||
      request.payload.screenRootFolderId !== screenRootFolder?.id
    ) {
      return
    }

    expansionRequests.consume(request, ({ isExpanded }) => {
      for (const promptFolderId of promptFolderTreeIds) {
        setPromptTreeFolderExpandedState(promptFolderId, isExpanded)
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

    const folderPath = findPromptFolderPath(rootFolder, request.payload.rowOwnerFolderId)
    if (!folderPath) return

    promptNavigation.treeExpansionRequests.consume(request, ({ expandPath }) => {
      const folderIds =
        expandPath === 'owner' ? folderPath.slice(1) : folderPath.slice(1, -1)
      for (const promptFolderId of folderIds) {
        setPromptTreeFolderExpandedState(promptFolderId, true)
      }
    })
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptTreeRow>[] => {
    const items: VirtualWindowItem<PromptTreeRow>[] = []

    if (screenRootFolder) {
      items.push({
        id: folderRootRowId(screenRootFolder.id),
        row: {
          kind: 'root-folder',
          folder: screenRootFolder
        }
      })

      const addPromptFolderRows = (
        promptFolder: PromptFolder,
        parentFolder: PromptFolder | null,
        indentCount: number,
        isLastRow: boolean
      ): void => {
        items.push({
          id: folderRootRowId(promptFolder.id),
          row: {
            kind: 'folder',
            folder: promptFolder,
            parentFolder,
            indentCount,
            isLastRow,
            isSubfolder: promptFolder.id !== screenRootFolder.id
          }
        })

        if (!getPromptTreeFolderExpandedState(promptFolder.id)) {
          return
        }

        const childEntries = promptFolder.entries.filter((entry) =>
          entry.kind === 'folder'
            ? Boolean(promptFolderById[entry.id])
            : Boolean(promptById[entry.id]) &&
              promptById[entry.id]?.status !== PromptStatus.Completed
        )

        for (const [entryIndex, entry] of childEntries.entries()) {
          const isLastChild = entryIndex === childEntries.length - 1
          const childFolder = entry.kind === 'folder' ? promptFolderById[entry.id] : null

          if (childFolder) {
            addPromptFolderRows(childFolder, promptFolder, indentCount + 1, isLastChild)
            continue
          }

          items.push({
            id: folderPromptRowId(promptFolder.id, entry.id),
            row: {
              kind: 'folder-prompt',
              folder: promptFolder,
              promptId: entry.id,
              indentCount: indentCount + 1,
              isLastRow: isLastChild,
              isNestedPrompt: promptFolder.id !== screenRootFolder.id
            }
          })
        }
      }

      if (isCompletedMode) {
        if (selectedCompletedPrompts.length === 0) {
          items.push({
            id: `${screenRootFolder.id}:empty-state`,
            row: {
              kind: 'empty-state'
            }
          })
        } else {
          for (const [promptIndex, completedPrompt] of selectedCompletedPrompts.entries()) {
            const ownerFolder = promptFolderById[completedPrompt.ownerFolderId]
            if (!ownerFolder) continue
            items.push({
              id: folderPromptRowId(ownerFolder.id, completedPrompt.promptId),
              row: {
                kind: 'folder-prompt',
                folder: ownerFolder,
                promptId: completedPrompt.promptId,
                indentCount: 0,
                isLastRow: promptIndex === selectedCompletedPrompts.length - 1,
                isNestedPrompt: ownerFolder.id !== screenRootFolder.id
              }
            })
          }
        }
      } else {
        const rootEntries = screenRootFolder.entries.filter((entry) =>
          entry.kind === 'folder'
            ? Boolean(promptFolderById[entry.id])
            : Boolean(promptById[entry.id]) &&
              promptById[entry.id]?.status !== PromptStatus.Completed
        )

        for (const [entryIndex, entry] of rootEntries.entries()) {
          const isLastChild = entryIndex === rootEntries.length - 1
          const childFolder = entry.kind === 'folder' ? promptFolderById[entry.id] : null

          if (childFolder) {
            addPromptFolderRows(childFolder, screenRootFolder, 0, isLastChild)
            continue
          }

          items.push({
            id: folderPromptRowId(screenRootFolder.id, entry.id),
            row: {
              kind: 'folder-prompt',
              folder: screenRootFolder,
              promptId: entry.id,
              indentCount: 0,
              isLastRow: isLastChild,
              isNestedPrompt: false
            }
          })
        }

        if (rootEntries.length === 0) {
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

    const rowId = getPromptTreeRowId(request.payload)
    if (!virtualItems.some((item) => item.id === rowId)) return

    promptNavigation.treeRevealRequests.consume(request, () => {
      scrollToWithinWindowBand!(rowId, PROMPT_TREE_ROW_CENTER_OFFSET_PX, 'minimal')
    })
  })
</script>

<div class="sidebarPromptTree flex min-h-0 flex-1 flex-col">
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
        bind:viewportMetrics
      />
    </div>
  {/if}
</div>

{#snippet rootFolderRow(props)}
  {@const isActive = isTreeEntryActive(props.row.folder.id, 'folder-root')}

  <PromptDropTarget
    getOptions={() => ({
      ...getPromptTreeDroppableOptions(props.rowId, 'bottom', getPromptTreeRootStartDropPayload),
      snap: false
    })}
    class="sidebarPromptTreeSettingsRow sidebarPromptTreeRootRow"
  >
    <button
      type="button"
      data-testid={promptTreeRootFolderTestId}
      data-row-state={isActive ? 'active' : isPromptDragActive ? 'drag-idle' : 'idle'}
      aria-current={isActive ? 'true' : undefined}
      onclick={handlePromptTreeRootFolderSelect}
      class="sidebarPromptTreeSettingsButton sidebarPromptTreeRootButton"
    >
      <span class="sidebarPromptTreeSettingsLabel">{props.row.folder.displayName}</span>
    </button>
  </PromptDropTarget>
{/snippet}

{#snippet promptTreeRootFolderRowOverlay({ rowId }: PromptTreeRootFolderOverlayRowProps)}
  {#if getPromptTreeDropTargetEdge(rowId)}
    <DropIndicator
      testId={promptTreeRootFolderDropIndicatorTestId}
      insetStart={getPromptTreeDropIndicatorInset(0)}
      edge="bottom"
    />
  {/if}
{/snippet}

{#snippet folderRow(props)}
  {@const isSettingsActive = isTreeEntryActive(props.row.folder.id, 'folder-settings')}

  <PromptTreeFolderRow
    folder={props.row.folder}
    isActive={isSettingsActive}
    {isSettingsActive}
    isDragging={isPromptFolderRowDragging(props.row.folder.id)}
    {isPromptDragActive}
    showDropOverHighlight={!props.row.isSubfolder}
    isExpanded={getPromptTreeFolderExpandedState(props.row.folder.id)}
    indentCount={props.row.indentCount}
    isLastRow={props.row.isLastRow}
    getFolderPromptDroppableOptions={isCompletedMode
      ? undefined
      : () =>
          getPromptTreeDroppableOptions(
            props.rowId,
            props.row.parentFolder ? 'top-and-bottom' : 'none',
            (edge) => getPromptTreeFolderDropPayload(props.row.folder, props.row.parentFolder, edge)
          )}
    folderDragOptions={!isCompletedMode && props.row.isSubfolder
      ? getPromptFolderRowDragOptions(props.row.folder)
      : undefined}
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
    getPromptDroppableOptions={isCompletedMode
      ? undefined
      : () =>
          getPromptTreeDroppableOptions(props.rowId, 'top-and-bottom', (edge) => ({
            folderId: props.row.folder.id,
            targetEntryId: props.row.promptId,
            position: edge === 'top' ? 'before' : 'after'
          }))}
    promptDragOptions={isCompletedMode
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
      {isCompletedMode
        ? 'No completed prompts found in this folder'
        : 'No prompts found in this folder.'}
    </p>
    {#if !isCompletedMode}
      <p class="mt-2">Click the Add Prompt button to create your first prompt.</p>
    {/if}
  </div>
{/snippet}

{#snippet promptTreeFolderRowOverlay({ row, rowId }: PromptTreeFolderOverlayRowProps)}
  {@const hoveredEdge = getPromptTreeDropTargetEdge(rowId)}

  {#if hoveredEdge}
    <DropIndicator
      testId={folderDropIndicatorTestId(row.folder)}
      insetStart={getPromptTreeDropIndicatorInset(
        row.indentCount + (hoveredEdge === 'bottom' ? 1 : 0)
      )}
      edge={hoveredEdge}
    />
  {/if}
{/snippet}

{#snippet promptTreeRowOverlay({ row, rowId }: PromptTreePromptOverlayRowProps)}
  {@const hoveredEdge = getPromptTreeDropTargetEdge(rowId)}
  {@const testId = folderPromptDropIndicatorTestId(row.promptId)}

  {#if hoveredEdge}
    <DropIndicator
      {testId}
      insetStart={getPromptTreeDropIndicatorInset(row.indentCount)}
      edge={hoveredEdge}
    />
  {/if}
{/snippet}

{#snippet bottomSpacerRow(props)}
  {#if screenRootFolder && !isCompletedMode}
    <PromptDropTarget
      getOptions={() =>
        getPromptTreeDroppableOptions(props.rowId, 'top', getPromptTreeBottomSpacerDropPayload)}
      class="h-full"
      style={`height:${props.rowHeightPx}px;`}
      data-testid={promptTreeBottomSpacerDropTargetTestId}
    >
      <div class="h-full" aria-hidden="true"></div>
    </PromptDropTarget>
  {:else}
    <div class="h-full" aria-hidden="true"></div>
  {/if}
{/snippet}

{#snippet promptTreeBottomSpacerRowOverlay({ rowId }: PromptTreeBottomSpacerOverlayRowProps)}
  {#if getPromptTreeDropTargetEdge(rowId)}
    <DropIndicator
      testId={promptTreeBottomSpacerDropIndicatorTestId}
      insetStart={getPromptTreeDropIndicatorInset(0)}
      edge="top"
    />
  {/if}
{/snippet}
