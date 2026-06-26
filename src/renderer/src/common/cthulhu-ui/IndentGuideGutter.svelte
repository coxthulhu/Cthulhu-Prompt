<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLDivElement> & {
    lineCount: number
    firstLineOffsetPx: number
    lineStepPx: number
    lineWidthPx: number
    lineTopInsetPx?: number
    lineBottomInsetPx?: number
  }

  let {
    lineCount,
    firstLineOffsetPx,
    lineStepPx,
    lineWidthPx,
    lineTopInsetPx = 0,
    lineBottomInsetPx = 0,
    class: className,
    ...restProps
  }: Props = $props()

  const lineIndexes = $derived(Array.from({ length: lineCount }, (_, index) => index))
  const gutterStyle = $derived(
    `--indent-guide-first-line-offset:${firstLineOffsetPx}px; --indent-guide-line-step:${lineStepPx}px; --indent-guide-line-width:${lineWidthPx}px; --indent-guide-line-top-inset:${lineTopInsetPx}px; --indent-guide-line-bottom-inset:${lineBottomInsetPx}px;`
  )
</script>

<div
  class={mergeClasses('cthulhuUiIndentGuideGutter', className)}
  style={gutterStyle}
  aria-hidden="true"
  {...restProps}
>
  <!-- Guide lines are absolute so row content can size from the same indent metrics. -->
  {#each lineIndexes as lineIndex (lineIndex)}
    <span
      class="cthulhuUiIndentGuideGutterLine"
      data-indent-guide-line=""
      style={`--indent-guide-line-index:${lineIndex};`}
    ></span>
  {/each}
</div>

<style>
  .cthulhuUiIndentGuideGutter {
    align-self: stretch;
    min-width: 0;
    position: relative;
  }

  .cthulhuUiIndentGuideGutterLine {
    background: var(--ui-neutral-emphasis-border);
    bottom: var(--indent-guide-line-bottom-inset);
    display: block;
    left: calc(
      var(--indent-guide-first-line-offset) +
        var(--indent-guide-line-step) * var(--indent-guide-line-index)
    );
    position: absolute;
    top: var(--indent-guide-line-top-inset);
    width: var(--indent-guide-line-width);
  }
</style>
