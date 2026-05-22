<script lang="ts">
  import { cn } from '@renderer/common/Cn'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import { clampMonacoHeightPx } from './promptEditorSizing'

  type Props = {
    heightPx: number
    minLines?: number
    maxLines?: number
    class?: string
  }

  let { heightPx, minLines, maxLines, class: className }: Props = $props()
  const systemSettings = getSystemSettingsContext()
  const promptFontSize = $derived(systemSettings.promptFontSize)
  const promptEditorMinLines = $derived(minLines ?? systemSettings.promptEditorMinLines)
  const promptEditorMaxLines = $derived(maxLines ?? systemSettings.promptEditorMaxLines)

  // Derive a stable placeholder height that matches Monaco's configured bounds.
  const clampedHeightPx = $derived(
    clampMonacoHeightPx(
      Math.ceil(heightPx),
      promptFontSize,
      promptEditorMinLines,
      promptEditorMaxLines
    )
  )
</script>

<div
  class={cn('bg-[#1e1e1e]', className)}
  style={`height:${clampedHeightPx}px; position: relative;`}
  data-testid="monaco-placeholder"
></div>
