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
      onvaluechange?: (value: string) => void
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
    'aria-invalid': ariaInvalid,
    oninput: onInput,
    onvaluechange,
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
    onvaluechange?.(sanitized)
    onInput?.(event)
  }

  const decreaseValue = () => {
    if (parsedValue !== null && canDecrease) {
      value = String(parsedValue - 1)
      onvaluechange?.(value)
    }
  }

  const increaseValue = () => {
    if (parsedValue !== null && canIncrease) {
      value = String(parsedValue + 1)
      onvaluechange?.(value)
    }
  }
</script>

<div
  class={mergeClasses('cthulhuUiNumericStepperInput inline-grid h-10 min-h-10', className)}
  data-disabled={disabled ? 'true' : undefined}
  data-invalid={ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
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
      aria-invalid={ariaInvalid}
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
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    box-shadow: var(--cthulhu-ui-shadow-field);
    color: var(--ui-normal-text);
    grid-template-columns: 2.5rem minmax(5rem, auto) 2.5rem;
    min-width: 0;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .cthulhuUiNumericStepperInput:focus-within {
    box-shadow:
      var(--cthulhu-ui-shadow-focus),
      var(--cthulhu-ui-shadow-field);
  }

  .cthulhuUiNumericStepperInput[data-invalid='true']:focus-within {
    box-shadow:
      var(--cthulhu-ui-shadow-focus-danger),
      var(--cthulhu-ui-shadow-field);
  }

  .cthulhuUiNumericStepperInput:focus-within .cthulhuUiNumericStepperInputButton,
  .cthulhuUiNumericStepperInput:focus-within .cthulhuUiNumericStepperInputValue {
    border-color: var(--ui-neutral-focus-border);
  }

  .cthulhuUiNumericStepperInput[data-invalid='true'] .cthulhuUiNumericStepperInputButton,
  .cthulhuUiNumericStepperInput[data-invalid='true'] .cthulhuUiNumericStepperInputValue {
    border-color: var(--ui-danger-strong-border);
  }

  .cthulhuUiNumericStepperInputButton {
    align-items: center;
    background-color: var(--ui-neutral-field-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: inline-flex;
    height: 100%;
    justify-content: center;
    padding: 0;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .cthulhuUiNumericStepperInputButton:first-child {
    border-bottom-left-radius: var(--cthulhu-ui-radius-control);
    border-top-left-radius: var(--cthulhu-ui-radius-control);
  }

  .cthulhuUiNumericStepperInputButton:last-child {
    border-bottom-right-radius: var(--cthulhu-ui-radius-control);
    border-top-right-radius: var(--cthulhu-ui-radius-control);
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
    background-color: var(--ui-neutral-field-surface);
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    border-top: 1px solid var(--ui-neutral-normal-border);
    display: inline-flex;
    gap: 0.375rem;
    height: 100%;
    justify-content: center;
    min-width: 5rem;
    padding: 0 0.75rem;
  }

  .cthulhuUiNumericStepperInputNative {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-size: 0.875rem;
    font-weight: 650;
    height: 100%;
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
