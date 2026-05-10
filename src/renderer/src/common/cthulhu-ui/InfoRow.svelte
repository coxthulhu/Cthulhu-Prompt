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
  class={mergeClasses('cthulhuUiInfoRow', className)}
  data-testid={textTestId}
  {...restProps}
>
  <Info class="cthulhuUiInfoRowIcon" size={16} strokeWidth={2.4} />
  <span class="cthulhuUiInfoRowText">{text}</span>
</div>

<style>
  .cthulhuUiInfoRow {
    align-items: start;
    background: var(--ui-info-normal-surface);
    border: 1px solid var(--ui-info-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    color: var(--ui-secondary-text);
    display: grid;
    font-size: 12px;
    font-weight: 650;
    gap: 8px;
    grid-template-columns: 18px minmax(0, 1fr);
    line-height: 18px;
    min-width: 0;
    padding: 8px 10px;
  }

  .cthulhuUiInfoRowIcon {
    color: var(--ui-info-strong-border);
    margin-top: 1px;
  }

  .cthulhuUiInfoRowText {
    min-width: 0;
  }
</style>
