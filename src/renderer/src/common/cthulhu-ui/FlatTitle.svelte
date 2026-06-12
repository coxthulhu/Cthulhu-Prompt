<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type FlatTitleVariant = 'page' | 'small' | 'card' | 'dialog'

  type Props = HTMLAttributes<HTMLDivElement> & {
    title: string
    variant?: FlatTitleVariant
  }

  let {
    title,
    variant = 'page',
    class: className,
    ...restProps
  }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiFlatTitle', className)} data-variant={variant} {...restProps}>
  {title}
</div>

<style>
  .cthulhuUiFlatTitle[data-variant='page'] {
    color: var(--ui-flat-normal-text);
    font-size: 24px;
    font-weight: 700;
    line-height: 29px;
    overflow-wrap: anywhere;
  }

  .cthulhuUiFlatTitle[data-variant='small'] {
    color: var(--ui-flat-normal-text);
    font-size: 14px;
    font-weight: 600;
    line-height: 21px;
  }

  .cthulhuUiFlatTitle[data-variant='card'],
  .cthulhuUiFlatTitle[data-variant='dialog'] {
    color: var(--ui-flat-normal-text);
    font-size: 18px;
    font-weight: 500;
    line-height: 22px;
  }

  .cthulhuUiFlatTitle[data-variant='dialog'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
