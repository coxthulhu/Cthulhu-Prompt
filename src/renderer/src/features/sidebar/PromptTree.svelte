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
    isPromptHandleDragPayload,
    resolvePromptHandleDropMove,
    type PromptFolderEntryDragPayload,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload,
    type PromptTreeEntryDragPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import { createPromptDragGhost } from '@renderer/features/drag-drop/promptDragGhost'
  import {
    clearPromptEntryDrag,
    promptEntryDragState,
    startPromptDrag,
    startPromptFolderDrag
  } from '@renderer/features/drag-drop/promptEntryDragState.svelte.ts'
  import {
    type PromptDraftRecord,
    promptDraftCollection
  } from '@renderer/data/Collections/PromptDraftCollection'
  import { promptCollection } from '@renderer/data/Collections/PromptCollection'
  import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
  import { promptTemplateDraftCollection } from '@renderer/data/Collections/PromptTemplateDraftCollection'
  import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
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
  import type { PromptTemplate } from '@shared/PromptTemplate'
  import { PromptFolderScreenMode } from '@renderer/features/prompt-folders/promptFolderScreenMode'
  import {
    type ScrollToWithinWindowBand,
    type VirtualWindowItem,
    type VirtualWindowViewportMetrics
  } from '../virtualizer/virtualWindowTypes'
  import PromptTreeVirtualList, {
    type PromptTreeFolderRowProps,
    type PromptTreePromptRowProps,
    type PromptTreeRow
  } from './PromptTreeVirtualList.svelte'
  import DropIndicator from '../drag-drop/DropIndicator.svelte'
  import PromptDropTarget from '../drag-drop/PromptDropTarget.svelte'
  import PromptTreeFolderRow from './PromptTreeFolderRow.svelte'
  import PromptTreePromptRow from './PromptTreePromptRow.svelte'
  import {
    folderDropIndicatorTestId,
    folderPromptDropIndicatorTestId
  } from './promptTreeTestIds'
  import { collectCompletedPrompts } from '../prompt-folders/promptFolderCompletedPrompts'
  import { moveCategory } from '@renderer/data/Mutations/CategoryMutations'
  import { movePrompt } from '@renderer/data/Mutations/PromptMutations'
  import { movePromptTemplate } from '@renderer/data/Mutations/PromptTemplateMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

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
  const promptTemplateQuery = useLiveQuery(promptTemplateCollection) as {
    data: PromptTemplate[]
  }
  const promptTemplateDraftQuery = useLiveQuery(promptTemplateDraftCollection) as {
    data: Array<{ id: string; title: string; fallbackTitle: string }>
  }
  /** Live category metadata used by the selected root folder's tree projection. */
  const categoryQuery = useLiveQuery(categoryCollection)

  const promptTreeTitleById = $derived.by(() => {
    const titlesById: Record<string, string> = {}

    for (const promptDraft of promptDraftQuery.data) {
      if (!promptDraft) {
        continue
      }

      titlesById[promptDraft.id] = getPromptTitleText(promptDraft)
    }
    for (const templateDraft of promptTemplateDraftQuery.data) {
      titlesById[templateDraft.id] = getPromptTitleText(templateDraft)
    }

    return titlesById
  })
  // Maps prompt IDs to the session-latched edited state displayed by prompt-tree accents.
  const promptEditedById = $derived.by(() =>
    Object.fromEntries(
      promptDraftQuery.data.map((promptDraft) => [promptDraft.id, promptDraft.isEdited])
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
  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)
  const selectedCompletedPrompts = $derived.by(() => {
    if (!screenRootFolder || screenRootFolder.kind === 'template') {
      return []
    }

    if (!isCompletedMode) {
      return []
    }

    return collectCompletedPrompts({
      rootFolder: screenRootFolder,
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
  const PROMPT_TREE_SNAP_VIEWPORT_OUTSET_PX = { top: 8 }
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

  const promptFolderTreeIds = $derived.by((): string[] => {
    if (!screenRootFolder) return []
    return screenRootFolder.categoryOrder.categories.flatMap((group) =>
      group.categoryId && categoryById[group.categoryId] ? [group.categoryId] : []
    )
  })

  const findPromptFolderPath = (
    currentFolder: PromptFolder,
    targetFolderId: string
  ): string[] | null => {
    if (currentFolder.id === targetFolderId) return [currentFolder.id]
    return categoryById[targetFolderId] ? [currentFolder.id, targetFolderId] : null
  }

  const isSameNavigationTarget = (
    left: PromptNavigationTarget,
    right: PromptNavigationTarget
  ): boolean =>
    left.screenRootFolderId === right.screenRootFolderId &&
    left.rowOwnerFolderId === right.rowOwnerFolderId &&
    left.row === right.row

  const getPromptTreeRowId = (target: PromptNavigationTarget): string | null => {
    if (target.row === 'folder-root') {
      return null
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
    snapViewportOutset: PROMPT_TREE_SNAP_VIEWPORT_OUTSET_PX,
    canDrop: (payload, edge) => canDropOnPromptTree(payload, getDropPayload(edge)),
    payload: getDropPayload,
    state: promptTreePromptDroppableState.getState(rowId)
  })

  const canDropOnPromptTree = (
    payload: PromptTreeEntryDragPayload,
    dropPayload: PromptHandleDropPayload
  ): boolean => {
    const destinationFolder = promptFolderById[dropPayload.folderId]
    if (!destinationFolder) return false

    if (!isPromptHandleDragPayload(payload)) {
      return Boolean(dropPayload.categoryId && payload.folderId !== dropPayload.categoryId)
    }

    const sourceFolder = promptFolderById[payload.sourceFolderId]
    if (!sourceFolder) return false
    if (
      payload.contentKind !== destinationFolder.kind ||
      sourceFolder.kind !== destinationFolder.kind
    ) {
      return false
    }

    return (
      resolvePromptHandleDropMove(
        getEntryCategoryId(payload.fromId) ?? 'uncategorized',
        getCategoryEntryIds(getEntryCategoryId(payload.fromId)),
        payload.fromId,
        { ...dropPayload, folderId: dropPayload.categoryId ?? 'uncategorized' },
        getCategoryEntryIds(dropPayload.categoryId ?? null)
      ) !== null
    )
  }

  /** Returns active content IDs in one exact FolderOrderV2 group. */
  const getCategoryEntryIds = (categoryId: string | null): string[] =>
    screenRootFolder?.categoryOrder.categories
      .find((group) => group.categoryId === categoryId)
      ?.entries.filter((entry) => entry.kind === screenRootFolder.kind)
      .map((entry) => entry.id) ?? []

  /** Finds the current category placement of one active tree content row. */
  const getEntryCategoryId = (entryId: string): string | null =>
    screenRootFolder?.categoryOrder.categories.find((group) =>
      group.entries.some((entry) => entry.id === entryId)
    )?.categoryId ?? null

  const getPromptTreeFolderDropPayload = (
    categoryId: string,
    edge: DroppableEdge | null
  ): PromptHandleDropPayload => ({
      folderId: screenRootFolder!.id,
      categoryId,
      targetEntryId: null,
      position: edge === 'top' ? 'before' : 'after'
    })

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
    return categoryById[folderId] ? screenRootFolder?.id ?? folderId : folderId
  }

  const getPromptRowDragOptions = (
    folderId: string,
    promptId: string,
    title: string,
    contentKind: import('@shared/PromptFolder').PromptFolderContentKind
  ): DraggableOptions<PromptHandleDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: {
      fromId: promptId,
      sourceFolderId: folderId,
      contentKind
    },
    createGhost: () => createPromptDragGhost(title, contentKind),
    onDragStart: (payload) => startPromptDrag(payload),
    onDragFinish: ({ sourcePayload, dropPayload }) => {
      clearPromptEntryDrag()
      if (!dropPayload || !screenRootFolder) return
      /** Source category used for exact no-op detection. */
      const sourceCategoryId = getEntryCategoryId(sourcePayload.fromId)
      /** Category-aware logical move resolved from the row edge. */
      const nextMove = resolvePromptHandleDropMove(
        sourceCategoryId ?? 'uncategorized',
        getCategoryEntryIds(sourceCategoryId),
        sourcePayload.fromId,
        { ...dropPayload, folderId: dropPayload.categoryId ?? 'uncategorized' },
        getCategoryEntryIds(dropPayload.categoryId ?? null)
      )
      if (!nextMove) return
      void runIpcBestEffort(async () => {
        const mutation = sourcePayload.contentKind === 'template' ? movePromptTemplate : movePrompt
        await mutation(
          screenRootFolder.id,
          screenRootFolder.id,
          sourcePayload.fromId,
          nextMove.previousEntryId,
          dropPayload.categoryId ?? null
        )
        if (sourceCategoryId !== (dropPayload.categoryId ?? null)) {
          selectMovedPrompt(dropPayload.categoryId ?? screenRootFolder.id, sourcePayload.fromId)
        }
      })
    }
  })

  const getPromptFolderRowDragOptions = (
    categoryId: string,
    displayName: string
  ): DraggableOptions<PromptFolderEntryDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: { folderId: categoryId },
    createGhost: () => createPromptDragGhost(displayName, 'folder'),
    onDragStart: (payload) => {
      startPromptFolderDrag(payload.folderId)
    },
    onDragFinish: ({ sourcePayload, dropPayload }) => {
      clearPromptEntryDrag()
      if (!screenRootFolder || !dropPayload?.categoryId) return
      /** Ordered category IDs excluding the dragged category. */
      const categoryIds = promptFolderTreeIds.filter((id) => id !== sourcePayload.folderId)
      /** Destination category index after removal. */
      const targetIndex = categoryIds.indexOf(dropPayload.categoryId)
      if (targetIndex === -1) return
      /** Category predecessor represented by the selected header edge. */
      const previousCategoryId =
        dropPayload.position === 'after'
          ? dropPayload.categoryId
          : (categoryIds[targetIndex - 1] ?? null)
      void runIpcBestEffort(() =>
        moveCategory(screenRootFolder.id, sourcePayload.folderId, previousCategoryId)
      )
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
      draggedEntry?.kind === 'content' &&
      draggedEntry.folderId === folderId &&
      draggedEntry.contentId === promptId
    )
  }
  const isPromptFolderRowDragging = (folderId: string): boolean => {
    const draggedEntry = promptEntryDragState.draggedEntry
    return draggedEntry?.kind === 'folder' && draggedEntry.folderId === folderId
  }
  const isPromptDragActive = $derived(promptEntryDragState.draggedEntry !== null)
  /** Whether a content drag needs an explicit empty Uncategorized target. */
  const isContentDragActive = $derived(promptEntryDragState.draggedEntry?.kind === 'content')

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
      contentReveal: {
        scrollType: row === 'folder-settings' ? 'align-top' : 'center',
        expandFolderSettings: source !== 'folder-open'
      }
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
                categoryId: null,
                promptId: completedPrompt.promptId,
                indentCount: 0,
                isLastRow: promptIndex === selectedCompletedPrompts.length - 1,
                isNestedPrompt: ownerFolder.id !== screenRootFolder.id
              }
            })
          }
        }
      } else {
        /** Loaded active entries projected in FolderOrderV2 group order. */
        const groups = screenRootFolder.categoryOrder.categories
        /** Uncategorized content shown without a category header. */
        const uncategorizedEntries = groups[0]?.entries.filter((entry) =>
          entry.kind === 'template'
            ? Boolean(templateById[entry.id])
            : Boolean(promptById[entry.id]) &&
              promptById[entry.id]?.status !== PromptStatus.Completed
        ) ?? []
        for (const [entryIndex, entry] of uncategorizedEntries.entries()) {
          items.push({
            id: folderPromptRowId(screenRootFolder.id, entry.id),
            row: {
              kind: 'folder-prompt',
              folder: screenRootFolder,
              categoryId: null,
              promptId: entry.id,
              indentCount: 0,
              isLastRow: entryIndex === uncategorizedEntries.length - 1,
              isNestedPrompt: false
            }
          })
        }
        if (uncategorizedEntries.length === 0 && isContentDragActive && groups.length > 1) {
          items.push({ id: 'uncategorized-drop', row: { kind: 'special', id: 'uncategorized-drop', label: '' } })
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
                promptById[entry.id]?.status !== PromptStatus.Completed
          )
          const isExpanded = getPromptTreeFolderExpandedState(category.id)
          items.push({
            id: folderRootRowId(category.id),
            row: {
              kind: 'folder',
              category,
              rootFolder: screenRootFolder,
              indentCount: 0,
              endsVisibleBranch: groupIndex === groups.length - 2 &&
                (!isExpanded || categoryEntries.length === 0)
            }
          })
          if (!isExpanded) continue
          for (const [entryIndex, entry] of categoryEntries.entries()) {
            items.push({
              id: folderPromptRowId(category.id, entry.id),
              row: {
                kind: 'folder-prompt',
                folder: screenRootFolder,
                categoryId: category.id,
                promptId: entry.id,
                indentCount: 1,
                isLastRow: entryIndex === categoryEntries.length - 1,
                isNestedPrompt: true
              }
            })
          }
        }

        if (uncategorizedEntries.length === 0 && groups.length === 1) {
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

    if (request.payload.row === 'folder-root') {
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
    <div class="flex min-h-0 flex-1 flex-col">
      <PromptTreeVirtualList
        items={virtualItems}
        testId="prompt-tree-virtual-window"
        spacerTestId="prompt-tree-virtual-window-spacer"
        bind:scrollToWithinWindowBand
        bind:viewportMetrics
      >
{#snippet rootFolderRow()}
  <!-- Root navigation lives in the sidebar toolbar, so this shared row renderer stays empty. -->
{/snippet}

{#snippet folderRow(props: PromptTreeFolderRowProps)}
  {@const isSettingsActive = isTreeEntryActive(props.row.category.id, 'folder-settings')}

  <PromptTreeFolderRow
    folder={props.row.category}
    isActive={isSettingsActive}
    isDragging={isPromptFolderRowDragging(props.row.category.id)}
    {isPromptDragActive}
    showDropOverHighlight
    isExpanded={getPromptTreeFolderExpandedState(props.row.category.id)}
    indentCount={props.row.indentCount}
    endsVisibleBranch={props.row.endsVisibleBranch}
    getFolderPromptDroppableOptions={isCompletedMode
      ? undefined
      : () =>
          getPromptTreeDroppableOptions(
            props.rowId,
            'top-and-bottom',
            (edge) => getPromptTreeFolderDropPayload(props.row.category.id, edge)
          )}
    folderDragOptions={!isCompletedMode
      ? getPromptFolderRowDragOptions(props.row.category.id, props.row.category.displayName)
      : undefined}
    onFolderExpandedChange={handlePromptTreeFolderExpandedChange}
    onPromptFolderOpen={handlePromptTreeFolderOpen}
    onFolderSettingsOpen={handlePromptTreeFolderSettingsOpen}
  />
{/snippet}

{#snippet folderPromptRow(props: PromptTreePromptRowProps)}
  {@const isActive = isTreeEntryActive(
    props.row.categoryId ?? props.row.folder.id,
    promptIdToPromptNavigationRow(props.row.promptId)
  )}
  {@const isDragging = isPromptRowDragging(props.row.folder.id, props.row.promptId)}
  {@const promptTitle =
    promptTreeTitleById[props.row.promptId] ?? getPromptDisplayTitle(props.row.promptId)}

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
    getPromptDroppableOptions={isCompletedMode
      ? undefined
      : () =>
          getPromptTreeDroppableOptions(props.rowId, 'top-and-bottom', (edge) => ({
            folderId: props.row.folder.id,
            categoryId: props.row.categoryId,
            targetEntryId: props.row.promptId,
            position: edge === 'top' ? 'before' : 'after'
          }))}
    promptDragOptions={isCompletedMode
      ? undefined
      : getPromptRowDragOptions(
          props.row.folder.id,
          props.row.promptId,
          promptTitle,
          props.row.folder.kind
        )}
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
        : screenRootFolder?.kind === 'template'
          ? 'No templates found in this folder.'
          : 'No prompts found in this folder.'}
    </p>
    {#if !isCompletedMode}
      <p class="mt-2">
        Click the Add {screenRootFolder?.kind === 'template' ? 'Template' : 'Prompt'} button to
        create your first {screenRootFolder?.kind === 'template' ? 'template' : 'prompt'}.
      </p>
    {/if}
  </div>
{/snippet}

{#snippet specialRow()}
  {#if screenRootFolder && isContentDragActive}
    <PromptDropTarget
      getOptions={() =>
        getPromptTreeDroppableOptions('uncategorized-drop', 'none', () => ({
          folderId: screenRootFolder.id,
          categoryId: null,
          targetEntryId: null,
          position: 'after'
        }))}
      class="h-full"
      data-testid="prompt-tree-uncategorized-drop-target"
    >
      <div class="h-full" aria-hidden="true"></div>
    </PromptDropTarget>
  {/if}
{/snippet}

{#snippet promptTreeFolderRowOverlay({ row, rowId }: PromptTreeFolderRowProps)}
  {@const hoveredEdge = getPromptTreeDropTargetEdge(rowId)}

  {#if hoveredEdge}
    <DropIndicator
      testId={folderDropIndicatorTestId(row.category)}
      insetStart={getPromptTreeDropIndicatorInset(
        row.indentCount + (hoveredEdge === 'bottom' ? 1 : 0)
      )}
      edge={hoveredEdge}
    />
  {/if}
{/snippet}

{#snippet promptTreeRowOverlay({ row, rowId }: PromptTreePromptRowProps)}
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
  <div class="h-full" style={`height:${props.rowHeightPx}px;`} aria-hidden="true"></div>
{/snippet}

      </PromptTreeVirtualList>
    </div>
  {/if}
</div>
