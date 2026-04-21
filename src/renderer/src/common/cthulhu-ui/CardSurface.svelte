<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  export type CardSurfaceVariant = 'default' | 'subcard'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
    variant?: CardSurfaceVariant
  }

  let { class: className, children, variant = 'default', ...restProps }: Props = $props()
</script>

<div
  class={mergeClasses(
    'cthulhuUiCardSurface border',
    variant === 'default' ? 'cthulhuUiCardSurface--default rounded-[28px] p-4' : null,
    variant === 'subcard' ? 'cthulhuUiCardSurface--subcard rounded-2xl px-4 py-4' : null,
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

  .cthulhuUiCardSurface--default {
    border-color: var(--ui-card-border-default);
    background-image: linear-gradient(
      to bottom,
      var(--ui-card-surface-gradient-start),
      var(--ui-card-surface-gradient-end)
    );
    box-shadow: 0 18px 50px var(--ui-card-shadow);
  }

  .cthulhuUiCardSurface--subcard {
    border-color: var(--ui-card-nested-border-default);
    background-color: var(--ui-card-nested-surface-default);
    box-shadow: inset 0 1px 0 var(--ui-border-muted);
  }
</style>
