<script lang="ts">
  import { cn } from '@renderer/common/Cn'
  import { clampMonacoHeightPx, type PromptEditorSizingConfig } from './promptEditorSizing'

  type Props = {
    heightPx: number
    sizingConfig: PromptEditorSizingConfig
    class?: string
  }

  let { heightPx, sizingConfig, class: className }: Props = $props()

  // Derive a stable placeholder height that matches Monaco's configured bounds.
  const clampedHeightPx = $derived(clampMonacoHeightPx(Math.ceil(heightPx), sizingConfig))
</script>

<div
  class={cn('bg-[var(--ui-editor-normal-surface)]', className)}
  style={`height:${clampedHeightPx}px; position: relative;`}
  data-testid="monaco-placeholder"
></div>
