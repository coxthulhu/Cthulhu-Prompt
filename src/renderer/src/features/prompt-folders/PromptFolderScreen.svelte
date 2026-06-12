<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Search } from 'lucide-svelte'
  import FlatIconButton from '@renderer/common/cthulhu-ui/FlatIconButton.svelte'
  import FlatLoadingOverlay from '@renderer/common/cthulhu-ui/loading/FlatLoadingOverlay.svelte'
  import PromptFolderVirtualContent from './PromptFolderVirtualContent.svelte'
  import PromptFolderFindIntegration from './find/PromptFolderFindIntegration.svelte'
  import { createPromptFolderScreenController } from './promptFolderScreenController.svelte.ts'

  let { promptFolderId } = $props<{ promptFolderId: string }>()

  const controller = createPromptFolderScreenController({
    getPromptFolderId: () => promptFolderId
  })

  // Side effect: persist the last selected row for this folder when the screen unmounts.
  onDestroy(() => {
    controller.persistActivePromptTreeRow()
  })
</script>

<PromptFolderFindIntegration
  items={controller.findItems}
  scrollToWithinWindowBand={controller.scrollToWithinWindowBandWithManualClear}
  onRevealMatch={controller.handleFindMatchReveal}
>
  {#snippet children(findControls)}
    <main class="relative flex-1 min-h-0 flex flex-col" data-testid="prompt-folder-screen">
      <div class="prompt-folder-header-bar flex h-9 shrink-0 items-center justify-between gap-3 px-6">
        {#if controller.isVirtualContentReady}
          <div class="prompt-folder-header-breadcrumb flex min-w-0 items-center text-sm font-medium">
            <button
              type="button"
              data-testid="prompt-folder-header-folder"
              class="prompt-folder-header-folder min-w-0 cursor-pointer truncate transition-colors"
              onclick={() => controller.handleHeaderSegmentClick('folder-settings')}
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

          <FlatIconButton
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
            promptDraftById={controller.promptDraftById}
            visiblePromptIds={controller.visiblePromptIds}
            isCreatingPrompt={controller.isCreatingPrompt}
            promptFocusRequest={controller.promptFocusRequest}
            initialScrollTopPx={controller.initialPromptFolderScrollTopPx}
            initialCenterRowId={controller.initialPromptFolderCenterRowId}
            scrollToWithinWindowBandForRows={controller.scrollToWithinWindowBandWithManualClear}
            onAddPrompt={controller.handleAddPrompt}
            onDeletePrompt={controller.handleDeletePrompt}
            onMovePromptUp={controller.handleMovePromptUp}
            onMovePromptDown={controller.handleMovePromptDown}
            onPromptTreeDrop={controller.handlePromptTreeDrop}
            onSettingsFieldChange={controller.handleSettingsFieldChange}
            onScrollToWithinWindowBandChange={controller.setScrollToWithinWindowBand}
            onScrollToAndTrackRowCenteredChange={controller.setScrollToAndTrackRowCentered}
            onViewportMetricsChange={controller.setViewportMetrics}
            onScrollTopChange={controller.handleVirtualScrollTopChange}
            onCenterRowChange={controller.handleVirtualCenterRowChange}
            onUserScroll={controller.handleVirtualUserScroll}
            onInitialCenterRowApplied={controller.handleInitialPromptFolderCenterRowApplied}
          />
        {/if}
      </div>

      {#if controller.loadingOverlay.isVisible()}
        <FlatLoadingOverlay
          testId="prompt-folder-loading-overlay"
          fadeMs={controller.loadingOverlayFadeMs}
          isFading={controller.loadingOverlay.isFading()}
          message="Loading prompt folder..."
        />
      {/if}
    </main>
  {/snippet}
</PromptFolderFindIntegration>

<style>
  .prompt-folder-header-bar {
    border-bottom: 1px solid var(--ui-flat-neutral-muted-border);
  }

  .prompt-folder-header-breadcrumb,
  .prompt-folder-header-folder {
    color: var(--ui-flat-muted-text);
  }

  .prompt-folder-header-folder:hover {
    color: var(--ui-flat-hoverable-text);
  }

  .prompt-folder-header-separator {
    color: var(--ui-flat-neutral-emphasis-border);
  }

  .prompt-folder-header-section {
    color: var(--ui-flat-hoverable-text);
  }

  .prompt-folder-header-section:hover {
    color: var(--ui-flat-normal-text);
  }
</style>
