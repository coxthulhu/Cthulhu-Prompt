<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Search } from 'lucide-svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/ConfirmationDialog.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import LoadingOverlay from '@renderer/common/cthulhu-ui/loading/LoadingOverlay.svelte'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { isPromptFolderEmpty } from '@renderer/data/Collections/PromptFolderEntries'
  import { renamePromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
  import { deletePromptFolder } from '@renderer/data/Mutations/WorkspaceMutations'
  import PromptFolderVirtualContent from './PromptFolderVirtualContent.svelte'
  import PromptFolderFindIntegration from './find/PromptFolderFindIntegration.svelte'
  import { createPromptFolderScreenController } from './promptFolderScreenController.svelte.ts'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'
  import PromptFolderNameDialog from './PromptFolderNameDialog.svelte'
  import CreatePromptSubfolderDialog from './CreatePromptSubfolderDialog.svelte'
  import type { PromptFolderDividerTarget } from './promptFolderScreenRows'

  let {
    screenRootFolderId,
    screenMode = PromptFolderScreenMode.Active,
    onScreenModeChange,
    onScreenRootFolderSelect,
    onRootPromptFolderDeleted
  } = $props<{
    screenRootFolderId: string
    screenMode?: PromptFolderScreenMode
    onScreenModeChange: (screenMode: PromptFolderScreenMode) => void
    onScreenRootFolderSelect: (screenRootFolderId: string) => void
    onRootPromptFolderDeleted: () => void
  }>()

  const controller = createPromptFolderScreenController({
    getScreenRootFolderId: () => screenRootFolderId,
    getScreenMode: () => screenMode,
    onScreenRootFolderSelect: (nextScreenRootFolderId) =>
      onScreenRootFolderSelect(nextScreenRootFolderId)
  })

  let didDeleteScreenRootFolder = $state(false)

  // Side effect: persist the last selected row for this folder when the screen unmounts.
  onDestroy(() => {
    if (didDeleteScreenRootFolder) return
    controller.persistActivePromptTreeRow()
  })

  let renamePromptFolderDialog = $state<{ openDialog: (displayName?: string) => void } | null>(null)
  let renamePromptFolderId = $state<string | null>(null)
  let createPromptSubfolderDialog = $state<{
    openDialog: (target: PromptFolderDividerTarget) => void
  } | null>(null)
  let deletePromptFolderId = $state<string | null>(null)

  const renamePromptFolderTarget = $derived(
    controller.promptFolders.find((folder) => folder.id === renamePromptFolderId) ?? null
  )
  // Duplicate folder names only conflict within the same on-disk parent folder.
  const renamePromptFolderSiblings = $derived.by(() => {
    if (!renamePromptFolderTarget) return []

    const parentFolder = controller.promptFolders.find((folder) =>
      folder.entries.some(
        (entry) => entry.kind === 'folder' && entry.id === renamePromptFolderTarget.id
      )
    )
    const siblingIds = new Set(
      parentFolder
        ? parentFolder.entries.filter((entry) => entry.kind === 'folder').map((entry) => entry.id)
        : controller.promptFolders
            .filter(
              (folder) =>
                !controller.promptFolders.some((candidate) =>
                  candidate.entries.some(
                    (entry) => entry.kind === 'folder' && entry.id === folder.id
                  )
                )
            )
            .map((folder) => folder.id)
    )

    return controller.promptFolders.filter((folder) => siblingIds.has(folder.id))
  })

  const openRenamePromptFolderDialog = (promptFolderId: string) => {
    const promptFolder = controller.promptFolders.find((folder) => folder.id === promptFolderId)
    if (!promptFolder) return

    renamePromptFolderId = promptFolderId
    renamePromptFolderDialog?.openDialog(promptFolder.displayName)
  }

  const handleRenamePromptFolder = async (displayName: string): Promise<boolean> => {
    if (!renamePromptFolderTarget) return false

    return await runIpcBestEffort(
      async () => {
        await renamePromptFolder(renamePromptFolderTarget.id, displayName)
        return true
      },
      () => false
    )
  }

  const openCreatePromptSubfolderDialog = (target: PromptFolderDividerTarget) => {
    createPromptSubfolderDialog?.openDialog(target)
  }

  const isEmptyPromptFolder = (promptFolderId: string): boolean => {
    const promptFolder = controller.promptFolders.find((folder) => folder.id === promptFolderId)
    if (!promptFolder) return false
    return isPromptFolderEmpty(promptFolder)
  }

  const performPromptFolderDelete = async (promptFolderId: string): Promise<void> => {
    const workspaceId = controller.workspaceId
    if (!workspaceId) return

    const isRootPromptFolder = promptFolderId === controller.screenRootFolderId
    const parentPromptFolderId = controller.promptFolders.find((folder) =>
      folder.entries.some((entry) => entry.kind === 'folder' && entry.id === promptFolderId)
    )?.id
    deletePromptFolderId = null
    const didDelete = await runIpcBestEffort(
      async () => {
        await deletePromptFolder(workspaceId, promptFolderId)
        return true
      },
      () => false
    )

    if (didDelete && isRootPromptFolder) {
      didDeleteScreenRootFolder = true
      onRootPromptFolderDeleted()
    } else if (didDelete && parentPromptFolderId) {
      controller.handleDeletedPromptFolder(parentPromptFolderId)
    }
  }

  const handleDeletePromptFolder = (promptFolderId: string): void => {
    if (isEmptyPromptFolder(promptFolderId)) {
      void performPromptFolderDelete(promptFolderId)
      return
    }

    deletePromptFolderId = promptFolderId
  }

  const deletePromptFolderTarget = $derived(
    controller.promptFolders.find((folder) => folder.id === deletePromptFolderId) ?? null
  )
</script>

<PromptFolderFindIntegration
  items={controller.findItems}
  scrollToWithinWindowBand={controller.scrollToWithinWindowBandWithManualClear}
  onRevealMatch={controller.handleFindMatchReveal}
>
  {#snippet children(findControls)}
    <main class="relative flex-1 min-h-0 flex flex-col" data-testid="prompt-folder-screen">
      <div
        class="prompt-folder-header-bar flex h-9 shrink-0 items-center justify-between gap-3 px-6"
      >
        {#if controller.isVirtualContentReady}
          <div
            class="prompt-folder-header-breadcrumb flex min-w-0 items-center text-sm font-medium"
          >
            <button
              type="button"
              data-testid="prompt-folder-header-folder"
              class="prompt-folder-header-folder min-w-0 cursor-pointer truncate transition-colors"
              onclick={controller.handleHeaderFolderClick}
            >
              {controller.folderDisplayName}
            </button>
            <span class="prompt-folder-header-separator mx-1 px-2">/</span>
            <button
              type="button"
              data-testid="prompt-folder-header-section"
              class="prompt-folder-header-section cursor-pointer whitespace-nowrap transition-colors"
              onclick={controller.handleHeaderSegmentClick}
            >
              {controller.activeHeaderSection}
            </button>
          </div>

          <IconButton
            icon={Search}
            label="Find in Folder (Control + F)"
            title="Find in Folder (Control + F)"
            size="compact"
            testId="prompt-folder-find-button"
            onclick={findControls.toggleFindDialog}
          />
        {/if}
      </div>

      <div class="flex-1 min-h-0">
        {#if controller.errorMessage}
          <div class="h-full min-h-0 overflow-y-auto pt-6 pl-6">
            <h2 class="text-lg font-semibold mb-4">
              Prompts ({controller.visiblePromptIds.length})
            </h2>
            <p class="mt-6 text-red-500">Error loading prompts: {controller.errorMessage}</p>
          </div>
        {:else if controller.isVirtualContentReady}
          <PromptFolderVirtualContent
            workspaceId={controller.workspaceId}
            screenRootFolderId={controller.screenRootFolderId}
            folderSettingsByFolderId={controller.folderSettingsByFolderId}
            promptEditorSizingConfig={controller.promptEditorSizingConfig}
            promptDraftById={controller.promptDraftById}
            promptMetadataByPromptId={controller.promptMetadataByPromptId}
            promptFolders={controller.promptFolders}
            activeScreenRows={controller.activePromptFolderScreenRows}
            visiblePromptIds={controller.visiblePromptIds}
            activePromptCount={controller.activePromptCount}
            completedPromptCount={controller.completedPromptCount}
            completedPromptOwnerByPromptId={controller.completedPromptOwnerByPromptId}
            {screenMode}
            isCreatingPrompt={controller.isCreatingPrompt}
            settingsSectionExpandedByFolderId={controller.settingsSectionExpandedByFolderId}
            promptsSectionExpandedByFolderId={controller.promptsSectionExpandedByFolderId}
            initialScrollTopPx={controller.initialPromptFolderScrollTopPx}
            scrollToWithinWindowBandForRows={controller.scrollToWithinWindowBandWithManualClear}
            onAddPrompt={controller.handleAddPrompt}
            onAddSubfolder={openCreatePromptSubfolderDialog}
            onDeletePrompt={controller.handleDeletePrompt}
            onDeletePromptFolder={handleDeletePromptFolder}
            onSetPromptStatus={controller.handleSetPromptStatus}
            onMovePromptUp={controller.handleMovePromptUp}
            onMovePromptDown={controller.handleMovePromptDown}
            canMovePrompt={controller.canMovePrompt}
            onPromptTreeDrop={controller.handlePromptTreeDrop}
            onPromptFolderTreeDrop={controller.handlePromptFolderTreeDrop}
            onSettingsFieldChange={controller.handleSettingsFieldChange}
            onSettingsFieldPresenceChange={controller.handleSettingsFieldPresenceChange}
            onScrollToWithinWindowBandChange={controller.setScrollToWithinWindowBand}
            onScrollToAndTrackRowCenteredChange={controller.setScrollToAndTrackRowCentered}
            onScrollApiChange={controller.setScrollApi}
            onViewportMetricsChange={controller.setViewportMetrics}
            onScrollTopChange={controller.handleVirtualScrollTopChange}
            onCenterRowChange={controller.handleVirtualCenterRowChange}
            onUserScroll={controller.handleVirtualUserScroll}
            onSettingsSectionToggle={controller.toggleSettingsSectionExpanded}
            onPromptsSectionToggle={controller.togglePromptsSectionExpanded}
            onRenamePromptFolder={openRenamePromptFolderDialog}
            {onScreenModeChange}
          />
        {/if}
      </div>

      {#if controller.loadingOverlay.isVisible()}
        <LoadingOverlay
          testId="prompt-folder-loading-overlay"
          fadeMs={controller.loadingOverlayFadeMs}
          isFading={controller.loadingOverlay.isFading()}
          message="Loading prompt folder..."
        />
      {/if}
    </main>
  {/snippet}
</PromptFolderFindIntegration>

<CreatePromptSubfolderDialog
  bind:this={createPromptSubfolderDialog}
  workspaceId={controller.workspaceId}
  isWorkspaceReady={controller.workspaceId !== null && controller.screenRootFolder !== null}
  promptFolders={controller.promptFolders}
  isPromptFolderListLoading={false}
  onCreated={controller.handleCreatedSubfolder}
/>

<PromptFolderNameDialog
  bind:this={renamePromptFolderDialog}
  isWorkspaceReady={controller.screenRootFolder !== null}
  promptFolders={renamePromptFolderSiblings}
  isPromptFolderListLoading={false}
  title="Rename Prompt Folder"
  submitText="Rename Folder"
  submittingText="Renaming..."
  submitTestId="rename-prompt-folder-button"
  inputTestId="rename-prompt-folder-name-input"
  errorTestId="rename-prompt-folder-name-error"
  rowDetail="Rename this prompt folder."
  initialDisplayName={renamePromptFolderTarget?.displayName ?? ''}
  unchangedDisplayName={renamePromptFolderTarget?.displayName ?? null}
  unchangedFolderName={renamePromptFolderTarget?.folderName ?? null}
  duplicatePromptFolderId={renamePromptFolderTarget?.id ?? null}
  failureMessage="Failed to rename folder. Please try again."
  onsubmit={handleRenamePromptFolder}
/>

<ConfirmationDialog
  open={deletePromptFolderTarget !== null}
  title="Delete Prompt Folder"
  description={`Are you sure you want to permanently delete “${deletePromptFolderTarget?.displayName ?? ''}” and all of its contents and subfolders?`}
  confirmText="Delete Folder"
  confirmTestId="prompt-folder-confirm-delete-button"
  oncancel={() => {
    deletePromptFolderId = null
  }}
  onconfirm={() => {
    if (deletePromptFolderTarget) {
      void performPromptFolderDelete(deletePromptFolderTarget.id)
    }
  }}
/>

<style>
  .prompt-folder-header-bar {
    border-bottom: 1px solid var(--ui-neutral-muted-border);
  }

  .prompt-folder-header-breadcrumb,
  .prompt-folder-header-folder {
    color: var(--ui-muted-text);
  }

  .prompt-folder-header-folder:hover {
    color: var(--ui-hoverable-text);
  }

  .prompt-folder-header-separator {
    color: var(--ui-neutral-emphasis-border);
  }

  .prompt-folder-header-section {
    color: var(--ui-hoverable-text);
  }

  .prompt-folder-header-section:hover {
    color: var(--ui-normal-text);
  }
</style>
