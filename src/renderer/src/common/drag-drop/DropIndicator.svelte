<script lang="ts">
  import type { DroppableEdge } from './dragDrop.svelte.ts'

  type Props = {
    testId: string
    /** Row edge for a horizontal line, or tile side for a vertical line. */
    edge: DroppableEdge | 'left' | 'right'
    /** Offset of the chevron's start, from the left for horizontal lines and from the top for vertical ones. */
    insetStart?: string
    edgeOffset?: string
    isBlocked?: boolean
  }

  let {
    testId,
    edge,
    insetStart = '38px',
    edgeOffset = '0px',
    isBlocked = false
  }: Props = $props()

  const style = $derived(
    `--drag-drop-indicator-inset-start:${insetStart};--drag-drop-indicator-edge-offset:${edgeOffset};`
  )
  /** Left and right edges draw a downward line beside a tile instead of a line across a row. */
  const isVertical = $derived(edge === 'left' || edge === 'right')
</script>

<div
  class="dragDropIndicator"
  {style}
  data-testid={testId}
  data-edge={edge}
  data-blocked={isBlocked ? 'true' : undefined}
  aria-hidden="true"
>
  {#if isVertical}
    <svg class="dragDropIndicatorSvg" width="10" height="100%">
      <path class="dragDropIndicatorStroke" d="M1.5 3 L5 8 L8.5 3" />
      <line class="dragDropIndicatorStroke" x1="5" y1="8" x2="5" y2="100%"></line>
    </svg>
  {:else}
    <svg class="dragDropIndicatorSvg" width="100%" height="10">
      <path class="dragDropIndicatorStroke" d="M3 1.5 L8 5 L3 8.5" />
      <line class="dragDropIndicatorStroke" x1="8" y1="5" x2="100%" y2="5"></line>
    </svg>
  {/if}
</div>

<style>
  .dragDropIndicator {
    position: absolute;
  }

  .dragDropIndicator:is([data-edge='top'], [data-edge='bottom']) {
    right: 2px;
    left: calc(var(--drag-drop-indicator-inset-start, 38px) - 10px);
    height: 10px;
    transform: translateY(-50%);
  }

  .dragDropIndicator[data-edge='top'] {
    top: calc(0px - var(--drag-drop-indicator-edge-offset, 0px));
  }

  .dragDropIndicator[data-edge='bottom'] {
    top: calc(100% + var(--drag-drop-indicator-edge-offset, 0px));
  }

  .dragDropIndicator:is([data-edge='left'], [data-edge='right']) {
    top: calc(var(--drag-drop-indicator-inset-start, 38px) - 10px);
    bottom: 2px;
    width: 10px;
    transform: translateX(-50%);
  }

  .dragDropIndicator[data-edge='left'] {
    left: calc(0px - var(--drag-drop-indicator-edge-offset, 0px));
  }

  .dragDropIndicator[data-edge='right'] {
    left: calc(100% + var(--drag-drop-indicator-edge-offset, 0px));
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

  .dragDropIndicator[data-blocked='true'] .dragDropIndicatorStroke {
    stroke: var(--ui-muted-icon-glyph);
  }
</style>
