<script lang="ts">
  import { cn } from '@renderer/common/Cn'
  import { MIN_MONACO_HEIGHT_PX } from './promptEditorSizing'

  type Props = {
    heightPx: number
    class?: string
  }

  let { heightPx, class: className }: Props = $props()

  // Derive a stable placeholder height that matches Monaco's minimum.
  const clampedHeightPx = $derived(Math.max(MIN_MONACO_HEIGHT_PX, Math.ceil(heightPx)))
</script>

<div
  class={cn('bg-[#1e1e1e]', className)}
  style={`height:${clampedHeightPx}px; position: relative;`}
  data-testid="monaco-placeholder"
></div>
