<script lang="ts">
  import type { DroppableEdge } from './dragDrop.svelte.ts'

  type Props = {
    testId: string
    edge: DroppableEdge
    insetStart?: string
    edgeOffset?: string
  }

  let { testId, edge, insetStart = '38px', edgeOffset = '0px' }: Props = $props()

  const style = $derived(
    `--drag-drop-indicator-inset-start:${insetStart};--drag-drop-indicator-edge-offset:${edgeOffset};`
  )
</script>

<div class="dragDropIndicator" {style} data-testid={testId} data-edge={edge} aria-hidden="true">
  <svg class="dragDropIndicatorSvg" width="100%" height="10">
    <path class="dragDropIndicatorStroke" d="M3 1.5 L8 5 L3 8.5" />
    <line class="dragDropIndicatorStroke" x1="8" y1="5" x2="100%" y2="5"></line>
  </svg>
</div>

<style>
  .dragDropIndicator {
    position: absolute;
    right: 2px;
    left: calc(var(--drag-drop-indicator-inset-start, 38px) - 10px);
    height: 10px;
  }

  .dragDropIndicator[data-edge='top'] {
    top: calc(0px - var(--drag-drop-indicator-edge-offset, 0px));
    transform: translateY(-50%);
  }

  .dragDropIndicator[data-edge='bottom'] {
    top: calc(100% + var(--drag-drop-indicator-edge-offset, 0px));
    transform: translateY(-50%);
  }

  .dragDropIndicatorSvg {
    display: block;
    overflow: visible;
  }

  .dragDropIndicatorStroke {
    fill: none;
    stroke: var(--ui-info-strong-border);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
</style>
