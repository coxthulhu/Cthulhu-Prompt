<script lang="ts">
  import { ChevronDown, Loader } from 'lucide-svelte'
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
    }
  })

  const virtualItems = $derived.by((): VirtualWindowItem<PromptTreeRow>[] =>
    promptFolders.map((folder) => ({
      id: folder.id,
      row: {
        kind: 'prompt-folder',
        folder
      }
    }))
  )
</script>

<div class="-mx-2 flex min-h-0 flex-1 flex-col">
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
  <button
    type="button"
    onclick={() => onPromptFolderSelect(props.row.folder.id)}
    data-testid={`regular-prompt-folder-${props.row.folder.folderName.replace(/\s+/g, '')}`}
    data-slot="sidebar-menu-button"
    data-sidebar="menu-button"
    data-size="default"
    data-active={isPromptFoldersScreenActive && selectedPromptFolderId === props.row.folder.id}
    class="h-6 w-full overflow-hidden rounded-none border-0 bg-transparent p-0 text-left text-[14px] leading-none text-sidebar-foreground cursor-pointer outline-hidden ring-sidebar-ring transition-[color,background-color] duration-50 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
  >
    <div class="flex h-full w-full items-center gap-2 pl-3 pr-0">
      <ChevronDown class="size-3.5 shrink-0" />
      <span class="truncate">{props.row.folder.displayName}</span>
    </div>
  </button>

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
