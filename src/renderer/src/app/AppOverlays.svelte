<script lang="ts">
  import LoadingOverlay from '@renderer/common/cthulhu-ui/loading/LoadingOverlay.svelte'
  import DragGhostOverlay from '@renderer/features/drag-drop/DragGhostOverlay.svelte'

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

<DragGhostOverlay />

{#if startupRestoreOverlay.isVisible()}
  <LoadingOverlay
    testId="startup-loading-overlay"
    fadeMs={startupLoadingOverlayFadeMs}
    isFading={startupRestoreOverlay.isFading()}
    message="Loading workspace..."
    fullscreen
  />
{/if}
