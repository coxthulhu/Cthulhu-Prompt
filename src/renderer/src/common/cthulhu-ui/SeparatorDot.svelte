<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type Props = HTMLAttributes<HTMLSpanElement> & {
    elementRef?: HTMLSpanElement | null
  }

  let { class: className, elementRef = $bindable(null), ...restProps }: Props = $props()
</script>

<span
  bind:this={elementRef}
  aria-hidden="true"
  class={mergeClasses('cthulhuUiSeparatorDot', className)}
  {...restProps}
></span>

<style>
  .cthulhuUiSeparatorDot {
    background: currentColor;
    border-radius: 999px;
    display: inline-block;
    flex: 0 0 auto;
    height: 3px;
    width: 3px;
  }
</style>
