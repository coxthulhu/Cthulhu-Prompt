<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import IndentGuideGutter from '@renderer/common/cthulhu-ui/IndentGuideGutter.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import {
    PROMPT_FOLDER_SECTION_GUTTER_FIRST_LINE_OFFSET_PX,
    PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX,
    PROMPT_FOLDER_SECTION_GUTTER_LINE_WIDTH_PX
  } from './promptFolderSectionGutterMetrics'

  type Props = HTMLAttributes<HTMLDivElement> & {
    indentLevel?: number
  }

  let { indentLevel = 1, class: className, ...restProps }: Props = $props()
</script>

<!-- Visual section rail for prompt-folder virtual rows. -->
<IndentGuideGutter
  class={mergeClasses('promptFolderSectionGutter', className)}
  lineCount={indentLevel}
  firstLineOffsetPx={PROMPT_FOLDER_SECTION_GUTTER_FIRST_LINE_OFFSET_PX}
  lineStepPx={PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX}
  lineWidthPx={PROMPT_FOLDER_SECTION_GUTTER_LINE_WIDTH_PX}
  {...restProps}
/>
