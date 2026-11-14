<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = HTMLAttributes<HTMLSpanElement>

  let { class: className, ...restProps }: Props = $props()
</script>

<!-- Green dot and label marking an item that is already shown in another tab. -->
<span
  class={mergeClasses('cthulhuUiOpenIndicator text-xs leading-4', className)}
  title="Open in another tab"
  {...restProps}
>
  <span class="cthulhuUiOpenIndicatorDot" aria-hidden="true"></span>
  Open
</span>

<style>
  .cthulhuUiOpenIndicator {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    gap: 5px;
    white-space: nowrap;
  }

  .cthulhuUiOpenIndicatorDot {
    background-color: var(--ui-success-normal-text);
    border-radius: 50%;
    flex: none;
    height: 6px;
    width: 6px;
  }
</style>
