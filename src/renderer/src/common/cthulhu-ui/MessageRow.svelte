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

<div
  class={mergeClasses(
    'cthulhuUiMessageRow inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm leading-5',
    className
  )}
  data-variant={variant}
  data-testid={textTestId}
  {...restProps}
>
  <!-- Variant controls both the icon and the row palette. -->
  <Icon class={mergeClasses('h-4 w-4', 'cthulhuUiMessageRowIcon')} />
  {text}
</div>

<style>
  .cthulhuUiMessageRow {
    color: var(--ui-normal-text);
  }

  .cthulhuUiMessageRowIcon {
    color: var(--cthulhu-ui-message-row-icon);
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
