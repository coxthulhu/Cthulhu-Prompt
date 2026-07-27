<script lang="ts">
  import { mergeClasses } from './mergeClasses'

  export type InlineTextButtonSize = 'default' | 'compact'
  export type InlineTextButtonBaseVariant = 'muted' | 'secondary'

  type Props = {
    text: string
    size?: InlineTextButtonSize
    baseVariant?: InlineTextButtonBaseVariant
    rowState?: string
    class?: string
    testId?: string
    title?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    text,
    size = 'compact',
    baseVariant = 'muted',
    rowState,
    class: className,
    testId,
    title,
    onclick
  }: Props = $props()
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiInlineTextButton', className)}
  data-size={size}
  data-base-variant={baseVariant}
  data-row-state={rowState}
  data-testid={testId}
  {title}
  {onclick}
>
  {text}
</button>

<style>
  .cthulhuUiInlineTextButton {
    display: inline-flex;
    min-width: 0;
    cursor: pointer;
    align-items: center;
    border: 0;
    background: transparent;
    padding: var(--cthulhu-ui-inline-text-button-padding, 0);
    color: var(--ui-muted-text);
    font-size: 13px;
    font-weight: 400;
    line-height: var(--cthulhu-ui-inline-text-button-line-height, 18px);
    text-align: inherit;
    transition: color 50ms ease-out;
  }

  .cthulhuUiInlineTextButton[data-size='default'] {
    font-size: 14px;
    line-height: 20px;
  }

  .cthulhuUiInlineTextButton[data-base-variant='secondary'] {
    color: var(--ui-secondary-text);
  }

  .cthulhuUiInlineTextButton:not([data-row-state='drag-idle']):hover,
  .cthulhuUiInlineTextButton:focus-visible {
    color: var(--ui-normal-text);
  }
</style>
