<script lang="ts">
  import { Info } from 'lucide-svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    text: string
    textTestId?: string
  }

  let { text, textTestId, class: className, ...restProps }: Props = $props()
</script>

<div
  class={mergeClasses('cthulhuUiFlatInfoRow', className)}
  data-testid={textTestId}
  {...restProps}
>
  <Info class="cthulhuUiFlatInfoRowIcon" size={16} strokeWidth={2.4} />
  <span class="cthulhuUiFlatInfoRowText">{text}</span>
</div>

<style>
  .cthulhuUiFlatInfoRow {
    align-items: center;
    background: var(--ui-flat-neutral-normal-surface);
    border: 1px solid var(--ui-flat-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    color: var(--ui-flat-secondary-text);
    display: grid;
    font-size: 12px;
    font-weight: 600;
    gap: 8px;
    grid-template-columns: 18px minmax(0, 1fr);
    line-height: 18px;
    min-width: 0;
    padding: 6px 10px;
  }

  .cthulhuUiFlatInfoRowIcon {
    color: var(--ui-flat-secondary-icon-glyph);
  }

  .cthulhuUiFlatInfoRowText {
    min-width: 0;
  }
</style>
