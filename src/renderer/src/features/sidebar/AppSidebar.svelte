<script lang="ts">
  import { screens, type ScreenId } from '@renderer/app/screens'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import { Home, FolderClosed, Loader } from 'lucide-svelte'
  import { skipToken } from '@tanstack/svelte-query'
  import { usePromptFoldersQuery } from '@renderer/api/promptFolders'
  import type { PromptFolder } from '@shared/ipc'
  import CreatePromptFolderDialog from '../prompt-folders/CreatePromptFolderDialog.svelte'
  import SidebarButton from './SidebarButton.svelte'
  import SidebarGroup from './SidebarGroup.svelte'

  let {
    activeScreen,
    isWorkspaceReady = false,
    isDevMode = false,
    workspacePath = null,
    selectedPromptFolder = null,
    onNavigate,
    onPromptFolderSelect
  } = $props<{
    activeScreen: ScreenId
    isWorkspaceReady?: boolean
    isDevMode?: boolean
    workspacePath?: string | null
    selectedPromptFolder?: PromptFolder | null
    onNavigate: (screen: ScreenId) => void
    onPromptFolderSelect: (folder: PromptFolder) => void
  }>()

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

  const promptFoldersQuery = $derived(
    usePromptFoldersQuery(isWorkspaceReady && workspacePath ? workspacePath : skipToken)
  )

  const promptFolders = $derived(promptFoldersQuery.data ?? [])
  const areFoldersLoading = $derived(promptFoldersQuery.isFetching)
  const folderListState = $derived<'no-workspace' | 'loading' | 'empty' | 'ready'>(
    !isWorkspaceReady
      ? 'no-workspace'
      : areFoldersLoading
        ? 'loading'
        : promptFolders.length === 0
          ? 'empty'
          : 'ready'
  )

  // Derive workspace display strings for the sidebar header.
  const workspaceSegments = $derived.by(() =>
    workspacePath ? workspacePath.split(/[\\/]+/).filter(Boolean) : []
  )

  const workspaceSegment = $derived.by(() => {
    const lastIndex = workspaceSegments.length - 1
    return lastIndex >= 0 ? workspaceSegments[lastIndex] : null
  })

  const workspaceTitle = $derived(workspaceSegment ?? 'Cthulhu Prompt')

  // Support middle truncation by splitting the path into a prefix + suffix.
  const workspaceSeparator = $derived.by(() =>
    workspacePath?.includes('\\') ? '\\' : '/'
  )
  const workspacePathPrefix = $derived.by(() =>
    workspaceSegments.length > 1
      ? workspaceSegments.slice(0, -1).join(workspaceSeparator)
      : ''
  )
  const workspacePathSuffix = $derived.by(() =>
    workspaceSegments.length ? workspaceSegments[workspaceSegments.length - 1] : ''
  )
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
        <span class="font-semibold text-sm truncate">{workspaceTitle}</span>
        <span class="text-xs text-muted-foreground flex min-w-0" title={workspacePath ?? undefined}>
          {#if workspacePath}
            <span class="min-w-0 truncate">{workspacePathPrefix}</span>
            {#if workspacePathPrefix}
              <span class="shrink-0">{workspaceSeparator}</span>
            {/if}
            <span class="min-w-0 truncate max-w-[60%]">{workspacePathSuffix}</span>
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
                class="group/menu-item relative"
              >
                <SidebarButton
                  testId={`regular-prompt-folder-${folder.folderName.replace(/\s+/g, '')}`}
                  icon={FolderClosed}
                  label={folder.displayName}
                  active={selectedPromptFolder?.folderName === folder.folderName &&
                    activeScreen === 'prompt-folders'}
                  onclick={() => onPromptFolderSelect(folder)}
                />
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
                {workspacePath}
                onCreated={onPromptFolderSelect}
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
