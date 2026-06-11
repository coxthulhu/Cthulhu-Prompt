<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  export type FlatCardSurfaceVariant = 'default' | 'overlay'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    variant?: FlatCardSurfaceVariant
    elementRef?: HTMLDivElement | null
  }

  let {
    class: className,
    children,
    variant = 'default',
    elementRef = $bindable(null),
    ...restProps
  }: Props = $props()
</script>

<div
  bind:this={elementRef}
  class={mergeClasses(
    'cthulhuUiFlatCardSurface w-full min-w-0 rounded-[var(--cthulhu-ui-radius-card)]',
    className
  )}
  data-variant={variant}
  {...restProps}
>
  <!-- Dedicated flat card surface; rows own all content padding. -->
  {@render children()}
</div>

<style>
  .cthulhuUiFlatCardSurface {
    background: var(--ui-flat-card-normal-surface-gradient-start);
    background-repeat: no-repeat;
    box-shadow: none;
  }

  .cthulhuUiFlatCardSurface[data-variant='overlay'] {
    background: var(--ui-card-overlay-surface);
    border: 1px solid var(--ui-card-normal-border);
    box-shadow: var(--cthulhu-ui-shadow-card);
  }
</style>
