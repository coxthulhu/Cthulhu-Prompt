<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
  }

  let { children, class: className, ...restProps }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiButtonBar', className)} {...restProps}>
  {@render children()}
</div>

<style>
  /* Recessed tray shared by segmented selectors and grouped toolbar actions. */
  .cthulhuUiButtonBar {
    align-items: center;
    background: var(--ui-card-solid-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 10px;
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    height: 44px;
    padding: 4px;
  }
</style>
