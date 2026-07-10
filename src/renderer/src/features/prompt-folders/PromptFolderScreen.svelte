<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Search } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import LoadingOverlay from '@renderer/common/cthulhu-ui/loading/LoadingOverlay.svelte'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { renamePromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
  import PromptFolderVirtualContent from './PromptFolderVirtualContent.svelte'
  import PromptFolderFindIntegration from './find/PromptFolderFindIntegration.svelte'
  import { createPromptFolderScreenController } from './promptFolderScreenController.svelte.ts'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'
  import PromptFolderNameDialog from './PromptFolderNameDialog.svelte'

  let { promptFolderId, screenMode = PromptFolderScreenMode.Active, onPromptFolderSelect } = $props<{
    promptFolderId: string
    screenMode?: PromptFolderScreenMode
    onPromptFolderSelect: (promptFolderId: string) => void
  }>()

  const controller = createPromptFolderScreenController({
    getPromptFolderId: () => promptFolderId,
    getScreenMode: () => screenMode,
    onPromptFolderSelect: (nextPromptFolderId) => onPromptFolderSelect(nextPromptFolderId)
  })

  // Side effect: persist the last selected row for this folder when the screen unmounts.
  onDestroy(() => {
    controller.persistActivePromptTreeRow()
  })

  let renamePromptFolderDialog = $state<{ openDialog: (displayName?: string) => void } | null>(
    null
  )

  const openRenamePromptFolderDialog = () => {
    const currentPromptFolder = controller.promptFolder
    if (!currentPromptFolder) return

    renamePromptFolderDialog?.openDialog(currentPromptFolder.displayName)
  }

  const handleRenamePromptFolder = async (displayName: string): Promise<boolean> => {
    const currentPromptFolder = controller.promptFolder
    if (!currentPromptFolder) return false

    return await runIpcBestEffort(
      async () => {
        await renamePromptFolder(currentPromptFolder.id, displayName)
        return true
      },
      () => false
    )
  }
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
              onclick={() => controller.handleHeaderSegmentClick(controller.activeHeaderRowId)}
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
            promptFolderId={controller.promptFolderId}
            folderSettings={controller.folderSettings}
            promptEditorSizingConfig={controller.promptEditorSizingConfig}
            folderDisplayName={controller.folderDisplayName}
            promptDraftById={controller.promptDraftById}
            promptMetadataByPromptId={controller.promptMetadataByPromptId}
            promptFolders={controller.promptFolders}
            activeScreenRows={controller.activePromptFolderScreenRows}
            visiblePromptIds={controller.visiblePromptIds}
            completedPromptCount={controller.completedPromptCount}
            {screenMode}
            isCreatingPrompt={controller.isCreatingPrompt}
            promptFocusRequest={controller.promptFocusRequest}
            isSettingsSectionExpanded={controller.isSettingsSectionExpanded}
            isPromptsSectionExpanded={controller.isPromptsSectionExpanded}
            initialScrollTopPx={controller.initialPromptFolderScrollTopPx}
            initialCenterRowId={controller.initialPromptFolderCenterRowId}
            scrollToWithinWindowBandForRows={controller.scrollToWithinWindowBandWithManualClear}
            onAddPrompt={controller.handleAddPrompt}
            onDeletePrompt={controller.handleDeletePrompt}
            onSetPromptStatus={controller.handleSetPromptStatus}
            onMovePromptUp={controller.handleMovePromptUp}
            onMovePromptDown={controller.handleMovePromptDown}
            onPromptTreeDrop={controller.handlePromptTreeDrop}
            onSettingsFieldChange={controller.handleSettingsFieldChange}
            onScrollToWithinWindowBandChange={controller.setScrollToWithinWindowBand}
            onScrollToAndTrackRowCenteredChange={controller.setScrollToAndTrackRowCentered}
            onScrollApiChange={controller.setScrollApi}
            onViewportMetricsChange={controller.setViewportMetrics}
            onScrollTopChange={controller.handleVirtualScrollTopChange}
            onCenterRowChange={controller.handleVirtualCenterRowChange}
            onUserScroll={controller.handleVirtualUserScroll}
            onInitialCenterRowApplied={controller.handleInitialPromptFolderCenterRowApplied}
            onSettingsSectionToggle={controller.toggleSettingsSectionExpanded}
            onPromptsSectionToggle={controller.togglePromptsSectionExpanded}
            onRenamePromptFolder={openRenamePromptFolderDialog}
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

<PromptFolderNameDialog
  bind:this={renamePromptFolderDialog}
  isWorkspaceReady={controller.promptFolder !== null}
  promptFolders={controller.promptFolders}
  isPromptFolderListLoading={false}
  title="Rename Prompt Folder"
  submitText="Rename Folder"
  submittingText="Renaming..."
  submitTestId="rename-prompt-folder-button"
  inputTestId="rename-prompt-folder-name-input"
  errorTestId="rename-prompt-folder-name-error"
  rowDetail="Rename this prompt folder."
  initialDisplayName={controller.promptFolder?.displayName ?? ''}
  unchangedDisplayName={controller.promptFolder?.displayName ?? null}
  unchangedFolderName={controller.promptFolder?.folderName ?? null}
  duplicatePromptFolderId={controller.promptFolder?.id ?? null}
  failureMessage="Failed to rename folder. Please try again."
  onsubmit={handleRenamePromptFolder}
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
