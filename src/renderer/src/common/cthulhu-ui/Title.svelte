<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type TitleVariant = 'page' | 'small' | 'card' | 'dialog'

  type Props = HTMLAttributes<HTMLDivElement> & {
    title: string
    variant?: TitleVariant
  }

  let { title, variant = 'page', class: className, ...restProps }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiTitle', className)} data-variant={variant} {...restProps}>
  {title}
</div>

<style>
  .cthulhuUiTitle[data-variant='page'] {
    color: var(--ui-normal-text);
    font-size: 24px;
    font-weight: 700;
    line-height: 29px;
    overflow-wrap: anywhere;
  }

  .cthulhuUiTitle[data-variant='small'] {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 600;
    line-height: 21px;
  }

  .cthulhuUiTitle[data-variant='card'],
  .cthulhuUiTitle[data-variant='dialog'] {
    color: var(--ui-normal-text);
    font-size: 18px;
    font-weight: 500;
    line-height: 22px;
  }

  .cthulhuUiTitle[data-variant='dialog'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
