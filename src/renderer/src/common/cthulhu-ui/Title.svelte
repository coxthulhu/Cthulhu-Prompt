<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type TitleVariant = 'page' | 'small' | 'card' | 'dialog' | 'row'

  const textClasses: Record<TitleVariant, string> = {
    page: '',
    small: 'text-sm',
    card: 'text-lg',
    dialog: 'text-lg',
    row: 'text-base'
  }

  type Props = HTMLAttributes<HTMLDivElement> & {
    title: string
    tooltip?: string
    variant?: TitleVariant
  }

  let { title, tooltip, variant = 'page', class: className, ...restProps }: Props = $props()
</script>

<div class={mergeClasses('cthulhuUiTitle', textClasses[variant], className)} data-variant={variant} title={tooltip} {...restProps}>
  {title}
</div>

<style>
  .cthulhuUiTitle {
    font-weight: var(--font-weight-semibold);
  }

  .cthulhuUiTitle[data-variant='row'] {
    color: inherit;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiTitle[data-variant='page'] {
    color: var(--ui-normal-text);
    /* Preserve the custom 28px/42px page heading outside Tailwind's text scale. */
    font-size: 28px;
    line-height: 42px;
    padding-bottom: 20px;
    overflow-wrap: anywhere;
  }

  .cthulhuUiTitle[data-variant='small'] {
    color: var(--ui-normal-text);
  }

  .cthulhuUiTitle[data-variant='card'],
  .cthulhuUiTitle[data-variant='dialog'] {
    color: var(--ui-normal-text);
  }

  .cthulhuUiTitle[data-variant='dialog'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
