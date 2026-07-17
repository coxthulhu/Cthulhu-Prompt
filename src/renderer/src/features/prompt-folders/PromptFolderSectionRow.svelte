<script lang="ts">
  import type { Snippet } from 'svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import {
    PROMPT_FOLDER_SECTION_INSET_PX,
    getPromptFolderSectionContentOffsetPx
  } from './promptFolderSectionGutterMetrics'

  type Props = {
    children: Snippet
    rowHeightPx: number
    contentClass?: string
    contentVirtualWindowRow?: boolean
    indentLevel?: number
    testId?: string
  }

  let {
    children,
    rowHeightPx,
    contentClass,
    contentVirtualWindowRow = false,
    indentLevel = 0,
    testId
  }: Props = $props()

  const contentOffsetPx = $derived(getPromptFolderSectionContentOffsetPx(indentLevel))
</script>

<div
  class="prompt-folder-section-row"
  style={`height:${rowHeightPx}px; --prompt-folder-section-content-offset:${contentOffsetPx}px;`}
  data-testid={testId}
>
  {#each Array.from({ length: indentLevel }, (_value, level) => level) as level (level)}
    <div
      class="prompt-folder-section-middle-layer"
      style={`inset:0 ${level * PROMPT_FOLDER_SECTION_INSET_PX}px;`}
      aria-hidden="true"
    ></div>
  {/each}
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
    min-width: 0;
    position: relative;
  }

  .prompt-folder-section-middle-layer {
    background: var(--ui-card-nested-surface);
    border-left: 1px solid var(--ui-card-nested-border);
    border-right: 1px solid var(--ui-card-nested-border);
    box-sizing: border-box;
    position: absolute;
  }

  .prompt-folder-section-row-content {
    box-sizing: border-box;
    height: 100%;
    margin-left: var(--prompt-folder-section-content-offset);
    margin-right: var(--prompt-folder-section-content-offset);
    min-width: 0;
    position: relative;
  }
</style>
