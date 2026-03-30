<script lang="ts">
  import type { DroppableEdge } from '@renderer/features/drag-drop/dragDrop.svelte.ts'

  type Props = {
    testId: string
    edge: DroppableEdge
    insetStart?: string
  }

  let { testId, edge, insetStart = '2.375rem' }: Props = $props()

  const style = $derived(`--sidebar-drop-indicator-inset-start:${insetStart};`)
</script>

<div
  class="sidebarPromptTreeDropIndicator"
  {style}
  data-testid={testId}
  data-edge={edge}
  aria-hidden="true"
>
  <svg class="sidebarPromptTreeDropIndicatorSvg" width="100%" height="10">
    <path class="sidebarPromptTreeDropIndicatorStroke" d="M3 1.5 L8 5 L3 8.5" />
    <line class="sidebarPromptTreeDropIndicatorStroke" x1="8" y1="5" x2="100%" y2="5"></line>
  </svg>
</div>
