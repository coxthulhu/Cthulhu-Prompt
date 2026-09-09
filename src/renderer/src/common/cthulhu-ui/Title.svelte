<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type TitleVariant = 'page' | 'small' | 'card' | 'dialog' | 'row'

  type Props = HTMLAttributes<HTMLDivElement> & {
    title: string
    tooltip?: string
    variant?: TitleVariant
  }

  let { title, tooltip, variant = 'page', class: className, ...restProps }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiTitle', className)} data-variant={variant} title={tooltip} {...restProps}>
  {title}
</div>

<style>
  .cthulhuUiTitle {
    font-weight: var(--font-weight-semibold);
    line-height: 1.5;
  }

  .cthulhuUiTitle[data-variant='row'] {
    color: inherit;
    font-size: var(--cthulhu-ui-font-size-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiTitle[data-variant='page'] {
    color: var(--ui-normal-text);
    font-size: 28px;
    padding-bottom: 20px;
    overflow-wrap: anywhere;
  }

  .cthulhuUiTitle[data-variant='small'] {
    color: var(--ui-normal-text);
    font-size: 14px;
  }

  .cthulhuUiTitle[data-variant='card'],
  .cthulhuUiTitle[data-variant='dialog'] {
    color: var(--ui-normal-text);
    font-size: 18px;
  }

  .cthulhuUiTitle[data-variant='dialog'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
