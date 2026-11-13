<script lang="ts">
  import type { Icon } from 'lucide-svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = HTMLAttributes<HTMLSpanElement> & {
    icon?: typeof Icon
    count: number
    label: string
    iconClass?: string
  }

  let { icon: CountIcon, count, label, iconClass, class: className, ...restProps }: Props = $props()
</script>

<span
  class={mergeClasses('cthulhuUiCountDisplay text-sm leading-5', className)}
  {...restProps}
>
  {#if CountIcon}
    <CountIcon
      class={mergeClasses('cthulhuUiCountDisplayIcon shrink-0', iconClass)}
      size={18}
      aria-hidden="true"
    />
  {/if}
  <strong class="cthulhuUiCountDisplayValue text-base leading-6 font-semibold">{count}</strong>
  <span>{label}</span>
</span>

<style>
  .cthulhuUiCountDisplay {
    align-items: center;
    color: var(--ui-secondary-text);
    display: inline-flex;
    gap: 8px;
  }

  .cthulhuUiCountDisplay :global(.cthulhuUiCountDisplayIcon) {
    color: var(--ui-secondary-icon-glyph);
  }

  .cthulhuUiCountDisplayValue {
    color: var(--ui-normal-text);
  }
</style>
