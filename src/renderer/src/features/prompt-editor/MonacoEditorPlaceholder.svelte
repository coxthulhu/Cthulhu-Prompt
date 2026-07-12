<script lang="ts">
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
  class={className}
  style={`height:${clampedHeightPx}px; position: relative;`}
  data-testid="monaco-placeholder"
></div>
