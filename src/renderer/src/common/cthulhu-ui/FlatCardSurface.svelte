<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    elementRef?: HTMLDivElement | null
  }

  let {
    class: className,
    children,
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
</style>
