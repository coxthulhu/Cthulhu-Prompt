<script lang="ts">
  import { onDestroy } from 'svelte'
  import LoadingOverlay from '@renderer/common/ui/loading/LoadingOverlay.svelte'
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
  <main class="relative flex-1 min-h-0 flex flex-col" data-testid="prompt-folder-screen">
    <div
      class="flex h-9 border-b border-border items-center pl-6"
      style="background-color: #1F1F1F;"
    >
      <div class="flex min-w-0 items-center text-lg font-semibold">
        <button
          type="button"
          data-testid="prompt-folder-header-folder"
          class="min-w-0 truncate underline text-foreground/85 transition-colors hover:text-foreground"
          onclick={() => controller.handleHeaderSegmentClick('folder-settings')}
        >
          {controller.folderDisplayName}
        </button>
        <span class="mx-2">/</span>
        <button
          type="button"
          data-testid="prompt-folder-header-section"
          class="underline whitespace-nowrap text-foreground/85 transition-colors hover:text-foreground"
          onclick={() => controller.handleHeaderSegmentClick(controller.activeHeaderRowId)}
        >
          {controller.activeHeaderSection}
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0">
      {#if controller.errorMessage}
        <div class="flex-1 min-h-0 overflow-y-auto">
          <div class="pt-6 pl-6">
            <h2 class="text-lg font-semibold mb-4">
              Prompts ({controller.visiblePromptIds.length})
            </h2>
            <p class="mt-6 text-red-500">Error loading prompts: {controller.errorMessage}</p>
          </div>
        </div>
      {:else if controller.isVirtualContentReady}
        <PromptFolderVirtualContent
          workspaceId={controller.workspaceId}
          promptFolderId={controller.promptFolderId}
          descriptionText={controller.descriptionText}
          promptFontSize={controller.promptFontSize}
          promptEditorMinLines={controller.promptEditorMinLines}
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
          onDescriptionChange={controller.handleDescriptionChange}
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
      <LoadingOverlay
        testId="prompt-folder-loading-overlay"
        fadeMs={controller.loadingOverlayFadeMs}
        isFading={controller.loadingOverlay.isFading()}
        message="Loading prompt folder..."
      />
    {/if}
  </main>
</PromptFolderFindIntegration>
