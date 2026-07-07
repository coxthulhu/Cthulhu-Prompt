<script lang="ts">
  import IndentGuideGutter from '@renderer/common/cthulhu-ui/IndentGuideGutter.svelte'

  let { indentCount = 1, isLastRow = false } = $props<{
    indentCount?: number
    isLastRow?: boolean
  }>()

  const PROMPT_TREE_FIRST_LINE_OFFSET_PX = 8
  const PROMPT_TREE_LINE_STEP_PX = 12
  const PROMPT_TREE_LINE_WIDTH_PX = 1
</script>

<IndentGuideGutter
  class="sidebarPromptTreeGutter"
  lineCount={indentCount}
  firstLineOffsetPx={PROMPT_TREE_FIRST_LINE_OFFSET_PX}
  lineStepPx={PROMPT_TREE_LINE_STEP_PX}
  lineWidthPx={PROMPT_TREE_LINE_WIDTH_PX}
  lineTopInsetPx={-1}
  lineBottomInsetPx={isLastRow ? 0 : -1}
/>
