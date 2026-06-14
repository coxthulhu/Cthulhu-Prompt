<script lang="ts">
  import { useLiveQuery } from '@tanstack/svelte-db'
  import { SvelteMap } from 'svelte/reactivity'
  import type { ScreenId } from '@renderer/app/screens'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import { ChevronsDownUp, ChevronsUpDown, ExternalLink, Folder, Plus } from 'lucide-svelte'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { PromptFolder } from '@shared/PromptFolder'
  import type { Workspace } from '@shared/Workspace'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/DropdownPopupDetailed.svelte'
  import SelectorButton from '@renderer/common/cthulhu-ui/SelectorButton.svelte'
  import SelectorButtonWithDropdown from '@renderer/common/cthulhu-ui/SelectorButtonWithDropdown.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import { getWorkspaceFolderName } from '@renderer/features/workspace/workspaceDisplay'
  import CreatePromptFolderDialog from '../prompt-folders/CreatePromptFolderDialog.svelte'
  import PromptTree from './PromptTree.svelte'

  type CreatePromptFolderDialogHandle = {
    openDialog: () => void
  }

  let {
    activeScreen,
    isWorkspaceReady = false,
    isWorkspaceLoading = false,
    workspacePath = null,
    selectedPromptFolderId = null,
    onPromptFolderSelect
  } = $props<{
    activeScreen: ScreenId
    isWorkspaceReady?: boolean
    isWorkspaceLoading?: boolean
    workspacePath?: string | null
    selectedPromptFolderId?: string | null
    onPromptFolderSelect: (promptFolderId: string) => void
  }>()

  const workspaceSelection = getWorkspaceSelectionContext()
  const workspaceQuery = useLiveQuery((q) => q.from({ workspace: workspaceCollection })) as {
    data: Workspace[]
  }
  const promptFolderQuery = useLiveQuery((q) =>
    q.from({ promptFolder: promptFolderCollection })
  ) as { data: PromptFolder[] }

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

  const promptFolderSelectorPlaceholder: DropdownPopupDetailedItem = {
    id: 'no-prompt-folders',
    label: 'No prompt folders',
    detail: 'Create one from the menu',
    icon: Folder
  }
  const promptFolderSelectorFooterItem: DropdownPopupDetailedItem = {
    id: 'add-prompt-folder',
    label: 'Add Prompt Folder',
    detail: 'Create a new prompt folder',
    icon: Plus,
    testId: 'sidebar-prompt-folder-dropdown-add-item'
  }
  const promptFolderDropdownItems = $derived.by(
    (): DropdownPopupDetailedItem[] =>
      promptFolders.map((promptFolder) => {
        const promptCount = promptFolder.promptIds.length

        return {
          id: promptFolder.id,
          label: promptFolder.displayName,
          detailParts: [
            `${promptCount} prompt${promptCount === 1 ? '' : 's'}`,
            'Updated recently'
          ],
          icon: Folder,
          testId: `sidebar-prompt-folder-dropdown-item-${promptFolder.id}`
        }
      })
  )
  const selectedPromptFolderDropdownItem = $derived.by((): DropdownPopupDetailedItem => {
    if (promptFolderDropdownItems.length === 0) {
      return promptFolderSelectorPlaceholder
    }

    return (
      promptFolderDropdownItems.find((item) => item.id === selectedPromptFolderId) ??
      promptFolderDropdownItems[0]!
    )
  })
  const promptFolderSelectorState = $derived(
    isWorkspaceReady && !isWorkspaceLoading ? 'enabled' : 'disabled'
  )
  const canTogglePromptFolders = $derived(folderListState === 'ready' && promptFolders.length > 0)
  let expandAllPromptFoldersVersion = $state(0)
  let collapseAllPromptFoldersVersion = $state(0)
  let areAllPromptFoldersCollapsed = $state(true)
  let createPromptFolderDialog = $state<CreatePromptFolderDialogHandle | null>(null)
  const shouldShowExpandAllPromptFolders = $derived(
    promptFolders.length === 0 || areAllPromptFoldersCollapsed
  )
  const promptFolderExpansionActionIcon = $derived(
    shouldShowExpandAllPromptFolders ? ChevronsUpDown : ChevronsDownUp
  )
  const promptFolderExpansionActionLabel = $derived(
    shouldShowExpandAllPromptFolders ? 'Expand All Prompt Folders' : 'Collapse All Prompt Folders'
  )

  const handlePromptFolderExpansionAction = () => {
    if (shouldShowExpandAllPromptFolders) {
      expandAllPromptFoldersVersion += 1
      return
    }

    collapseAllPromptFoldersVersion += 1
  }

  const openWorkspaceFolder = () => {
    const targetWorkspacePath = workspacePath
    if (!targetWorkspacePath) return

    // Hand off to the main process so Windows opens the folder in Explorer.
    void runIpcBestEffort(() =>
      ipcInvoke<void, string>('open-workspace-folder', targetWorkspacePath)
    )
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

  const openCreatePromptFolderDialog = () => {
    createPromptFolderDialog?.openDialog()
  }

  const handlePromptFolderDropdownSelect = (item: DropdownPopupDetailedItem) => {
    if (item.id === promptFolderSelectorFooterItem.id) {
      openCreatePromptFolderDialog()
      return
    }

    if (promptFolders.some((promptFolder) => promptFolder.id === item.id)) {
      onPromptFolderSelect(item.id)
    }
  }
</script>

<aside
  data-testid="app-sidebar"
  class="appSidebar flex h-full w-full flex-col text-sidebar-foreground/80"
>
  <div class="sidebarTopLevelInsetWithInnerPadding pt-4 pb-3">
    <div class="flex items-start gap-2">
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
        <div class="cthulhuSidebarWorkspaceTitleRow">
          <h1
            data-testid="sidebar-workspace-name"
            class="cthulhuSidebarWorkspaceName truncate text-sm font-semibold tracking-tight"
          >
            {workspaceDisplay.title}
          </h1>
          {#if workspacePath}
            <IconButton
              icon={ExternalLink}
              label="Open Workspace Folder"
              title="Open Workspace Folder"
              size="tiny"
              baseVariant="muted"
              hoverVariant="glyph"
              testId="sidebar-open-workspace-folder-button"
              class="ml-0.5"
              onclick={openWorkspaceFolder}
            />
          {/if}
        </div>
        <p
          class="cthulhuSidebarWorkspacePath truncate pt-0.5 text-xs"
          title={workspacePath ?? undefined}
        >
          {workspaceDisplay.path}
        </p>
      </div>
    </div>
  </div>
  <Separator />

  <div class="sidebarTopLevelInsetWithInnerPadding py-1">
    {#if folderListState === 'empty'}
      <SelectorButton
        icon={promptFolderSelectorFooterItem.icon}
        text={promptFolderSelectorFooterItem.label}
        detail={promptFolderSelectorFooterItem.detail}
        showChevron={false}
        state={promptFolderSelectorState}
        testId="sidebar-prompt-folder-add-button"
        onclick={openCreatePromptFolderDialog}
      />
    {:else}
      <SelectorButtonWithDropdown
        label="Prompt folder selector"
        items={promptFolderDropdownItems}
        selectedItem={selectedPromptFolderDropdownItem}
        footerItem={promptFolderSelectorFooterItem}
        state={promptFolderSelectorState}
        testId="sidebar-prompt-folder-selector-menu"
        triggerTestId="sidebar-prompt-folder-selector-trigger"
        onselect={handlePromptFolderDropdownSelect}
      />
    {/if}
  </div>
  <Separator />

  <div class="cthulhuSidebarPromptSectionHeader">
    <p class="cthulhuSidebarPromptSectionTitle">Prompts</p>
    {#if isWorkspaceReady}
      <div class="cthulhuSidebarPromptSectionActions">
        <IconButton
          icon={promptFolderExpansionActionIcon}
          label={promptFolderExpansionActionLabel}
          title={promptFolderExpansionActionLabel}
          size="compact"
          disabled={!canTogglePromptFolders}
          testId="toggle-all-prompt-folders-button"
          class="text-[var(--ui-secondary-icon-glyph)] hover:text-[var(--ui-hoverable-icon-glyph)]"
          onclick={handlePromptFolderExpansionAction}
        />
        <CreatePromptFolderDialog
          bind:this={createPromptFolderDialog}
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

  <div
    class="sidebarTopLevelInset flex min-h-0 flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:overflow-hidden"
  >
    <PromptTree
      {promptFolders}
      {folderListState}
      {selectedPromptFolderId}
      expandAllRequestVersion={expandAllPromptFoldersVersion}
      collapseAllRequestVersion={collapseAllPromptFoldersVersion}
      isPromptFoldersScreenActive={activeScreen === 'prompt-folders'}
      onAllPromptFoldersCollapsedChange={(isCollapsed) => {
        areAllPromptFoldersCollapsed = isCollapsed
      }}
      {onPromptFolderSelect}
    />
  </div>
</aside>

<style>
  .cthulhuSidebarPromptSectionTitle {
    margin: 0;
    color: var(--ui-normal-text);
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
  }

  .cthulhuSidebarPromptSectionHeader {
    display: flex;
    min-height: 40px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 8px 0 12px;
  }

  .cthulhuSidebarPromptSectionActions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
  }

  .cthulhuSidebarWorkspaceName {
    min-width: 0;
    color: var(--ui-normal-text);
  }

  .cthulhuSidebarWorkspacePath {
    color: var(--ui-muted-text);
  }

  .cthulhuSidebarWorkspaceTitleRow {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 4px;
  }
</style>
