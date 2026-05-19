<script lang="ts">
  import { Minus, Plus } from 'lucide-svelte'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import type { WithElementRef } from '@renderer/common/Cn.js'
  import { mergeClasses } from './mergeClasses'

  type Props = WithElementRef<
    Omit<
      HTMLInputAttributes,
      'type' | 'inputmode' | 'pattern' | 'value' | 'oninput' | 'files' | 'min' | 'max' | 'step'
    > & {
      value?: string
      min: number
      max: number
      helperText?: string
      decreaseLabel?: string
      increaseLabel?: string
      oninput?: (event: Event) => void
    }
  >

  let {
    ref = $bindable(null),
    value = $bindable(''),
    min,
    max,
    helperText,
    decreaseLabel = 'Decrease value',
    increaseLabel = 'Increase value',
    disabled = false,
    class: className,
    oninput: onInput,
    ...restProps
  }: Props = $props()

  const sanitizeNumeric = (raw: string) => raw.replace(/\D/g, '')
  const parsedValue = $derived(/^\d+$/.test(value) ? Number(value) : null)
  const canDecrease = $derived(parsedValue !== null && parsedValue - 1 >= min)
  const canIncrease = $derived(parsedValue !== null && parsedValue + 1 <= max)

  // Keep typed input digits-only by matching NumericInput behavior.
  const handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    const sanitized = sanitizeNumeric(target.value)

    if (target.value !== sanitized) {
      target.value = sanitized
    }

    value = sanitized
    onInput?.(event)
  }

  const decreaseValue = () => {
    if (parsedValue !== null && canDecrease) {
      value = String(parsedValue - 1)
    }
  }

  const increaseValue = () => {
    if (parsedValue !== null && canIncrease) {
      value = String(parsedValue + 1)
    }
  }
</script>

<div
  class={mergeClasses('cthulhuUiNumericStepperInput', className)}
  data-disabled={disabled ? 'true' : undefined}
>
  <button
    class="cthulhuUiNumericStepperInputButton"
    type="button"
    aria-label={decreaseLabel}
    disabled={disabled || !canDecrease}
    onclick={decreaseValue}
  >
    <Minus class="h-3.5 w-3.5" />
  </button>

  <div class="cthulhuUiNumericStepperInputValue">
    <input
      bind:this={ref}
      class="cthulhuUiNumericStepperInputNative"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      bind:value
      {disabled}
      oninput={handleInput}
      {...restProps}
    />
    {#if helperText}
      <span class="cthulhuUiNumericStepperInputHelper">{helperText}</span>
    {/if}
  </div>

  <button
    class="cthulhuUiNumericStepperInputButton"
    type="button"
    aria-label={increaseLabel}
    disabled={disabled || !canIncrease}
    onclick={increaseValue}
  >
    <Plus class="h-3.5 w-3.5" />
  </button>
</div>

<style>
  .cthulhuUiNumericStepperInput {
    align-items: stretch;
    background-color: var(--ui-neutral-field-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-shadow: var(--cthulhu-ui-shadow-field);
    color: var(--ui-normal-text);
    display: inline-grid;
    grid-template-columns: 2.5rem minmax(5rem, auto) 2.5rem;
    height: 2.75rem;
    min-width: 0;
    overflow: hidden;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .cthulhuUiNumericStepperInput:focus-within {
    border-color: var(--ui-neutral-focus-border);
    box-shadow:
      var(--cthulhu-ui-shadow-focus),
      var(--cthulhu-ui-shadow-field);
  }

  .cthulhuUiNumericStepperInputButton {
    align-items: center;
    background-color: transparent;
    border: 0;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: inline-flex;
    justify-content: center;
    padding: 0;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .cthulhuUiNumericStepperInputButton:first-child {
    border-right: 1px solid var(--ui-neutral-muted-border);
  }

  .cthulhuUiNumericStepperInputButton:last-child {
    border-left: 1px solid var(--ui-neutral-muted-border);
  }

  .cthulhuUiNumericStepperInputButton:hover {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiNumericStepperInputButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiNumericStepperInputValue {
    align-items: center;
    display: inline-flex;
    gap: 0.375rem;
    justify-content: center;
    min-width: 0;
    padding: 0 0.75rem;
  }

  .cthulhuUiNumericStepperInputNative {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-size: 0.875rem;
    font-weight: 650;
    line-height: 1.25;
    min-width: 2ch;
    outline: none;
    padding: 0;
    text-align: right;
    width: 3ch;
  }

  .cthulhuUiNumericStepperInputNative::selection {
    background-color: var(--ui-neutral-selection-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiNumericStepperInputNative:disabled {
    cursor: not-allowed;
  }

  .cthulhuUiNumericStepperInputHelper {
    color: var(--ui-muted-text);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.25;
    white-space: nowrap;
  }

  .cthulhuUiNumericStepperInput[data-disabled='true'] {
    opacity: 0.5;
  }
</style>
