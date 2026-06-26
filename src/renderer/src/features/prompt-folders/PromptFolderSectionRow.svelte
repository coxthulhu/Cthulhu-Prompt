<script module lang="ts">
  import {
    getPromptFolderSectionContentOffsetPx,
    getPromptFolderSectionGutterGapPx,
    getPromptFolderSectionGutterWidthPx
  } from './promptFolderSectionGutterMetrics'

  export {
    PROMPT_FOLDER_SECTION_GUTTER_FIRST_LINE_OFFSET_PX,
    PROMPT_FOLDER_SECTION_GUTTER_GAP_PX,
    PROMPT_FOLDER_SECTION_GUTTER_LINE_WIDTH_PX
  } from './promptFolderSectionGutterMetrics'

  export const PROMPT_FOLDER_SECTION_GUTTER_WIDTH_PX =
    getPromptFolderSectionGutterWidthPx(1)
  export const PROMPT_FOLDER_SECTION_GUTTER_OFFSET_PX =
    getPromptFolderSectionContentOffsetPx(1)
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import PromptFolderSectionGutter from './PromptFolderSectionGutter.svelte'

  type Props = {
    children: Snippet
    rowHeightPx: number
    contentClass?: string
    contentVirtualWindowRow?: boolean
    indentLevel?: number
    showGutter?: boolean
  }

  let {
    children,
    rowHeightPx,
    contentClass,
    contentVirtualWindowRow = false,
    indentLevel = 1,
    showGutter = true
  }: Props = $props()

  const effectiveIndentLevel = $derived(showGutter ? indentLevel : 0)
  const gutterWidthPx = $derived(getPromptFolderSectionGutterWidthPx(effectiveIndentLevel))
  const gutterGapPx = $derived(getPromptFolderSectionGutterGapPx(effectiveIndentLevel))
</script>

<div
  class="prompt-folder-section-row"
  style={`height:${rowHeightPx}px; --prompt-folder-section-gutter-width:${gutterWidthPx}px; --prompt-folder-section-gutter-gap:${gutterGapPx}px;`}
>
  {#if showGutter && indentLevel > 0}
    <PromptFolderSectionGutter {indentLevel} />
  {:else}
    <div aria-hidden="true"></div>
  {/if}
  <div
    class={mergeClasses('prompt-folder-section-row-content', contentClass)}
    data-virtual-window-row={contentVirtualWindowRow ? '' : undefined}
  >
    {@render children()}
  </div>
</div>

<style>
  .prompt-folder-section-row {
    box-sizing: border-box;
    column-gap: var(--prompt-folder-section-gutter-gap);
    display: grid;
    grid-template-columns: var(--prompt-folder-section-gutter-width) minmax(0, 1fr);
    min-width: 0;
  }

  .prompt-folder-section-row-content {
    min-width: 0;
  }
</style>
