<script module lang="ts">
  export const PROMPT_FOLDER_SECTION_GUTTER_WIDTH_PX = 3
  export const PROMPT_FOLDER_SECTION_GUTTER_GAP_PX = 16
  export const PROMPT_FOLDER_SECTION_GUTTER_OFFSET_PX =
    PROMPT_FOLDER_SECTION_GUTTER_WIDTH_PX + PROMPT_FOLDER_SECTION_GUTTER_GAP_PX
  export const PROMPT_FOLDER_SECTION_GUTTER_START_INSET_PX = 24
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
    topInsetPx?: number
  }

  let {
    children,
    rowHeightPx,
    contentClass,
    contentVirtualWindowRow = false,
    topInsetPx = 0
  }: Props = $props()
</script>

<div
  class="prompt-folder-section-row"
  style={`height:${rowHeightPx}px; --prompt-folder-section-gutter-width:${PROMPT_FOLDER_SECTION_GUTTER_WIDTH_PX}px; --prompt-folder-section-gutter-gap:${PROMPT_FOLDER_SECTION_GUTTER_GAP_PX}px; --prompt-folder-section-gutter-top-inset:${topInsetPx}px;`}
>
  <PromptFolderSectionGutter />
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
