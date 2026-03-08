<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import { Home } from 'lucide-svelte'
  import { FileDirectory24, FileDirectoryFill24 } from 'svelte-octicons'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { Workspace } from '@shared/Workspace'
  import CreatePromptFolderDialog from '../prompt-folders/CreatePromptFolderDialog.svelte'
  import PromptTree from './PromptTree.svelte'
  import SidebarButton from './SidebarButton.svelte'

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
  const primaryNavItems = $derived.by(() =>
    navItems.filter((item) => item.id === 'home' || item.id === 'settings')
  )
  const secondaryNavItems = $derived.by(() =>
    navItems.filter((item) => item.id !== 'home' && item.id !== 'settings')
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

  // Keep workspace header text aligned with the mockup's simple end-truncation style.
  const workspaceDisplay = $derived.by(() => {
    if (!workspacePath) {
      return {
        title: 'No Workspace Selected',
        path: 'No Workspace Selected'
      }
    }

    const segments = workspacePath.split(/[\\/]+/).filter(Boolean)
    const title = segments.length ? segments[segments.length - 1] : workspacePath

    return {
      title,
      path: workspacePath
    }
  })
</script>

<aside
  data-sidebar="sidebar"
  data-slot="sidebar-inner"
  class="updatedSidebarSurface flex h-full w-full flex-col text-sidebar-foreground/80"
>
  <div
    data-slot="sidebar-header"
    data-sidebar="header"
    class="flex items-start gap-2 border-b border-white/8 px-2 pb-4 pt-2"
  >
    <div class="flex h-10 w-10 shrink-0 items-center justify-center">
      <img class="h-8 w-8 object-contain" src={appIcon} alt="Cthulhu Prompt icon" />
    </div>
    <div class="min-w-0 flex-1">
      <h1 data-testid="sidebar-workspace-name" class="truncate text-sm font-semibold tracking-tight text-zinc-100">
        {workspaceDisplay.title}
      </h1>
      <p class="truncate pt-0.5 text-xs text-zinc-500" title={workspacePath ?? undefined}>
        {workspaceDisplay.path}
      </p>
    </div>
  </div>

  <div class="space-y-3 px-2 py-3">
    <ul data-slot="sidebar-menu" data-sidebar="menu" class="grid w-full min-w-0 grid-cols-2 gap-2">
      {#each primaryNavItems as item (item.id)}
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
            builderProps={{ 'aria-label': item.label, title: item.label }}
            class="updatedSidebarTopNavButton updatedSidebarTopNavButtonCentered"
            active={activeScreen === item.id}
            disabled={item.requiresWorkspace && !isWorkspaceReady}
            onclick={() => onNavigate(item.id)}
          />
        </li>
      {/each}
    </ul>

    {#if secondaryNavItems.length > 0}
      <ul
        data-slot="sidebar-menu"
        data-sidebar="menu"
        class="flex w-full min-w-0 flex-col gap-2"
      >
        {#each secondaryNavItems as item (item.id)}
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
              class="updatedSidebarTopNavButton"
              active={activeScreen === item.id}
              disabled={item.requiresWorkspace && !isWorkspaceReady}
              onclick={() => onNavigate(item.id)}
            />
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="mx-2 my-2 border-t border-[#222225]" aria-hidden="true"></div>

  <div
    data-slot="sidebar-content"
    data-sidebar="content"
    class="flex min-h-0 flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:overflow-hidden"
  >
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="mb-px flex h-[22px] shrink-0 items-center justify-between gap-2 px-2 text-[14px] font-normal text-sidebar-foreground/80">
        <span class="min-w-0 flex items-center gap-1.5 truncate">
          <span class="relative size-4 shrink-0" aria-hidden="true">
            <FileDirectoryFill24 class="absolute inset-0 size-4 fill-sidebar-foreground/15" />
            <FileDirectory24 class="absolute inset-0 size-4 fill-sidebar-foreground/75" />
          </span>
          <span class="truncate">Prompts</span>
        </span>
        {#if isWorkspaceReady}
          <div class="shrink-0">
            <CreatePromptFolderDialog
              {isWorkspaceReady}
              {promptFolders}
              isPromptFolderListLoading={isWorkspaceLoading}
              onCreated={(promptFolderId) => {
                onPromptFolderSelect(promptFolderId)
              }}
            />
          </div>
        {/if}
      </div>

      <PromptTree
        {promptFolders}
        {folderListState}
        {selectedPromptFolderId}
        isPromptFoldersScreenActive={activeScreen === 'prompt-folders'}
        {onPromptFolderSelect}
      />
    </div>
  </div>

  <div data-slot="sidebar-footer" data-sidebar="footer" class="flex flex-col gap-2 p-2">
    <div class="p-2 text-xs text-muted-foreground">🦑 Made in R'lyeh</div>
  </div>
</aside>
