<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLSpanElement> & {
    text: string
    wrap?: boolean
  }

  let { text, wrap = true, class: className, ...restProps }: Props = $props()
</script>

<span class={mergeClasses('cthulhuUiSubtitle', className)} data-wrap={wrap} {...restProps}>
  {text}
</span>

<style>
  .cthulhuUiSubtitle {
    color: var(--ui-muted-text);
    display: block;
    font-size: 14px;
    font-weight: var(--font-weight-normal);
    line-height: 1.5;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiSubtitle[data-wrap='true'] {
    overflow-wrap: anywhere;
    white-space: normal;
  }
</style>
