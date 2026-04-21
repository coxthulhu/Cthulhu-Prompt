<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteMap } from 'svelte/reactivity'
  import { screens, type ScreenId } from '@renderer/app/screens'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import { Home } from 'lucide-svelte'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { Workspace } from '@shared/Workspace'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import { getWorkspaceFolderName } from '@renderer/features/workspace/workspaceDisplay'
  import CreatePromptFolderDialog from '../prompt-folders/CreatePromptFolderDialog.svelte'
  import PromptTree from './PromptTree.svelte'

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

    for (const workspace of workspaceQuery.data) {
      if (workspace?.id === selectedWorkspaceId) {
        return workspace
      }
    }

    return null
  })

  const promptFolders = $derived.by((): PromptFolder[] => {
    if (!selectedWorkspace) {
      return []
    }

    const promptFolderById = new SvelteMap<string, PromptFolder>()
    for (const promptFolder of promptFolderQuery.data) {
      if (!promptFolder) {
        continue
      }

      promptFolderById.set(promptFolder.id, promptFolder)
    }

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

  const promptFolderCountLabel = $derived.by(() => {
    const folderCount = promptFolders.length
    return `${folderCount} folder${folderCount === 1 ? '' : 's'}`
  })

  const getNavButtonState = (item: NavItem): 'active' | 'enabled' | 'disabled' => {
    if (item.requiresWorkspace && !isWorkspaceReady) {
      return 'disabled'
    }

    return activeScreen === item.id ? 'active' : 'enabled'
  }

  // Keep workspace header text aligned with the mockup's simple end-truncation style.
  const workspaceDisplay = $derived.by(() => {
    if (!workspacePath) {
      return {
        title: 'No Workspace Selected',
        path: 'No Workspace Selected'
      }
    }

    return {
      title: getWorkspaceFolderName(workspacePath),
      path: workspacePath
    }
  })
</script>

<aside
  data-testid="app-sidebar"
  class="sidebarSurface flex h-full w-full flex-col text-sidebar-foreground/80"
>
  <div class="sidebarTopLevelInsetWithInnerPadding pt-2">
    <div class="flex items-start gap-2 border-b border-white/8 pb-2">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center">
        <img
          class="h-8 w-8 object-contain"
          src={appIcon}
          alt="Cthulhu Prompt icon"
          draggable="false"
          ondragstart={(event) => event.preventDefault()}
        />
      </div>
      <div class="min-w-0 flex-1">
        <h1
          data-testid="sidebar-workspace-name"
          class="cthulhuSidebarWorkspaceName truncate text-sm font-semibold tracking-tight"
        >
          {workspaceDisplay.title}
        </h1>
        <p
          class="cthulhuSidebarWorkspacePath truncate pt-0.5 text-xs"
          title={workspacePath ?? undefined}
        >
          {workspaceDisplay.path}
        </p>
      </div>
    </div>
  </div>

  <div class="sidebarTopLevelInsetWithInnerPadding py-3">
    <div class="space-y-3 border-b border-white/8 pb-3">
      <ul class="grid w-full min-w-0 grid-cols-2 gap-2">
        {#each primaryNavItems as item (item.id)}
          {@const Icon = item.icon}
          <li class="group/menu-item relative">
            <IconTextButton
              testId={item.testId}
              icon={Icon}
              text={item.label}
              variant="activatable"
              class="h-9 w-full justify-center px-3"
              state={getNavButtonState(item)}
              onclick={() => onNavigate(item.id)}
            />
          </li>
        {/each}
      </ul>

      {#if secondaryNavItems.length > 0}
        <ul class="flex w-full min-w-0 flex-col gap-2">
          {#each secondaryNavItems as item (item.id)}
            {@const Icon = item.icon}
            <li class="group/menu-item relative">
              <IconTextButton
                testId={item.testId}
                icon={Icon}
                text={item.label}
                variant="activatable"
                class="h-9 w-full justify-start px-3"
                state={getNavButtonState(item)}
                onclick={() => onNavigate(item.id)}
              />
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <div class="sidebarTopLevelInsetWithInnerPadding flex min-h-0 flex-col">
    <div class="mb-2 flex items-center justify-between">
      <div>
        <p class="cthulhuSidebarPromptSectionTitle text-[11px] font-semibold uppercase tracking-[0.18em]">
          Prompts
        </p>
        <p class="cthulhuSidebarPromptSectionCount mt-0.5 text-xs">{promptFolderCountLabel}</p>
      </div>
      {#if isWorkspaceReady}
        <div class="shrink-0">
          <CreatePromptFolderDialog
            {isWorkspaceReady}
            {promptFolders}
            triggerClass="h-8 w-8 min-w-8 justify-center rounded-xl border-0 bg-transparent px-0 py-0 text-zinc-500 hover:bg-white/5 hover:text-white"
            isPromptFolderListLoading={isWorkspaceLoading}
            onCreated={(promptFolderId) => {
              onPromptFolderSelect(promptFolderId)
            }}
          />
        </div>
      {/if}
    </div>
  </div>

  <div
    class="sidebarTopLevelInset flex min-h-0 flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:overflow-hidden"
  >
    <PromptTree
      {promptFolders}
      {folderListState}
      {selectedPromptFolderId}
      isPromptFoldersScreenActive={activeScreen === 'prompt-folders'}
      {onPromptFolderSelect}
    />
  </div>
</aside>

<style>
  .cthulhuSidebarPromptSectionTitle {
    color: var(--ui-secondary-text);
  }

  .cthulhuSidebarPromptSectionCount {
    color: var(--ui-muted-text);
  }

  .cthulhuSidebarWorkspaceName {
    color: var(--ui-normal-text);
  }

  .cthulhuSidebarWorkspacePath {
    color: var(--ui-muted-text);
  }
</style>
