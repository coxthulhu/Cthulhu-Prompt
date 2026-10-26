<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = HTMLAttributes<HTMLSpanElement> & {
    text: string
    wrap?: boolean
  }

  let { text, wrap = true, class: className, ...restProps }: Props = $props()
</script>

<span class={mergeClasses('cthulhuUiSubtitle min-w-0 truncate text-sm', className)} data-wrap={wrap} {...restProps}>
  {text}
</span>

<style>
  .cthulhuUiSubtitle {
    color: var(--ui-muted-text);
    display: block;
    font-weight: var(--font-weight-normal);
  }

  .cthulhuUiSubtitle[data-wrap='true'] {
    overflow-wrap: anywhere;
    white-space: normal;
  }
</style>
