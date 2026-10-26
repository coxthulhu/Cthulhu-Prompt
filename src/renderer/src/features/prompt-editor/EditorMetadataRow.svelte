<script lang="ts">
  import type { Snippet } from 'svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    class?: string
    children: Snippet
  }

  let { class: className, children }: Props = $props()
</script>

<!-- Single-line muted metadata beneath prompt and category editor titles. -->
<div class={mergeClasses('editor-metadata-row text-xs', className)}>
  {@render children()}
</div>

<style>
  .editor-metadata-row {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }
</style>
