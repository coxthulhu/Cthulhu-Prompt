<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type SeparatorOrientation = 'horizontal' | 'vertical'

  type Props = HTMLAttributes<HTMLDivElement> & {
    orientation?: SeparatorOrientation
    decorative?: boolean
    elementRef?: HTMLDivElement | null
  }

  let {
    class: className,
    orientation = 'horizontal',
    decorative = true,
    elementRef = $bindable(null),
    ...restProps
  }: Props = $props()
</script>

<div
  bind:this={elementRef}
  role={decorative ? 'presentation' : 'separator'}
  aria-orientation={!decorative ? orientation : undefined}
  data-orientation={orientation}
  class={mergeClasses(
    'cthulhuUiSeparator shrink-0',
    orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
    className
  )}
  {...restProps}
></div>

<style>
  .cthulhuUiSeparator {
    box-sizing: border-box;
  }

  .cthulhuUiSeparator[data-orientation='horizontal'] {
    border-top: 1px solid var(--cthulhu-ui-separator-color, var(--ui-neutral-muted-border));
  }

  .cthulhuUiSeparator[data-orientation='vertical'] {
    border-left: 1px solid var(--cthulhu-ui-separator-color, var(--ui-neutral-muted-border));
  }
</style>
