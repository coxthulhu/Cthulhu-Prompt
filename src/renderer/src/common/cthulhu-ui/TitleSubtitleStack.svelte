<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
  }

  let { children, class: className, ...restProps }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiTitleSubtitleStack', className)} {...restProps}>
  {@render children()}
</div>

<style>
  .cthulhuUiTitleSubtitleStack {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
</style>
