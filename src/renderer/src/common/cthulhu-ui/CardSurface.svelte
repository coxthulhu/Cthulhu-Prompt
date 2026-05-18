<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  export type CardSurfaceVariant = 'panel' | 'panel-flat' | 'solid' | 'inset' | 'inset-muted'

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
    variant === 'solid'
      ? 'cthulhuUiCardSurface--solid rounded-[var(--cthulhu-ui-radius-card)] p-4'
      : null,
    variant === 'inset' || variant === 'inset-muted'
      ? 'cthulhuUiCardSurface--inset rounded-[var(--cthulhu-ui-radius-control)] p-3.5'
      : null,
    variant === 'inset-muted' ? 'cthulhuUiCardSurface--insetMuted' : null,
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
  .cthulhuUiCardSurface--solid {
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

  .cthulhuUiCardSurface--solid {
    background-color: oklch(0 0 0);
    background-image: linear-gradient(var(--ui-card-solid-surface), var(--ui-card-solid-surface));
  }

  .cthulhuUiCardSurface--inset {
    border-color: var(--ui-card-nested-border);
    background-color: var(--ui-card-nested-surface);
    box-shadow: var(--cthulhu-ui-shadow-subcard);
  }

  .cthulhuUiCardSurface--insetMuted {
    background-color: var(--ui-neutral-muted-surface);
  }
</style>
