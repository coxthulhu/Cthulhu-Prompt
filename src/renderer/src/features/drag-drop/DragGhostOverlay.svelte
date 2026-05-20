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
    style={`opacity:${activeDragGhost.opacity}; transform:translate(${activeDragGhost.x}px, ${activeDragGhost.y}px);`}
  >
    <GhostComponent {...activeDragGhost.props} />
  </div>
{/if}

<style>
  .dragGhostOverlay {
    left: 0;
    pointer-events: none;
    position: fixed;
    top: 0;
    will-change: transform;
    z-index: 2147483647;
  }
</style>
