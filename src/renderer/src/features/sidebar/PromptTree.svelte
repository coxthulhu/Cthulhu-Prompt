<script lang="ts">
  import {
    ArrowRight,
    ChevronDown,
    ChevronRight,
    Folder,
    Loader,
    Settings
  } from 'lucide-svelte'
  import type { PromptFolder } from '@shared/PromptFolder'
  import SvelteVirtualWindow from '../virtualizer/SvelteVirtualWindow.svelte'
  import {
    defineVirtualWindowRowRegistry,
    type VirtualWindowItem
  } from '../virtualizer/virtualWindowTypes'

  type FolderListState = 'no-workspace' | 'loading' | 'empty' | 'ready'

  type PromptTreeRow = {
    kind: 'prompt-folder'
    folder: PromptFolder
  } | {
    kind: 'folder-settings'
    folder: PromptFolder
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
      estimateHeight: () => 24,
      snippet: promptFolderRow
    },
    'folder-settings': {
      estimateHeight: () => 24,
      snippet: folderSettingsRow
    }
  })

  let expandedFolderStates = $state<Record<string, boolean>>({})

  const isFolderExpanded = (folderId: string): boolean => expandedFolderStates[folderId] ?? true

  const toggleFolderExpanded = (folderId: string) => {
    expandedFolderStates = {
      ...expandedFolderStates,
      [folderId]: !isFolderExpanded(folderId)
    }
  }

  const treeRowClass = (isActive: boolean): string =>
    `flex h-6 w-full rounded-none text-left text-[14px] text-sidebar-foreground transition-[color,background-color] duration-50 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-within:ring-2 focus-within:ring-sidebar-ring active:bg-sidebar-accent active:text-sidebar-accent-foreground ${
      isActive
        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
        : ''
    }`

  const treeRowButtonClass =
    'flex h-full items-center border-0 bg-transparent p-0 text-inherit outline-hidden'
  const treeRowToggleButtonClass = `${treeRowButtonClass} min-w-0 flex-1`
  const treeRowChevronCellClass = 'flex h-full w-6 shrink-0 items-center justify-end pr-1'
  const treeRowLabelClass = 'min-w-0 truncate text-left'
  const treeRowToggleLabelWrapClass = 'flex min-w-0 flex-1 items-center gap-1.5 pl-[4px] pr-1'
  const treeRowLeadingIconClass = 'size-4 shrink-0 text-sidebar-foreground/75'
  const treeRowFolderIconClass =
    `${treeRowLeadingIconClass} translate-y-px fill-sidebar-foreground/15`
  const treeRowFolderSettingsIconClass = treeRowFolderIconClass
  const treeRowOpenButtonClass = `${treeRowButtonClass} w-7 shrink-0 justify-center`

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
          id: `${folder.id}:settings`,
          row: {
            kind: 'folder-settings',
            folder
          }
        })
      }
    }

    return items
  })
</script>

<div class="flex min-h-0 flex-1 flex-col">
  {#if folderListState === 'no-workspace'}
    <div class="px-2 text-xs text-muted-foreground">Select a Workspace to Get Started</div>
  {:else if folderListState === 'loading'}
    <div class="px-2 text-xs text-muted-foreground flex items-center gap-2">
      <Loader class="size-4 animate-spin" />
      Loading folders...
    </div>
  {:else if folderListState === 'empty'}
    <div class="px-2 text-xs text-muted-foreground">Create a Prompt Folder to Get Started</div>
  {:else}
    <div class="flex min-h-0 flex-1 flex-col">
      <SvelteVirtualWindow
        items={virtualItems}
        {rowRegistry}
        leftScrollPaddingPx={0}
        rightScrollPaddingPx={0}
        testId="prompt-tree-virtual-window"
        spacerTestId="prompt-tree-virtual-window-spacer"
      />
    </div>
  {/if}
</div>

{#snippet promptFolderRow(props)}
  {@const isActive =
    isPromptFoldersScreenActive && selectedPromptFolderId === props.row.folder.id}

  <div class={treeRowClass(isActive)}>
    <button
      type="button"
      aria-label={`${isFolderExpanded(props.row.folder.id) ? 'Collapse' : 'Expand'} ${props.row.folder.displayName}`}
      aria-expanded={isFolderExpanded(props.row.folder.id)}
      onclick={() => toggleFolderExpanded(props.row.folder.id)}
      data-testid={folderToggleTestId(props.row.folder)}
      class={treeRowToggleButtonClass}
    >
      <span class={treeRowChevronCellClass}>
        {#if isFolderExpanded(props.row.folder.id)}
          <ChevronDown class="size-4 shrink-0" />
        {:else}
          <ChevronRight class="size-4 shrink-0" />
        {/if}
      </span>
      <span class={treeRowToggleLabelWrapClass}>
        <Folder
          class={treeRowFolderIconClass}
          data-testid={folderIconTestId(props.row.folder)}
          aria-hidden="true"
        />
        <span class={treeRowLabelClass}>{props.row.folder.displayName}</span>
      </span>
    </button>

    <button
      type="button"
      aria-label={`Open ${props.row.folder.displayName}`}
      onclick={() => onPromptFolderSelect(props.row.folder.id)}
      data-testid={folderOpenTestId(props.row.folder)}
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size="default"
      data-active={isActive}
      class={treeRowOpenButtonClass}
    >
      <ArrowRight class="size-4 shrink-0" />
    </button>
  </div>

  <!--
  {#snippet folderMenuTrigger({ props: triggerProps })}
    <button
      {...triggerProps}
      type="button"
      data-sidebar="menu-action"
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
  <div class={treeRowClass(false)}>
    <div class={treeRowChevronCellClass} aria-hidden="true"></div>
    <button
      type="button"
      data-testid={folderSettingsTestId(props.row.folder)}
      class={treeRowToggleButtonClass}
    >
      <span class={treeRowToggleLabelWrapClass}>
        <Settings
          class={treeRowFolderSettingsIconClass}
          data-testid={folderSettingsIconTestId(props.row.folder)}
          aria-hidden="true"
        />
        <span class={treeRowLabelClass}>Folder Settings</span>
      </span>
    </button>
  </div>
{/snippet}
