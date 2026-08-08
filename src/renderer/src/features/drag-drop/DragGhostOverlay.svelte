<script lang="ts">
  import { dragDropOverlayState } from './dragDrop.svelte.ts'

  const activeDragGhost = $derived(dragDropOverlayState.activeDragGhost)
</script>

{#if activeDragGhost}
  {@const GhostComponent = activeDragGhost.component}
  <div
    data-testid="drag-ghost"
    data-drag-ghost-kind={activeDragGhost.kind}
    class="dragGhostOverlay"
    style={`opacity:${activeDragGhost.opacity}; left:${activeDragGhost.x}px; top:${activeDragGhost.y}px;`}
  >
    <GhostComponent {...activeDragGhost.props} />
  </div>
{/if}

<style>
  .dragGhostOverlay {
    pointer-events: none;
    position: fixed;
    z-index: 2147483647;
  }
</style>
