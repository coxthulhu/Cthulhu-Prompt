<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'
  import type { WithElementRef } from '@renderer/common/Cn.js'
  import { mergeClasses } from './mergeClasses'

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> & {
      value?: string
      readonlyDisplay?: boolean
    }
  >

  let {
    ref = $bindable(null),
    value = $bindable(''),
    readonlyDisplay = false,
    readonly = false,
    tabindex,
    onpointerdown,
    onfocus,
    class: className,
    ...restProps
  }: Props = $props()

  const inputReadonly = $derived(readonlyDisplay || readonly)
  const inputTabindex = $derived(readonlyDisplay ? -1 : tabindex)

  const handlePointerDown = (event: PointerEvent & { currentTarget: HTMLInputElement }) => {
    if (readonlyDisplay) {
      event.preventDefault()
    }

    onpointerdown?.(event)
  }

  const handleFocus = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
    if (readonlyDisplay) {
      event.currentTarget.blur()
    }

    onfocus?.(event)
  }
</script>

<input
  bind:this={ref}
  class={mergeClasses(
    'cthulhuUiTextInput flex h-11 min-w-0 rounded-2xl border px-4 py-1 text-sm font-medium outline-none transition-[color,box-shadow,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50',
    readonlyDisplay ? 'cursor-default' : null,
    className
  )}
  type="text"
  bind:value
  readonly={inputReadonly}
  tabindex={inputTabindex}
  onpointerdown={handlePointerDown}
  onfocus={handleFocus}
  {...restProps}
/>

<style>
  .cthulhuUiTextInput {
    border-color: var(--ui-neutral-normal-border);
    background-color: var(--ui-neutral-field-surface);
    color: var(--ui-normal-text);
    box-shadow: inset 0 1px 2px var(--ui-shadow-inset);
  }

  .cthulhuUiTextInput::placeholder {
    color: var(--ui-muted-text);
  }

  .cthulhuUiTextInput::selection {
    background-color: var(--ui-neutral-selection-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiTextInput:focus-visible {
    border-color: var(--ui-neutral-focus-border);
    box-shadow:
      0 0 0 3px var(--ui-neutral-emphasis-surface),
      inset 0 1px 2px var(--ui-shadow-inset);
  }

  .cthulhuUiTextInput[aria-invalid='true'] {
    border-color: var(--ui-danger-strong-border);
  }

  .cthulhuUiTextInput[aria-invalid='true']:focus-visible {
    box-shadow:
      0 0 0 3px var(--ui-danger-normal-ring),
      inset 0 1px 2px var(--ui-shadow-inset);
  }
</style>
