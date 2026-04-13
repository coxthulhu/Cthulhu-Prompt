<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
  }

  let { class: className, children, ...restProps }: Props = $props()
</script>

<div
  class={mergeClasses('cthulhuUiCardSurface rounded-[28px] border p-4', className)}
  {...restProps}
>
  <!-- Shared card shell; callers provide all card content via snippets. -->
  {@render children()}
</div>

<style>
  .cthulhuUiCardSurface {
    border-color: var(--ui-card-border-soft);
    background-image: linear-gradient(
      to bottom,
      var(--ui-card-surface-top),
      var(--ui-card-surface-bottom)
    );
    box-shadow: 0 18px 50px var(--ui-card-shadow);
  }
</style>
