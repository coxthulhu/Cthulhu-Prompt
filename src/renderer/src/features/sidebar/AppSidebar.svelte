<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import { Home, FolderClosed, Loader, MoreHorizontal } from 'lucide-svelte'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
  } from '@renderer/common/ui/dropdown-menu'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { Workspace } from '@shared/Workspace'
  import CreatePromptFolderDialog from '../prompt-folders/CreatePromptFolderDialog.svelte'
  import SidebarButton from './SidebarButton.svelte'
  import SidebarGroup from './SidebarGroup.svelte'

  let {
    activeScreen,
    isWorkspaceReady = false,
    isWorkspaceLoading = false,
    isDevMode = false,
    workspacePath = null,
    selectedPromptFolderId = null,
    onNavigate,
    onPromptFolderSelect
  } = $props<{
    activeScreen: ScreenId
    isWorkspaceReady?: boolean
    isWorkspaceLoading?: boolean
    isDevMode?: boolean
    workspacePath?: string | null
    selectedPromptFolderId?: string | null
    onNavigate: (screen: ScreenId) => void
    onPromptFolderSelect: (promptFolderId: string) => void
  }>()

  let openFolderMenuName = $state<string | null>(null)
  const workspaceSelection = getWorkspaceSelectionContext()
  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
  }
  const promptFolderQuery = useLiveQuery((q) =>
    q.from({ promptFolder: promptFolderCollection })
  ) as { data: PromptFolder[] }

  type NavItem = {
    id: ScreenId
    label: string
    icon: typeof Home
    requiresWorkspace: boolean
    testId: string
  }

  const navItems = $derived<NavItem[]>(
    Object.entries(screens)
      .filter(([, config]) => config.showInNav && (!config.devOnly || isDevMode))
      .map(([id, config]) => ({
        id: id as ScreenId,
        label: config.label,
        icon: config.icon ?? Home,
        requiresWorkspace: config.requiresWorkspace,
        testId: config.testId
      }))
  )

  const selectedWorkspace = $derived.by(() => {
    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId
    return workspaceQuery.data.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
  })

  const promptFolders = $derived.by((): PromptFolder[] => {
    if (!selectedWorkspace) {
      return []
    }

    const promptFolderById = new Map(
      promptFolderQuery.data.map((promptFolder) => [promptFolder.id, promptFolder])
    )

    return selectedWorkspace.promptFolderIds
      .map((promptFolderId) => promptFolderById.get(promptFolderId))
      .filter((promptFolder): promptFolder is PromptFolder => promptFolder !== undefined)
  })

  const folderListState = $derived<'no-workspace' | 'loading' | 'empty' | 'ready'>(
    isWorkspaceLoading
      ? 'loading'
      : !isWorkspaceReady
      ? 'no-workspace'
      : promptFolders.length === 0
        ? 'empty'
        : 'ready'
  )

  // Support middle truncation by deriving the workspace title + path segments.
  const workspaceDisplay = $derived.by(() => {
    if (!workspacePath) {
      return {
        title: 'Cthulhu Prompt',
        prefix: '',
        suffix: '',
        separator: '/'
      }
    }

    const segments = workspacePath.split(/[\\/]+/).filter(Boolean)
    const separator = workspacePath.includes('\\') ? '\\' : '/'
    const suffix = segments.length ? segments[segments.length - 1] : ''
    const prefix = segments.length > 1 ? segments.slice(0, -1).join(separator) : ''

    return {
      title: suffix || 'Cthulhu Prompt',
      prefix,
      suffix,
      separator
    }
  })
</script>

<aside
  data-sidebar="sidebar"
  data-slot="sidebar-inner"
  class="bg-sidebar text-sidebar-foreground flex h-full w-full flex-col"
