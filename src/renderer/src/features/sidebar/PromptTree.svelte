<script lang="ts">
  import {
    ArrowRight,
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    Loader,
    Settings
  } from 'lucide-svelte'
  import { getPromptDisplayTitle } from '@renderer/data/UiState/PromptFolderScreenData.svelte.ts'
  import {
    lookupPromptFolderPromptTreeActiveRow,
    lookupPromptTreeJumpRequest,
    recordPromptTreeJumpRequest,
    type PromptFolderPromptTreeActiveRow,
    type PromptTreeJumpTarget
  } from '@renderer/data/UiState/PromptFolderDraftUiCache.svelte.ts'
  import type { PromptFolder } from '@shared/PromptFolder'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type ScrollToWithinWindowBand,
    type VirtualWindowItem
  } from '../virtualizer/virtualWindowTypes'

  type FolderListState = 'no-workspace' | 'loading' | 'empty' | 'ready'

  type PromptTreeRow = {
    kind: 'prompt-folder'
    folder: PromptFolder
  } | {
    kind: 'folder-settings'
    folder: PromptFolder
  } | {
    kind: 'folder-prompt'
    folder: PromptFolder
    promptId: string
  }

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
      snippet: folderSettingsRow
    },
    'folder-prompt': {
      estimateHeight: () => 30,
      snippet: folderPromptRow
    }
  })

  const PROMPT_TREE_ROW_CENTER_OFFSET_PX = 14
  let expandedFolderStates = $state<Record<string, boolean>>({})
  let scrollToWithinWindowBand = $state<ScrollToWithinWindowBand | null>(null)
  let promptTreeJumpRequestId = $state(0)
  let lastTrackedTreeRowId = $state<string | null>(null)

  const isFolderExpanded = (folderId: string): boolean => expandedFolderStates[folderId] ?? true

  const toggleFolderExpanded = (folderId: string) => {
    expandedFolderStates = {
      ...expandedFolderStates,
      [folderId]: !isFolderExpanded(folderId)
    }
  }

  const folderSettingsTestId = (folder: PromptFolder): string =>
    `prompt-folder-settings-${folder.folderName.replace(/\s+/g, '')}`

  const folderToggleTestId = (folder: PromptFolder): string =>
    `prompt-folder-toggle-${folder.folderName.replace(/\s+/g, '')}`

  const folderOpenTestId = (folder: PromptFolder): string =>
    `regular-prompt-folder-${folder.folderName.replace(/\s+/g, '')}`

  const folderIconTestId = (folder: PromptFolder): string =>
    `prompt-folder-icon-${folder.folderName.replace(/\s+/g, '')}`

  const folderSettingsIconTestId = (folder: PromptFolder): string =>
    `prompt-folder-settings-icon-${folder.folderName.replace(/\s+/g, '')}`

  const folderPromptTestId = (promptId: string): string => `prompt-folder-prompt-${promptId}`

  const folderSettingsRowId = (folderId: string): string => `${folderId}:settings`
  const folderPromptRowId = (folderId: string, promptId: string): string => `${folderId}:prompt:${promptId}`

  const handlePromptFolderOpen = (promptFolderId: string, event: MouseEvent) => {
    onPromptFolderSelect(promptFolderId)

    const button = event.currentTarget
    if (button instanceof HTMLButtonElement) {
      button.blur()
    }
  }

  const trackedPromptTreeRow = $derived.by((): PromptFolderPromptTreeActiveRow | null => {
    if (!isPromptFoldersScreenActive || !selectedPromptFolderId) {
      return null
    }

    const pendingInitialTreeJumpRequest = lookupPromptTreeJumpRequest(selectedPromptFolderId)
    if (pendingInitialTreeJumpRequest?.mode === 'initial') {
      return pendingInitialTreeJumpRequest.target
    }

    return lookupPromptFolderPromptTreeActiveRow(selectedPromptFolderId)
  })

  const trackedTreeRowId = $derived.by((): string | null => {
    if (!selectedPromptFolderId || !trackedPromptTreeRow) {
      return null
    }

    return trackedPromptTreeRow.kind === 'folder-settings'
      ? folderSettingsRowId(selectedPromptFolderId)
      : folderPromptRowId(selectedPromptFolderId, trackedPromptTreeRow.promptId)
  })

  const isTreeEntryActive = (folderId: string, target: PromptTreeJumpTarget): boolean => {
    if (!isPromptFoldersScreenActive || selectedPromptFolderId !== folderId || !trackedPromptTreeRow) {
      return false
    }

    if (target.kind !== trackedPromptTreeRow.kind) {
      return false
    }

    if (target.kind === 'folder-settings') {
      return true
    }

    if (trackedPromptTreeRow.kind !== 'prompt') {
      return false
    }

    return trackedPromptTreeRow.promptId === target.promptId
  }

  const queuePromptTreeJumpRequest = (
    promptFolderId: string,
    target: PromptTreeJumpTarget,
    mode: 'initial' | 'immediate'
  ) => {
    promptTreeJumpRequestId += 1
    recordPromptTreeJumpRequest(promptFolderId, {
      requestId: promptTreeJumpRequestId,
      mode,
      target
    })
  }

  const handlePromptTreeEntrySelect = (
    promptFolderId: string,
    target: PromptTreeJumpTarget,
    event: MouseEvent
  ) => {
    const isSameFolderActive =
      isPromptFoldersScreenActive && selectedPromptFolderId === promptFolderId

    queuePromptTreeJumpRequest(promptFolderId, target, isSameFolderActive ? 'immediate' : 'initial')

    if (!isSameFolderActive) {
      onPromptFolderSelect(promptFolderId)
    }

    const button = event.currentTarget
    if (button instanceof HTMLButtonElement) {
      button.blur()
    }
  }

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
      expandedFolderStates = {
        ...expandedFolderStates,
        [currentFolderId]: true
      }
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
  {@const isActive =
    isPromptFoldersScreenActive && selectedPromptFolderId === props.row.folder.id}

  <div class="updatedSidebarPromptTreeRow group" data-active={isActive ? 'true' : 'false'}>
    <button
      type="button"
      aria-label={`${isFolderExpanded(props.row.folder.id) ? 'Collapse' : 'Expand'} ${props.row.folder.displayName}`}
      aria-expanded={isFolderExpanded(props.row.folder.id)}
      onclick={() => toggleFolderExpanded(props.row.folder.id)}
      data-testid={folderToggleTestId(props.row.folder)}
      class="updatedSidebarPromptTreeToggleButton"
    >
      <span class="updatedSidebarPromptTreeChevronWrap">
        {#if isFolderExpanded(props.row.folder.id)}
          <ChevronDown class="updatedSidebarPromptTreeChevronIcon" />
        {:else}
          <ChevronRight class="updatedSidebarPromptTreeChevronIcon" />
        {/if}
      </span>
      <Folder class="updatedSidebarPromptTreeFolderIcon" data-testid={folderIconTestId(props.row.folder)} />
      <span class="updatedSidebarPromptTreeFolderLabel">{props.row.folder.displayName}</span>
    </button>

    <!-- Count and open arrow share one slot; hover/focus swaps visibility. -->
    <div class="updatedSidebarPromptTreeActionSlot">
      <span class="updatedSidebarPromptTreeCountBadge updatedSidebarPromptTreeCountInActionSlot">
        {props.row.folder.promptIds.length}
      </span>
      <button
        type="button"
        aria-label={`Open ${props.row.folder.displayName}`}
        onclick={(event) => handlePromptFolderOpen(props.row.folder.id, event)}
        data-testid={folderOpenTestId(props.row.folder)}
        data-size="default"
        data-active={isActive}
        class="updatedSidebarPromptTreeOpenButton"
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
  {@const isActive = isTreeEntryActive(props.row.folder.id, { kind: 'folder-settings' })}

  <div class="updatedSidebarPromptTreeSettingsRow">
    <button
      type="button"
      data-testid={folderSettingsTestId(props.row.folder)}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'true' : undefined}
      onclick={(event) => handlePromptTreeEntrySelect(props.row.folder.id, { kind: 'folder-settings' }, event)}
      class="updatedSidebarPromptTreeSettingsButton"
    >
      <Settings
        class="updatedSidebarPromptTreeSettingsIcon"
        data-testid={folderSettingsIconTestId(props.row.folder)}
        aria-hidden="true"
      />
      <span class="updatedSidebarPromptTreeSettingsLabel">Folder Settings</span>
    </button>
  </div>
{/snippet}

{#snippet folderPromptRow(props)}
  {@const isActive = isTreeEntryActive(props.row.folder.id, {
    kind: 'prompt',
    promptId: props.row.promptId
  })}

  <div class="updatedSidebarPromptTreeSettingsRow">
    <button
      type="button"
      data-testid={folderPromptTestId(props.row.promptId)}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'true' : undefined}
      onclick={(event) =>
        handlePromptTreeEntrySelect(
          props.row.folder.id,
          { kind: 'prompt', promptId: props.row.promptId },
          event
        )}
      class="updatedSidebarPromptTreeSettingsButton"
    >
      <FileText class="updatedSidebarPromptTreeSettingsIcon" aria-hidden="true" />
      <span class="updatedSidebarPromptTreeSettingsLabel">{getPromptDisplayTitle(props.row.promptId)}</span>
    </button>
  </div>
{/snippet}
