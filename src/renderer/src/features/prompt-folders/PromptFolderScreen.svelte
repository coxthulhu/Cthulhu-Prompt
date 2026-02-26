<script lang="ts">
  import LoadingOverlay from '@renderer/common/ui/loading/LoadingOverlay.svelte'
  import ResizableSidebar from '../sidebar/ResizableSidebar.svelte'
  import PromptFolderOutliner from './PromptFolderOutliner.svelte'
  import PromptFolderVirtualContent from './PromptFolderVirtualContent.svelte'
  import PromptFolderFindIntegration from './find/PromptFolderFindIntegration.svelte'
  import { createPromptFolderScreenController } from './promptFolderScreenController.svelte.ts'

  let { promptFolderId } = $props<{ promptFolderId: string }>()

  const controller = createPromptFolderScreenController({
    getPromptFolderId: () => promptFolderId
  })
</script>

<PromptFolderFindIntegration
  items={controller.findItems}
  scrollToWithinWindowBand={controller.scrollToWithinWindowBandWithManualClear}
>
  <main class="relative flex-1 min-h-0 flex flex-col" data-testid="prompt-folder-screen">
    <div class="flex h-9 border-b border-border" style="background-color: #1F1F1F;">
      <div
        class="h-full shrink-0 border-r border-border"
        style={`width: ${controller.sidebarWidthPx}px`}
        aria-hidden="true"
      ></div>
      <div class="flex-1 min-w-0 flex items-center pl-6">
        <div class="flex min-w-0 items-center text-lg font-semibold">
          <button
            type="button"
            class="min-w-0 truncate underline text-foreground/85 transition-colors hover:text-foreground"
            onclick={() => controller.handleHeaderSegmentClick('folder-settings')}
          >
            {controller.folderDisplayName}
          </button>
          <span class="mx-2">/</span>
          <button
            type="button"
            class="underline whitespace-nowrap text-foreground/85 transition-colors hover:text-foreground"
            onclick={() => controller.handleHeaderSegmentClick(controller.activeHeaderRowId)}
          >
            {controller.activeHeaderSection}
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex">
      <ResizableSidebar
        defaultWidth={controller.promptOutlinerDefaultWidthPx}
        minWidth={100}
        maxWidth={400}
        containerClass="h-full"
        handleTestId="prompt-outliner-resize-handle"
        sidebarInsetYPx={16}
        sidebarBorderClass="border-border/50"
        onWidthChange={(nextWidth) => {
          controller.setSidebarWidth(nextWidth)
        }}
        onDesiredWidthChange={(nextDesiredWidth) => {
          controller.setPromptOutlinerDesiredWidth(nextDesiredWidth)
        }}
      >
        {#snippet sidebar()}
          {#if controller.isVirtualContentReady}
            <PromptFolderOutliner
              promptIds={controller.visiblePromptIds}
              errorMessage={controller.errorMessage}
              activeRow={controller.activeOutlinerRow}
              initialScrollTopPx={controller.initialOutlinerScrollTopPx}
              autoScrollRequestId={controller.outlinerAutoScrollRequestId}
              onSelectPrompt={controller.handleOutlinerClick}
              onSelectFolderSettings={controller.handleOutlinerFolderSettingsClick}
              onScrollTopChange={controller.handleOutlinerScrollTopChange}
            />
          {/if}
        {/snippet}

        {#snippet content()}
          {#if controller.errorMessage}
            <div class="flex-1 min-h-0 overflow-y-auto">
              <div class="pt-6 pl-6">
                <h2 class="text-lg font-semibold mb-4">Prompts ({controller.visiblePromptIds.length})</h2>
                <p class="mt-6 text-red-500">Error loading prompts: {controller.errorMessage}</p>
              </div>
            </div>
          {:else if controller.isVirtualContentReady}
            <PromptFolderVirtualContent
              promptFolderId={controller.promptFolderId}
              descriptionText={controller.descriptionText}
              promptFontSize={controller.promptFontSize}
              promptEditorMinLines={controller.promptEditorMinLines}
              promptDraftById={controller.promptDraftById}
              visiblePromptIds={controller.visiblePromptIds}
              isCreatingPrompt={controller.isCreatingPrompt}
              promptFocusRequest={controller.promptFocusRequest}
              initialScrollTopPx={controller.initialPromptFolderScrollTopPx}
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
            />
          {/if}
        {/snippet}
      </ResizableSidebar>
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
