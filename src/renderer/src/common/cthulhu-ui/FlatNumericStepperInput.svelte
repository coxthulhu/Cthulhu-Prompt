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

  const maxInputLength = 3
  const sanitizeNumeric = (raw: string) => raw.replace(/\D/g, '').slice(0, maxInputLength)
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
  class={mergeClasses('cthulhuUiFlatNumericStepperInput inline-grid h-10 min-h-10', className)}
  data-disabled={disabled ? 'true' : undefined}
  data-invalid={ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}
>
  <button
    class="cthulhuUiFlatNumericStepperInputButton"
    type="button"
    aria-label={decreaseLabel}
    disabled={disabled || !canDecrease}
    onclick={decreaseValue}
  >
    <Minus class="h-4 w-4" />
  </button>

  <label class="cthulhuUiFlatNumericStepperInputValue">
    <input
      bind:this={ref}
      class="cthulhuUiFlatNumericStepperInputNative font-semibold"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength={maxInputLength}
      bind:value
      {disabled}
      aria-invalid={ariaInvalid}
      oninput={handleInput}
      {...restProps}
    />
    {#if helperText}
      <span class="cthulhuUiFlatNumericStepperInputHelper">{helperText}</span>
    {/if}
  </label>

  <button
    class="cthulhuUiFlatNumericStepperInputButton"
    type="button"
    aria-label={increaseLabel}
    disabled={disabled || !canIncrease}
    onclick={increaseValue}
  >
    <Plus class="h-4 w-4" />
  </button>
</div>

<style>
  .cthulhuUiFlatNumericStepperInput {
    align-items: stretch;
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    color: var(--ui-normal-text);
    grid-template-columns: 40px minmax(80px, auto) 40px;
    min-width: 0;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .cthulhuUiFlatNumericStepperInput:focus-within {
    box-shadow: var(--cthulhu-ui-shadow-focus);
  }

  .cthulhuUiFlatNumericStepperInput[data-invalid='true']:focus-within {
    box-shadow: var(--cthulhu-ui-shadow-focus-danger);
  }

  .cthulhuUiFlatNumericStepperInput:focus-within .cthulhuUiFlatNumericStepperInputButton,
  .cthulhuUiFlatNumericStepperInput:focus-within .cthulhuUiFlatNumericStepperInputValue {
    border-color: var(--ui-neutral-focus-border);
  }

  .cthulhuUiFlatNumericStepperInput[data-invalid='true'] .cthulhuUiFlatNumericStepperInputButton,
  .cthulhuUiFlatNumericStepperInput[data-invalid='true'] .cthulhuUiFlatNumericStepperInputValue {
    border-color: var(--ui-danger-strong-border);
  }

  .cthulhuUiFlatNumericStepperInputButton {
    align-items: center;
    background-color: transparent;
    border: 1px solid var(--ui-neutral-normal-border);
    box-sizing: border-box;
    color: var(--ui-hoverable-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    height: 100%;
    justify-content: center;
    padding: 0;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .cthulhuUiFlatNumericStepperInputButton:first-child {
    border-bottom-left-radius: var(--cthulhu-ui-radius-control);
    border-top-left-radius: var(--cthulhu-ui-radius-control);
  }

  .cthulhuUiFlatNumericStepperInputButton:last-child {
    border-bottom-right-radius: var(--cthulhu-ui-radius-control);
    border-top-right-radius: var(--cthulhu-ui-radius-control);
  }

  .cthulhuUiFlatNumericStepperInputButton:hover {
    color: var(--ui-normal-text);
  }

  .cthulhuUiFlatNumericStepperInputButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiFlatNumericStepperInput[data-invalid='true']
    .cthulhuUiFlatNumericStepperInputButton:disabled {
    opacity: 1;
  }

  .cthulhuUiFlatNumericStepperInput[data-invalid='true']
    .cthulhuUiFlatNumericStepperInputButton:disabled
    :global(svg) {
    opacity: 0.5;
  }

  .cthulhuUiFlatNumericStepperInputValue {
    align-items: center;
    background-color: transparent;
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    border-top: 1px solid var(--ui-neutral-normal-border);
    cursor: text;
    display: inline-flex;
    gap: 6px;
    height: 100%;
    justify-content: center;
    min-width: 80px;
    padding: 0 12px;
  }

  .cthulhuUiFlatNumericStepperInputNative {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-size: 14px;
    height: 100%;
    line-height: 1.25;
    min-width: 2ch;
    outline: none;
    padding: 0;
    text-align: right;
    width: 3ch;
  }

  .cthulhuUiFlatNumericStepperInputNative::selection {
    background-color: var(--ui-neutral-selection-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiFlatNumericStepperInputNative:disabled {
    cursor: not-allowed;
  }

  .cthulhuUiFlatNumericStepperInput[data-disabled='true'] .cthulhuUiFlatNumericStepperInputValue {
    cursor: not-allowed;
  }

  .cthulhuUiFlatNumericStepperInputHelper {
    color: var(--ui-muted-text);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.25;
    white-space: nowrap;
  }

  .cthulhuUiFlatNumericStepperInput[data-disabled='true'] {
    opacity: 0.5;
  }
</style>
