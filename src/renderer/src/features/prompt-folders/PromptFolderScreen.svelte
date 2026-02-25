<script lang="ts">
  import LoadingOverlay from '@renderer/common/ui/loading/LoadingOverlay.svelte'
  import PromptFolderFindIntegration from './find/PromptFolderFindIntegration.svelte'
  import PromptFolderScreenBody from './PromptFolderScreenBody.svelte'
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

    <PromptFolderScreenBody {controller} />

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
