<script lang="ts">
  import LoadingOverlay from '@renderer/common/ui/loading/LoadingOverlay.svelte'
  import DragDropOverlay from '@renderer/features/drag-drop/DragDropOverlay.svelte'

  type OverlayState = {
    isVisible: () => boolean
    isFading: () => boolean
  }

  type Props = {
    startupRestoreOverlay: OverlayState
    startupLoadingOverlayFadeMs: number
  }

  const { startupRestoreOverlay, startupLoadingOverlayFadeMs }: Props = $props()
</script>

<DragDropOverlay />

{#if startupRestoreOverlay.isVisible()}
  <LoadingOverlay
    testId="startup-loading-overlay"
    fadeMs={startupLoadingOverlayFadeMs}
    isFading={startupRestoreOverlay.isFading()}
    message="Loading workspace..."
    fullscreen
  />
{/if}
