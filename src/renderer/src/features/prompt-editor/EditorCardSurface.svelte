<script lang="ts">
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

<div
  bind:this={rowElement}
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
</div>

<style>
  :global(.editor-card-surface) {
    align-items: stretch;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-card);
    box-sizing: border-box;
    display: grid;
    min-width: 0;
    overflow: hidden;
    width: 100%;
  }

  :global(.editor-card-surface[data-layout='sidebar']) {
    grid-template-columns: 32px minmax(0, 1fr);
  }

  :global(.editor-card-surface[data-layout='plain']) {
    grid-template-columns: minmax(0, 1fr);
  }

  .editor-card-body {
    /* The outer wrapper clips the rail and body into one card silhouette. */
    align-content: start;
    background: var(--ui-card-normal-surface);
    display: grid;
    min-width: 0;
    position: relative;
    z-index: 1;
  }
</style>
