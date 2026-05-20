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
  variant="panel-flat"
  class={mergeClasses('prompt-editor-card-surface p-[10px]', className)}
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
    box-sizing: border-box;
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  :global(.prompt-editor-card-surface[data-layout='sidebar']) {
    grid-template-columns: 28px minmax(0, 1fr);
  }

  :global(.prompt-editor-card-surface[data-layout='plain']) {
    grid-template-columns: minmax(0, 1fr);
  }

  .prompt-editor-card-body {
    align-content: start;
    display: grid;
    gap: 8px;
    grid-template-rows: auto auto;
    min-width: 0;
  }
</style>
