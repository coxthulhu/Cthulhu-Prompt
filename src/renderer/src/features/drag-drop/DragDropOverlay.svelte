<script lang="ts">
  import { dragDropOverlayState } from './dragDrop.svelte.ts'
</script>

{#if dragDropOverlayState.isVisible && dragDropOverlayState.preview}
  <div
    data-testid="drag-drop-overlay"
    class="fixed inset-0 z-40 pointer-events-none"
    aria-hidden="true"
  >
    <div
      class="absolute left-0 top-0"
      style={`transform: translate(${dragDropOverlayState.leftPx}px, ${dragDropOverlayState.topPx}px);`}
    >
      {@render dragDropOverlayState.preview()}
    </div>
  </div>
{/if}
