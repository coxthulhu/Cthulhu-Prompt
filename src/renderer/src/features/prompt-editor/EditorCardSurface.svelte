<script lang="ts">
  import CardSurface from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    sidebar?: Snippet
    showSidebar?: boolean
    rowElement?: HTMLDivElement | null
  }

  let {
    children,
    sidebar,
    showSidebar = true,
    rowElement = $bindable(null),
    class: className,
    ...restProps
  }: Props = $props()

  const layout = $derived(sidebar && showSidebar ? 'sidebar' : 'plain')
</script>

<CardSurface
  bind:elementRef={rowElement}
  class={mergeClasses('editor-card-surface', className)}
  data-layout={layout}
  {...restProps}
>
  {#if sidebar && showSidebar}
    {@render sidebar()}
  {/if}

  <div class="editor-card-body">
    {@render children()}
  </div>
</CardSurface>

<style>
  :global(.editor-card-surface) {
    align-items: stretch;
    background: var(--ui-card-overlay-surface);
    box-sizing: border-box;
    display: grid;
    min-width: 0;
    overflow: hidden;
  }

  :global(.editor-card-surface[data-layout='sidebar']) {
    grid-template-columns: 36px minmax(0, 1fr);
  }

  :global(.editor-card-surface[data-layout='plain']) {
    grid-template-columns: minmax(0, 1fr);
  }

  .editor-card-body {
    align-content: start;
    background: var(--ui-editor-normal-surface);
    border-radius: var(--cthulhu-ui-radius-card);
    display: grid;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  :global(.editor-card-surface[data-layout='sidebar']) .editor-card-body {
    border-radius: var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card);
  }
</style>
