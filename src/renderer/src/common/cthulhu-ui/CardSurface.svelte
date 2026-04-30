<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'
  import type { CthulhuAppearance } from './types'

  export type CardSurfaceAppearance = Extract<CthulhuAppearance, 'soft' | 'solid' | 'inset'>

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    appearance?: CardSurfaceAppearance
  }

  let { class: className, children, appearance = 'soft', ...restProps }: Props = $props()
</script>

<div
  class={mergeClasses(
    'cthulhuUiCardSurface border',
    appearance === 'soft'
      ? 'cthulhuUiCardSurface--soft rounded-[var(--cthulhu-ui-radius-card)] p-4'
      : null,
    appearance === 'solid'
      ? 'cthulhuUiCardSurface--solid rounded-[var(--cthulhu-ui-radius-card)] p-4'
      : null,
    appearance === 'inset'
      ? 'cthulhuUiCardSurface--inset rounded-[var(--cthulhu-ui-radius-control)] px-4 py-4'
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

  .cthulhuUiCardSurface--soft,
  .cthulhuUiCardSurface--solid {
    border-color: var(--ui-card-normal-border);
    box-shadow: var(--cthulhu-ui-shadow-card);
  }

  .cthulhuUiCardSurface--soft {
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
</style>
