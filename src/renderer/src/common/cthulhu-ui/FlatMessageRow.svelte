<script lang="ts">
  import { AlertCircle, AlertTriangle } from 'lucide-svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  export type FlatMessageRowVariant = 'danger' | 'warning'

  type Props = HTMLAttributes<HTMLDivElement> & {
    text: string
    variant: FlatMessageRowVariant
    textTestId?: string
  }

  let { text, variant, textTestId, class: className, ...restProps }: Props = $props()

  const Icon = $derived(variant === 'danger' ? AlertCircle : AlertTriangle)
</script>

<div
  class={mergeClasses(
    'cthulhuUiFlatMessageRow inline-flex h-11 items-center gap-2 rounded-[var(--cthulhu-ui-radius-control)] px-3 text-sm leading-5',
    className
  )}
  data-variant={variant}
  data-testid={textTestId}
  {...restProps}
>
  <!-- Variant controls both the icon and the row palette. -->
  <Icon class="cthulhuUiFlatMessageRowIcon h-4 w-4" aria-hidden="true" />
  {text}
</div>

<style>
  .cthulhuUiFlatMessageRow {
    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatMessageRowIcon {
    color: var(--cthulhu-ui-flat-message-row-icon);
  }

  .cthulhuUiFlatMessageRow[data-variant='danger'] {
    --cthulhu-ui-flat-message-row-icon: var(--ui-flat-danger-icon-glyph);

    background: var(--ui-flat-danger-normal-surface);
  }

  .cthulhuUiFlatMessageRow[data-variant='warning'] {
    --cthulhu-ui-flat-message-row-icon: var(--ui-flat-warning-icon-glyph);

    background: var(--ui-flat-warning-normal-surface);
  }
</style>
