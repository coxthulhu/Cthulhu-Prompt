<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'
  import type { WithElementRef } from '@renderer/common/Cn.js'
  import { mergeClasses } from './mergeClasses'

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, 'type' | 'inputmode' | 'pattern' | 'value' | 'oninput' | 'files'> & {
      value?: string
      oninput?: (event: Event) => void
    }
  >

  let {
    ref = $bindable(null),
    value = $bindable(''),
    class: className,
    oninput: onInput,
    ...restProps
  }: Props = $props()

  const sanitizeNumeric = (raw: string) => raw.replace(/\D/g, '')

  // Keep input digits-only by stripping non-numeric characters.
  const handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    const sanitized = sanitizeNumeric(target.value)

    if (target.value !== sanitized) {
      target.value = sanitized
    }

    value = sanitized
    onInput?.(event)
  }
</script>

<input
  bind:this={ref}
  class={mergeClasses(
    'cthulhuUiNumericInput flex h-10 w-24 min-w-0 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 py-1 text-sm font-medium outline-none transition-[color,box-shadow,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  type="text"
  inputmode="numeric"
  pattern="[0-9]*"
  bind:value
  oninput={handleInput}
  {...restProps}
/>

<style>
  .cthulhuUiNumericInput {
    border-color: var(--ui-neutral-normal-border);
    background-color: var(--ui-neutral-field-surface);
    box-shadow: var(--cthulhu-ui-shadow-field);
    color: var(--ui-normal-text);
  }

  .cthulhuUiNumericInput::placeholder {
    color: var(--ui-muted-text);
  }

  .cthulhuUiNumericInput::selection {
    background-color: var(--ui-neutral-selection-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiNumericInput:focus-visible {
    border-color: var(--ui-neutral-focus-border);
    box-shadow:
      var(--cthulhu-ui-shadow-focus),
      var(--cthulhu-ui-shadow-field);
  }

  .cthulhuUiNumericInput[aria-invalid='true'] {
    border-color: var(--ui-danger-strong-border);
  }

  .cthulhuUiNumericInput[aria-invalid='true']:focus-visible {
    box-shadow:
      var(--cthulhu-ui-shadow-focus-danger),
      var(--cthulhu-ui-shadow-field);
  }
</style>
