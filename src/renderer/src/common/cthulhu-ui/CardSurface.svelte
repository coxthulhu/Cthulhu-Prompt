<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  export type CardSurfaceVariant = 'default' | 'solid' | 'subcard'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    variant?: CardSurfaceVariant
  }

  let { class: className, children, variant = 'default', ...restProps }: Props = $props()
</script>

<div
  class={mergeClasses(
    'cthulhuUiCardSurface border',
    variant === 'default'
      ? 'cthulhuUiCardSurface--default rounded-[var(--cthulhu-ui-radius-card)] p-4'
      : null,
    variant === 'solid'
      ? 'cthulhuUiCardSurface--solid rounded-[var(--cthulhu-ui-radius-card)] p-4'
      : null,
    variant === 'subcard'
      ? 'cthulhuUiCardSurface--subcard rounded-[var(--cthulhu-ui-radius-control)] px-4 py-4'
      : null,
    className
  )}
  {...restProps}
>
  <!-- Shared card shell; callers provide all card content via snippets. -->
  {@render children()}
</div>

<style>
  .cthulhuUiCardSurface {
    background-repeat: no-repeat;
  }

  .cthulhuUiCardSurface--default,
  .cthulhuUiCardSurface--solid {
    border-color: var(--ui-card-normal-border);
    box-shadow: var(--cthulhu-ui-shadow-card);
  }

  .cthulhuUiCardSurface--default {
    background-image: linear-gradient(
      to bottom,
      var(--ui-card-normal-surface-gradient-start),
      var(--ui-card-normal-surface-gradient-end)
    );
  }

  .cthulhuUiCardSurface--solid {
    background-color: oklch(0 0 0);
    background-image: linear-gradient(
      var(--ui-card-solid-surface),
      var(--ui-card-solid-surface)
    );
  }

  .cthulhuUiCardSurface--subcard {
    border-color: var(--ui-card-nested-border);
    background-color: var(--ui-card-nested-surface);
    box-shadow: var(--cthulhu-ui-shadow-subcard);
  }
</style>
