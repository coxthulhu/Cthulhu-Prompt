<script lang="ts">
  import LoadingOverlay from '@renderer/common/cthulhu-ui/loading/LoadingOverlay.svelte'

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

{#if startupRestoreOverlay.isVisible()}
  <LoadingOverlay
    testId="startup-loading-overlay"
    fadeMs={startupLoadingOverlayFadeMs}
    isFading={startupRestoreOverlay.isFading()}
    message="Loading workspace..."
    fullscreen
  />
{/if}
