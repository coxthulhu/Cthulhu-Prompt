<script lang="ts">
  import CardSurface from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    sidebar?: Snippet
    rowElement?: HTMLDivElement | null
  }

  let {
    children,
    sidebar,
    rowElement = $bindable(null),
    class: className,
    ...restProps
  }: Props = $props()

  const layout = $derived(sidebar ? 'sidebar' : 'plain')
</script>

<CardSurface
  bind:elementRef={rowElement}
  class={mergeClasses('prompt-editor-card-surface', className)}
  data-layout={layout}
  {...restProps}
>
  {#if sidebar}
    {@render sidebar()}
  {/if}

  <div class="prompt-editor-card-body">
    {@render children()}
  </div>
</CardSurface>

<style>
  :global(.prompt-editor-card-surface) {
    align-items: stretch;
    background: var(--ui-card-overlay-surface);
    box-sizing: border-box;
    display: grid;
    min-width: 0;
    overflow: hidden;
  }

  :global(.prompt-editor-card-surface[data-layout='sidebar']) {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  :global(.prompt-editor-card-surface[data-layout='plain']) {
    grid-template-columns: minmax(0, 1fr);
  }

  .prompt-editor-card-body {
    align-content: start;
    background: var(--ui-editor-normal-surface);
    border-radius: var(--cthulhu-ui-radius-card);
    display: grid;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  :global(.prompt-editor-card-surface[data-layout='sidebar']) .prompt-editor-card-body {
    border-radius: var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card);
  }
</style>
