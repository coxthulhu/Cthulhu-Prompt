<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type TitleVariant = 'page' | 'small' | 'card' | 'dialog' | 'row' | 'workspace'

  const textClasses: Record<TitleVariant, string> = {
    page: 'text-3xl leading-9',
    small: 'text-sm',
    card: 'text-lg',
    dialog: 'text-lg',
    row: 'text-base',
    workspace: 'text-2xl leading-8'
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

  .cthulhuUiTitle[data-variant='row'],
  .cthulhuUiTitle[data-variant='workspace'] {
    color: inherit;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiTitle[data-variant='workspace'] {
    color: var(--ui-normal-text);
    letter-spacing: -0.03em;
  }

  .cthulhuUiTitle[data-variant='page'] {
    color: var(--ui-normal-text);
    /* Give Windows glyphs room beyond the 36px line without enlarging the layout height. */
    height: 40px;
    margin-block: -2px;
    padding-block: 2px;
    letter-spacing: -0.03em;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
