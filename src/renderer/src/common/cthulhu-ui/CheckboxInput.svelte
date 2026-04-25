<script lang="ts">
  import { Check } from 'lucide-svelte'
  import type { HTMLLabelAttributes } from 'svelte/elements'
  import type { WithElementRef } from '@renderer/common/Cn.js'
  import { mergeClasses } from './mergeClasses'

  type Props = WithElementRef<
    HTMLLabelAttributes & {
      checked?: boolean
      disabled?: boolean
      inputTestId?: string
      label: string
    }
  >

  let {
    ref = $bindable(null),
    checked = $bindable(false),
    disabled = false,
    inputTestId,
    label,
    class: className,
    ...restProps
  }: Props = $props()
</script>

<label
  bind:this={ref}
  class={mergeClasses(
    'cthulhuUiCheckboxInput relative flex min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-[color,background-color,border-color,box-shadow]',
    className
  )}
  data-disabled={disabled}
  {...restProps}
>
  <!-- Native input keeps label clicks and keyboard toggling without bits-ui. -->
  <input
    class="cthulhuUiCheckboxInputNative"
    type="checkbox"
    bind:checked
    {disabled}
    data-testid={inputTestId}
  />
  <span class="cthulhuUiCheckboxInputControl" aria-hidden="true">
    {#if checked}
      <Check class="h-[15px] w-[15px]" strokeWidth={3} />
    {/if}
  </span>
  <span class="min-w-0 leading-5">{label}</span>
</label>

<style>
  .cthulhuUiCheckboxInput {
    border-color: var(--ui-neutral-normal-border);
    background-color: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
    box-shadow: inset 0 1px 2px var(--ui-shadow-inset);
  }

  .cthulhuUiCheckboxInput:hover {
    border-color: var(--ui-neutral-hover-border);
  }

  .cthulhuUiCheckboxInput[data-disabled='true'] {
    opacity: 0.5;
  }

  .cthulhuUiCheckboxInputNative {
    height: 1px;
    left: 0.75rem;
    opacity: 0;
    pointer-events: none;
    position: absolute;
    width: 1px;
  }

  .cthulhuUiCheckboxInputControl {
    align-items: center;
    background-color: var(--ui-neutral-normal-surface);
    border: 1px solid var(--ui-accent-normal-border);
    border-radius: 0.5rem;
    color: var(--ui-normal-text);
    display: inline-flex;
    flex: 0 0 auto;
    height: 1.5rem;
    justify-content: center;
    width: 1.5rem;
  }

  .cthulhuUiCheckboxInputNative:checked + .cthulhuUiCheckboxInputControl {
    background-color: var(--ui-accent-strong-surface);
    border-color: var(--ui-accent-strong-border);
  }

  .cthulhuUiCheckboxInputNative:focus-visible + .cthulhuUiCheckboxInputControl {
    border-color: var(--ui-neutral-focus-border);
    box-shadow: 0 0 0 3px var(--ui-accent-icon-ring);
  }
</style>
