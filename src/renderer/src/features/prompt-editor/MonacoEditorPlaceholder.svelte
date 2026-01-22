<script lang="ts">
  import { cn } from '@renderer/common/Cn'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import { getMinMonacoHeightPx } from './promptEditorSizing'

  type Props = {
    heightPx: number
    class?: string
  }

  let { heightPx, class: className }: Props = $props()
  const systemSettings = getSystemSettingsContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const minMonacoHeightPx = $derived(getMinMonacoHeightPx(promptFontSize))

  // Derive a stable placeholder height that matches Monaco's minimum.
  const clampedHeightPx = $derived(Math.max(minMonacoHeightPx, Math.ceil(heightPx)))
</script>

<div
  class={cn('bg-[#1e1e1e]', className)}
  style={`height:${clampedHeightPx}px; position: relative;`}
  data-testid="monaco-placeholder"
></div>
