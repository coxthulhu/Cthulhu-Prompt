<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    text: string
    variant?: 'default' | 'regular'
  }

  let { text, variant = 'default', class: className, ...restProps }: Props = $props()
</script>

<div
  class={mergeClasses(
    'cthulhuUiDisplayText flex min-h-0 min-w-0 items-center overflow-hidden rounded-2xl border px-4 py-3 text-sm',
    variant === 'default' ? 'font-medium' : 'font-normal',
    className
  )}
  {...restProps}
>
  {text}
</div>

<style>
  .cthulhuUiDisplayText {
    border-color: var(--ui-border-default);
    background-color: var(--ui-surface-input);
    color: var(--ui-text-strong);
    box-shadow: inset 0 1px 2px var(--ui-shadow-inset);
  }

  .cthulhuUiDisplayText::selection {
    background-color: var(--ui-selection-surface);
    color: var(--ui-text-bright);
  }
</style>
