<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  export type CardSurfaceVariant = 'default' | 'overlay'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    variant?: CardSurfaceVariant
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
    'cthulhuUiCardSurface w-full min-w-0 rounded-[var(--cthulhu-ui-radius-card)]',
    className
  )}
  data-variant={variant}
  {...restProps}
>
  <!-- Dedicated card surface; rows own all content padding. -->
  {@render children()}
</div>

<style>
  .cthulhuUiCardSurface {
    background: var(--ui-card-normal-surface-gradient-start);
    background-repeat: no-repeat;
    border: 1px solid var(--ui-neutral-muted-border);
    box-shadow: none;
  }

  .cthulhuUiCardSurface[data-variant='overlay'] {
    background: var(--ui-card-solid-surface);
    border: 1px solid var(--ui-card-normal-border);
    box-shadow: 0 8px 12px var(--ui-card-normal-shadow);
  }
</style>
