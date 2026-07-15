<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    children: Snippet
  }

  let { children, class: className, ...restProps }: Props = $props()
</script>

<div
  class={mergeClasses(
    'cthulhuUiIconButtonBar flex min-w-0 shrink-0 items-center gap-2',
    className
  )}
  {...restProps}
>
  {@render children()}
</div>
