<script lang="ts">
  import '@renderer/common/cthulhu-ui/buttons/button.css'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  export type InlineTextButtonSize = 'default' | 'compact'
  export type InlineTextButtonBaseVariant = 'muted' | 'secondary'

  type Props = {
    text: string
    size?: InlineTextButtonSize
    baseVariant?: InlineTextButtonBaseVariant
    /** Disables inline actions using the same behavior as other buttons. */
    disabled?: boolean
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
    disabled = false,
    rowState,
    class: className,
    testId,
    title,
    onclick
  }: Props = $props()
</script>

<!-- Button line heights are explicitly excluded from text defaults to preserve compact rows. -->
<button
  type="button"
  class={mergeClasses('cthulhuUiButtonBase cthulhuUiInlineTextButton text-sm', size === 'default' ? 'leading-5' : 'leading-4.5', className)}
  data-size={size}
  data-base-variant={baseVariant}
  data-row-state={rowState}
  data-testid={testId}
  {title}
  {disabled}
  {onclick}
>
  <span class="cthulhuUiInlineTextButtonLabel">{text}</span>
</button>

<style>
  .cthulhuUiInlineTextButton {
    color: var(--ui-muted-text);
    font-weight: var(--font-weight-normal);
    text-align: inherit;
    transition: color var(--ui-animation-duration-fast) ease-out;
  }

  .cthulhuUiInlineTextButtonLabel {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiInlineTextButton[data-base-variant='secondary'] {
    color: var(--ui-secondary-text);
  }

  .cthulhuUiInlineTextButton:not([data-row-state='drag-idle']):hover,
  .cthulhuUiInlineTextButton:focus-visible {
    color: var(--ui-normal-text);
  }
</style>
