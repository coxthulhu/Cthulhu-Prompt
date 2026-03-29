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
    droppable,
    type DroppableOptions
  } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import {
    type PromptDraftRecord,
    promptDraftCollection
  } from '@renderer/data/Collections/PromptDraftCollection'
  import { getPromptDisplayTitle } from '@renderer/data/UiState/PromptFolderScreenData.svelte.ts'
  import {
    getPromptNavigationContext,
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
  import {
    folderIconTestId,
    folderOpenTestId,
    folderPromptDropIndicatorTestId,
    folderPromptTestId,
    folderSettingsDropIndicatorTestId,
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
        kind: 'folder-settings'
        folder: PromptFolder
      }
    | {
        kind: 'folder-prompt'
        folder: PromptFolder
        promptId: string
      }

  type PromptTreeOverlayRow = Extract<PromptTreeRow, { kind: 'folder-settings' | 'folder-prompt' }>
  type PromptTreeOverlayRowProps = VirtualWindowRowComponentProps<PromptTreeOverlayRow>

  let {
    promptFolders,
    folderListState,
    selectedPromptFolderId = null,
    isPromptFoldersScreenActive = false,
    onPromptFolderSelect
  } = $props<{
    promptFolders: PromptFolder[]
    folderListState: FolderListState
    selectedPromptFolderId?: string | null
    isPromptFoldersScreenActive?: boolean
    onPromptFolderSelect: (promptFolderId: string) => void
  }>()

  /*
  import { MoreHorizontal } from 'lucide-svelte'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
  } from '@renderer/common/ui/dropdown-menu'

  let openFolderMenuName = $state<string | null>(null)
  */

  const rowRegistry = defineVirtualWindowRowRegistry<PromptTreeRow>({
    'prompt-folder': {
      estimateHeight: () => 36,
      snippet: promptFolderRow
    },
    'folder-settings': {
      estimateHeight: () => 30,
      snippet: folderSettingsRow,
      overlayRow: {
        snippet: promptTreeRowOverlay
      }
    },
    'folder-prompt': {
      estimateHeight: () => 30,
      overlayRow: {
        snippet: promptTreeRowOverlay
      },
      snippet: folderPromptRow
    }
  })

  const PROMPT_TREE_ROW_CENTER_OFFSET_PX = 14
  let expandedFolderStates = $state<Record<string, boolean>>({})
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let lastTrackedTreeRowId = $state<string | null>(null)
  const promptNavigation = getPromptNavigationContext()
  const workspaceSelection = getWorkspaceSelectionContext()
  let lastWorkspaceId = $state<string | null>(workspaceSelection.selectedWorkspaceId)
  const promptDraftQuery = useLiveQuery(promptDraftCollection) as {
    data: PromptDraftRecord[]
  }

  const promptTreeTitleById = $derived.by(() => {
    const titlesById: Record<string, string> = {}

    for (const promptDraft of promptDraftQuery.data) {
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

  const PROMPT_TREE_CHILD_ROW_CONTENT_INSET = '2.375rem'

  const folderSettingsRowId = (folderId: string): string => `${folderId}:settings`
  const folderPromptRowId = (folderId: string, promptId: string): string =>
    `${folderId}:prompt:${promptId}`
  const promptNavigationPromptRow = (promptId: string): PromptNavigationRow => `prompt:${promptId}`
  const promptTreeDroppableState = createDroppableStateRegistry<string>()

  const getPromptTreeDroppableOptions = (
    rowId: string,
    dropPayload: PromptHandleDropPayload
  ): DroppableOptions => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: dropPayload,
    state: promptTreeDroppableState.getState(rowId)
  })

  const isPromptTreeDropTargetOver = (rowId: string): boolean =>
    promptTreeDroppableState.isOver(rowId)

  const getPromptTreeDropIndicatorTestId = (row: PromptTreeOverlayRow): string =>
    row.kind === 'folder-settings'
      ? folderSettingsDropIndicatorTestId(row.folder)
      : folderPromptDropIndicatorTestId(row.promptId)

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

  const trackedTreeRowId = $derived.by((): string | null => {
    if (!selectedPromptFolderId || !trackedNavigationRow) {
      return null
    }

    return trackedNavigationRow === 'folder-settings'
      ? folderSettingsRowId(selectedPromptFolderId)
      : folderPromptRowId(selectedPromptFolderId, trackedNavigationRow.slice('prompt:'.length))
  })

  const isTreeEntryActive = (folderId: string, row: PromptNavigationRow): boolean => {
    if (
      !isPromptFoldersScreenActive ||
      selectedPromptFolderId !== folderId ||
      !trackedNavigationRow
    ) {
      return false
    }

    return trackedNavigationRow === row
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
        items.push({
          id: folderSettingsRowId(folder.id),
          row: {
            kind: 'folder-settings',
            folder
          }
        })

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

    return items
  })
</script>

<div class="flex min-h-0 flex-1 flex-col">
  {#if folderListState === 'no-workspace'}
    <div class="px-2 text-xs text-muted-foreground/80">Select a Workspace to Get Started</div>
  {:else if folderListState === 'loading'}
    <div class="px-2 flex items-center gap-2 text-xs text-muted-foreground/80">
      <Loader class="size-4 animate-spin" />
      Loading folders...
    </div>
  {:else if folderListState === 'empty'}
    <div class="px-2 text-xs text-muted-foreground/80">Create a Prompt Folder to Get Started</div>
  {:else}
    <div class="flex min-h-0 flex-1 flex-col">
      <SvelteVirtualWindow
        items={virtualItems}
        {rowRegistry}
        rowHeightGridPx={2}
        leftScrollPaddingPx={0}
        rightScrollPaddingPx={0}
        testId="prompt-tree-virtual-window"
        spacerTestId="prompt-tree-virtual-window-spacer"
        bind:scrollToWithinWindowBand
      />
    </div>
  {/if}
</div>

{#snippet promptFolderRow(props)}
  {@const isActive = isPromptFoldersScreenActive && selectedPromptFolderId === props.row.folder.id}
  {@const isDropTargetOver = isPromptTreeDropTargetOver(props.rowId)}

  <div
    use:droppable={getPromptTreeDroppableOptions(props.rowId, {
      kind: 'folder',
      folderId: props.row.folder.id
    })}
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

    <!-- Count and open arrow share one slot; hover/focus swaps visibility. -->
    <div class="sidebarPromptTreeActionSlot">
      <span class="sidebarPromptTreeCountBadge sidebarPromptTreeCountInActionSlot">
        {props.row.folder.promptIds.length}
      </span>
      <button
        type="button"
        aria-label={`Open ${props.row.folder.displayName}`}
        onclick={(event) => handlePromptFolderOpen(props.row.folder.id, event)}
        data-testid={folderOpenTestId(props.row.folder)}
        data-size="default"
        data-active={isActive}
        class="sidebarPromptTreeOpenButton"
      >
        <ArrowRight class="size-4" />
      </button>
    </div>
  </div>

  <!--
  {#snippet folderMenuTrigger({ props: triggerProps })}
    <button
      {...triggerProps}
      type="button"
      aria-label={`More actions for ${props.row.folder.displayName}`}
      class="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground opacity-0 pointer-events-none transition-opacity duration-50 cursor-pointer group-hover/menu-item:opacity-100 group-hover/menu-item:pointer-events-auto group-has-[:focus-visible]/menu-item:opacity-100 group-has-[:focus-visible]/menu-item:pointer-events-auto group-data-[menu-open=true]/menu-item:opacity-100 group-data-[menu-open=true]/menu-item:pointer-events-auto focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <MoreHorizontal class="size-4" />
    </button>
  {/snippet}

  <DropdownMenu
    open={openFolderMenuName === props.row.folder.folderName}
    onOpenChange={(nextOpen) => {
      openFolderMenuName = nextOpen
        ? props.row.folder.folderName
        : openFolderMenuName === props.row.folder.folderName
          ? null
          : openFolderMenuName
    }}
  >
    <DropdownMenuTrigger child={folderMenuTrigger} />
    <DropdownMenuContent side="right" align="center" sideOffset={6}>
      <DropdownMenuItem variant="destructive" class="cursor-pointer">
        Delete Folder
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  -->
{/snippet}

{#snippet folderSettingsRow(props)}
  {@const isActive = isTreeEntryActive(props.row.folder.id, 'folder-settings')}

  <div class="sidebarPromptTreeSettingsRow">
    <button
      use:droppable={getPromptTreeDroppableOptions(props.rowId, {
        kind: 'folder-settings',
        folderId: props.row.folder.id
      })}
      type="button"
      data-testid={folderSettingsTestId(props.row.folder)}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'true' : undefined}
      onclick={(event) =>
        handlePromptTreeEntrySelect(props.row.folder.id, 'folder-settings', event)}
      class="sidebarPromptTreeSettingsButton"
    >
      <Settings
        class="sidebarPromptTreeSettingsIcon"
        data-testid={folderSettingsIconTestId(props.row.folder)}
        aria-hidden="true"
      />
      <span class="sidebarPromptTreeSettingsLabel">Folder Settings</span>
    </button>
  </div>
{/snippet}

{#snippet folderPromptRow(props)}
  {@const isActive = isTreeEntryActive(
    props.row.folder.id,
    promptNavigationPromptRow(props.row.promptId)
  )}

  <div class="sidebarPromptTreeSettingsRow">
    <button
      use:droppable={getPromptTreeDroppableOptions(props.rowId, {
        kind: 'prompt',
        folderId: props.row.folder.id,
        promptId: props.row.promptId
      })}
      type="button"
      data-testid={folderPromptTestId(props.row.promptId)}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'true' : undefined}
      onclick={(event) =>
        handlePromptTreeEntrySelect(
          props.row.folder.id,
          promptNavigationPromptRow(props.row.promptId),
          event
        )}
      class="sidebarPromptTreeSettingsButton"
    >
      <FileText class="sidebarPromptTreeSettingsIcon" aria-hidden="true" />
      <span class="sidebarPromptTreeSettingsLabel"
        >{promptTreeTitleById[props.row.promptId] ??
          getPromptDisplayTitle(props.row.promptId)}</span
      >
    </button>
  </div>
{/snippet}

{#snippet promptTreeRowOverlay({ row, rowId }: PromptTreeOverlayRowProps)}
  {#if isPromptTreeDropTargetOver(rowId)}
    <PromptTreeDropIndicator
      testId={getPromptTreeDropIndicatorTestId(row)}
      insetStart={PROMPT_TREE_CHILD_ROW_CONTENT_INSET}
    />
  {/if}
{/snippet}
