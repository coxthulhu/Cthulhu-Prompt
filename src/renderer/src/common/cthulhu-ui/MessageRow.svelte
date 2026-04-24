<script lang="ts">
  import { AlertCircle, AlertTriangle } from 'lucide-svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  export type MessageRowVariant = 'error' | 'warning'

  type Props = HTMLAttributes<HTMLDivElement> & {
    text: string
    variant: MessageRowVariant
    textTestId?: string
  }

  let { text, variant, textTestId, class: className, ...restProps }: Props = $props()

  const Icon = $derived(variant === 'error' ? AlertCircle : AlertTriangle)
</script>

<div class={mergeClasses('cthulhuUiMessageRow', className)} data-variant={variant} {...restProps}>
  <!-- Variant controls both the icon and the row palette. -->
  <Icon class="cthulhuUiMessageRowIcon" />
  <span class="cthulhuUiMessageRowText" data-testid={textTestId}>{text}</span>
</div>

<style>
  .cthulhuUiMessageRow {
    align-items: center;
    border: 1px solid;
    border-radius: 16px;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 14px;
    font-weight: 600;
    gap: 10px;
    line-height: 1.35;
    min-height: 44px;
    padding: 10px 13px;
  }

  .cthulhuUiMessageRowIcon {
    color: var(--cthulhu-ui-message-row-icon);
    flex: 0 0 auto;
    height: 17px;
    width: 17px;
  }

  .cthulhuUiMessageRowText {
    color: var(--ui-normal-text);
    min-width: 0;
  }

  .cthulhuUiMessageRow[data-variant='error'] {
    --cthulhu-ui-message-row-icon: var(--ui-danger-icon-glyph);

    background: var(--ui-danger-normal-surface);
    border-color: var(--ui-danger-normal-border);
  }

  .cthulhuUiMessageRow[data-variant='warning'] {
    --cthulhu-ui-message-row-icon: var(--ui-warning-icon-glyph);

    background: var(--ui-warning-normal-surface);
    border-color: var(--ui-warning-normal-border);
  }
</style>
