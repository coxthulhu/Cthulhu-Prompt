<script lang="ts">
  import ResizableSidebar from '../sidebar/ResizableSidebar.svelte'
  import PromptFolderOutliner from './PromptFolderOutliner.svelte'
  import PromptFolderVirtualContent from './PromptFolderVirtualContent.svelte'
  import type { PromptFolderScreenController } from './promptFolderScreenController.svelte.ts'

  type PromptFolderScreenBodyProps = {
    controller: PromptFolderScreenController
  }

  let { controller }: PromptFolderScreenBodyProps = $props()
</script>

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
