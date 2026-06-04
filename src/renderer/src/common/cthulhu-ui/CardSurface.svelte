<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  export type CardSurfaceVariant = 'panel' | 'panel-flat' | 'flat' | 'solid' | 'overlay' | 'inset'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    variant?: CardSurfaceVariant
    elementRef?: HTMLDivElement | null
  }

  let {
    class: className,
    children,
    variant = 'panel',
    elementRef = $bindable(null),
    ...restProps
  }: Props = $props()
</script>

<div
  bind:this={elementRef}
  class={mergeClasses(
    'cthulhuUiCardSurface border',
    variant === 'panel' || variant === 'panel-flat'
      ? 'cthulhuUiCardSurface--panel rounded-[var(--cthulhu-ui-radius-card)] p-4'
      : null,
    variant === 'panel-flat' ? 'cthulhuUiCardSurface--flat' : null,
    variant === 'flat'
      ? 'cthulhuUiCardSurface--flatSurface rounded-[var(--cthulhu-ui-radius-card)] p-2'
      : null,
    variant === 'solid'
      ? 'cthulhuUiCardSurface--solid rounded-[var(--cthulhu-ui-radius-card)] p-4'
      : null,
    variant === 'overlay'
      ? 'cthulhuUiCardSurface--overlay rounded-[var(--cthulhu-ui-radius-card)] p-4'
      : null,
    variant === 'inset'
      ? 'cthulhuUiCardSurface--inset rounded-[var(--cthulhu-ui-radius-control)] p-3.5'
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

  .cthulhuUiCardSurface--panel,
  .cthulhuUiCardSurface--solid,
  .cthulhuUiCardSurface--overlay {
    border-color: var(--ui-card-normal-border);
    box-shadow: var(--cthulhu-ui-shadow-card);
  }

  .cthulhuUiCardSurface--flat {
    box-shadow: none;
  }

  .cthulhuUiCardSurface--panel {
    background-image: linear-gradient(
      to bottom,
      var(--ui-card-normal-surface-gradient-start),
      var(--ui-card-normal-surface-gradient-end)
    );
  }

  .cthulhuUiCardSurface--flatSurface {
    background: var(--ui-card-normal-surface-gradient-start);
    border: 0;
    box-shadow: none;
  }

  .cthulhuUiCardSurface--solid {
    background: var(--ui-card-solid-surface);
  }

  .cthulhuUiCardSurface--overlay {
    background: var(--ui-card-overlay-surface);
  }

  .cthulhuUiCardSurface--inset {
    background: var(--ui-card-inset-surface);
    border: 0;
    box-shadow: none;
  }
</style>
