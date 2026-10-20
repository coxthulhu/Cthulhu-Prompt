<script lang="ts">
  import { Check, Copy } from 'lucide-svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    control: 'checkbox' | 'radio' | 'copy'
    /** Whether the owning picker row is the current selection. */
    checked: boolean
    class?: string
  }

  let { control, checked, class: className }: Props = $props()
</script>

<!-- Decorative state mark; the owning row button carries the accessible pressed state. -->
<span
  class={mergeClasses('cthulhuUiSelectionIndicator', className)}
  data-control={control}
  data-checked={checked ? 'true' : 'false'}
  aria-hidden="true"
>
  {#if control === 'checkbox'}
    <Check size={13} />
  {:else if control === 'copy'}
    <Copy size={16} />
  {/if}
</span>

<style>
  .cthulhuUiSelectionIndicator {
    align-items: center;
    display: inline-flex;
    flex: 0 0 auto;
    height: 17px;
    justify-content: center;
    width: 17px;
  }

  .cthulhuUiSelectionIndicator[data-control='checkbox'] {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 4px;
    color: transparent;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .cthulhuUiSelectionIndicator[data-control='checkbox'][data-checked='true'] {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiSelectionIndicator[data-control='radio'] {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 50%;
  }

  .cthulhuUiSelectionIndicator[data-control='radio']::after {
    border-radius: 50%;
    content: '';
    height: 9px;
    width: 9px;
  }

  .cthulhuUiSelectionIndicator[data-control='radio'][data-checked='true'] {
    border-color: var(--ui-accent-normal-border);
  }

  .cthulhuUiSelectionIndicator[data-control='radio'][data-checked='true']::after {
    background: var(--ui-normal-text);
  }

  .cthulhuUiSelectionIndicator[data-control='copy'] {
    color: var(--ui-secondary-icon-glyph);
  }
</style>