>
  <div data-slot="sidebar-header" data-sidebar="header" class="flex flex-col gap-2 p-2">
    <div class="flex items-center gap-2 px-2 py-1">
      <img class="size-8 shrink-0" src={appIcon} alt="Cthulhu Prompt icon" />
      <div class="flex min-w-0 flex-col">
        <span data-testid="sidebar-workspace-name" class="font-semibold text-sm truncate">
          {workspaceDisplay.title}
        </span>
        <span class="text-xs text-muted-foreground flex min-w-0" title={workspacePath ?? undefined}>
          {#if workspacePath}
            <span class="min-w-0 truncate">{workspaceDisplay.prefix}</span>
            {#if workspaceDisplay.prefix}
              <span class="shrink-0">{workspaceDisplay.separator}</span>
            {/if}
            <span class="min-w-0 truncate max-w-[60%]">{workspaceDisplay.suffix}</span>
          {:else}
            No Workspace Selected
          {/if}
        </span>
      </div>
    </div>
  </div>

  <div
    data-slot="sidebar-content"
    data-sidebar="content"
    class="flex min-h-0 flex-1 flex-col overflow-auto group-data-[collapsible=icon]:overflow-hidden"
  >
    <SidebarGroup label="Application">
      <ul data-slot="sidebar-menu" data-sidebar="menu" class="flex w-full min-w-0 flex-col gap-1">
        {#each navItems as item (item.id)}
          {@const Icon = item.icon}
          <li
            data-slot="sidebar-menu-item"
            data-sidebar="menu-item"
            class="group/menu-item relative"
          >
            <SidebarButton
              testId={item.testId}
              icon={Icon}
              label={item.label}
              active={activeScreen === item.id}
              disabled={item.requiresWorkspace && !isWorkspaceReady}
              onclick={() => onNavigate(item.id)}
            />
          </li>
        {/each}
      </ul>
    </SidebarGroup>

    <SidebarGroup label="Prompt Folders">
      <div class="flex flex-col gap-1">
        <ul data-slot="sidebar-menu" data-sidebar="menu" class="flex w-full min-w-0 flex-col gap-1">
          {#if folderListState === 'no-workspace'}
            <li class="px-2 text-xs text-muted-foreground">Select a Workspace to Get Started</li>
          {:else if folderListState === 'loading'}
            <li class="px-2 text-xs text-muted-foreground flex items-center gap-2">
              <Loader class="size-4 animate-spin" />
              Loading folders...
            </li>
          {:else if folderListState === 'ready'}
            {#each promptFolders as folder (folder.folderName)}
              <li
                data-slot="sidebar-menu-item"
                data-sidebar="menu-item"
                data-menu-open={openFolderMenuName === folder.folderName}
                class="group/menu-item relative"
              >
                {#snippet folderMenuTrigger({ props })}
                  <button
                    {...props}
                    type="button"
                    data-sidebar="menu-action"
                    aria-label={`More actions for ${folder.displayName}`}
                    class="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground opacity-0 pointer-events-none transition-opacity duration-50 cursor-pointer group-hover/menu-item:opacity-100 group-hover/menu-item:pointer-events-auto group-has-[:focus-visible]/menu-item:opacity-100 group-has-[:focus-visible]/menu-item:pointer-events-auto group-data-[menu-open=true]/menu-item:opacity-100 group-data-[menu-open=true]/menu-item:pointer-events-auto focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  >
                    <MoreHorizontal class="size-4" />
                  </button>
                {/snippet}
                <SidebarButton
                  testId={`regular-prompt-folder-${folder.folderName.replace(/\s+/g, '')}`}
                  icon={FolderClosed}
                  label={folder.displayName}
                  active={selectedPromptFolderId === folder.id && activeScreen === 'prompt-folders'}
                  class="group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-data-[menu-open=true]/menu-item:bg-sidebar-accent group-data-[menu-open=true]/menu-item:text-sidebar-accent-foreground"
                  onclick={() => onPromptFolderSelect(folder.id)}
                />
                <DropdownMenu
                  open={openFolderMenuName === folder.folderName}
                  onOpenChange={(nextOpen) => {
                    openFolderMenuName = nextOpen
                      ? folder.folderName
                      : openFolderMenuName === folder.folderName
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
              </li>
            {/each}
          {/if}

          {#if isWorkspaceReady}
            <li
              data-slot="sidebar-menu-item"
              data-sidebar="menu-item"
              class="group/menu-item relative"
            >
              <CreatePromptFolderDialog
                {isWorkspaceReady}
                {promptFolders}
                isPromptFolderListLoading={isWorkspaceLoading}
                onCreated={(promptFolderId) => {
                  onPromptFolderSelect(promptFolderId)
                }}
              />
            </li>
          {/if}

          {#if folderListState === 'empty'}
            <li class="px-2 text-xs text-muted-foreground">
              Create a Prompt Folder to Get Started
            </li>
          {/if}
        </ul>
      </div>
    </SidebarGroup>
  </div>

  <div data-slot="sidebar-footer" data-sidebar="footer" class="flex flex-col gap-2 p-2">
    <div class="p-2 text-xs text-muted-foreground">🦑 Made in R'lyeh</div>
  </div>
</aside>
