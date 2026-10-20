<script lang="ts">
  import type { Snippet } from 'svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import {
    PROMPT_COLLECTION_SECTION_INSET_PX,
    getPromptCollectionSectionContentOffsetPx
  } from './promptCollectionSectionGutterMetrics'

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

  const contentOffsetPx = $derived(getPromptCollectionSectionContentOffsetPx(indentLevel))
</script>

<div
  class="prompt-collection-section-row"
  style={`height:${rowHeightPx}px; --prompt-collection-section-content-offset:${contentOffsetPx}px;`}
  data-testid={testId}
>
  {#each Array.from({ length: indentLevel }, (_value, level) => level) as level (level)}
    <div
      class="prompt-collection-section-middle-layer"
      style={`inset:0 ${level * PROMPT_COLLECTION_SECTION_INSET_PX}px;`}
      aria-hidden="true"
    ></div>
  {/each}
  <div
    class={mergeClasses('prompt-collection-section-row-content', contentClass)}
    data-virtual-window-row={contentVirtualWindowRow ? '' : undefined}
  >
    {@render children()}
  </div>
</div>

<style>
  .prompt-collection-section-row {
    min-width: 0;
    position: relative;
  }

  .prompt-collection-section-middle-layer {
    border-left: 1px solid var(--ui-neutral-normal-border);
    border-right: 1px solid var(--ui-neutral-normal-border);
    position: absolute;
  }

  .prompt-collection-section-row-content {
    height: 100%;
    margin-left: var(--prompt-collection-section-content-offset);
    margin-right: var(--prompt-collection-section-content-offset);
    min-width: 0;
    position: relative;
  }
</style>
