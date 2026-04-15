<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import CardSurface from './CardSurface.svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    label: string
    text: string
    valueTitle?: string
    valueTestId?: string
  }

  let { label, text, valueTitle, valueTestId, class: className, ...restProps }: Props = $props()
</script>

<!-- Reusable stacked label/value field for read-only metadata. -->
<CardSurface
  variant="subcard"
  class={mergeClasses('flex min-h-0 min-w-0 flex-col gap-2', className)}
  {...restProps}
>
  <div class="cthulhuUiLabeledDisplayFieldLabel">{label}</div>
  <div
    class="cthulhuUiLabeledDisplayFieldValue min-w-0 truncate"
    data-testid={valueTestId}
    title={valueTitle}
  >
    {text}
  </div>
</CardSurface>

<style>
  .cthulhuUiLabeledDisplayFieldLabel {
    color: var(--ui-text-muted);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .cthulhuUiLabeledDisplayFieldValue {
    color: var(--ui-text-strong);
    font-size: 0.875rem;
    font-weight: 400;
    padding-left: 0.375rem;
  }

  .cthulhuUiLabeledDisplayFieldValue::selection {
    background-color: var(--ui-selection-surface);
    color: var(--ui-text-bright);
  }
</style>
