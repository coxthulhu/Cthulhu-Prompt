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

<div class={mergeClasses('cthulhuUiInfoRow', className)} data-testid={textTestId} {...restProps}>
  <Info class="cthulhuUiInfoRowIcon" size={16} strokeWidth={2} />
  <span class="cthulhuUiInfoRowText">{text}</span>
</div>

<style>
  .cthulhuUiInfoRow {
    align-items: center;
    box-sizing: border-box;
    color: var(--ui-secondary-text);
    display: grid;
    font-size: 13px;
    font-weight: 400;
    gap: 8px;
    grid-template-columns: 18px minmax(0, 1fr);
    line-height: 18px;
    margin-left: 24px;
    min-width: 0;
  }

  .cthulhuUiInfoRowIcon {
    color: var(--ui-secondary-icon-glyph);
  }

  .cthulhuUiInfoRowText {
    min-width: 0;
  }
</style>
