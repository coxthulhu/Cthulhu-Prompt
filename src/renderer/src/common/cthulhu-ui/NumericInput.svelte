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
    'cthulhuUiNumericInput flex h-9 min-w-0 rounded-2xl border px-3 py-1 text-base outline-none transition-[color,box-shadow,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
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
    border-color: var(--ui-white-12);
    background-color: var(--ui-surface-input);
    color: var(--ui-text-strong);
    box-shadow: inset 0 1px 2px var(--ui-shadow-25);
  }

  .cthulhuUiNumericInput::placeholder {
    color: var(--ui-text-muted);
  }

  .cthulhuUiNumericInput::selection {
    background-color: var(--ui-white-22);
    color: var(--ui-white);
  }

  .cthulhuUiNumericInput:focus-visible {
    border-color: var(--ui-white-28);
    box-shadow:
      0 0 0 3px var(--ui-white-14),
      inset 0 1px 2px var(--ui-shadow-25);
  }

  .cthulhuUiNumericInput[aria-invalid='true'] {
    border-color: var(--ui-danger);
  }

  .cthulhuUiNumericInput[aria-invalid='true']:focus-visible {
    box-shadow:
      0 0 0 3px var(--ui-danger-ring),
      inset 0 1px 2px var(--ui-shadow-25);
  }
</style>
