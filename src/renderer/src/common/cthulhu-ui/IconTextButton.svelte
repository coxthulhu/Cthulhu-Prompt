<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type ButtonState = 'enabled' | 'active' | 'inactive' | 'disabled'

  type Props = {
    icon: ComponentType
    text: string
    state?: ButtonState
    class?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    state = 'enabled',
    class: className,
    testId,
    onclick
  }: Props = $props()

  const isDisabled = $derived(state === 'disabled')
</script>

<button
  type="button"
  class={mergeClasses(
    'cthulhuUiIconTextButton inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
    className
  )}
  data-active={state === 'active'}
  data-state={state}
  data-testid={testId}
  {onclick}
  disabled={isDisabled}
>
  <Icon class="h-4 w-4" />
  {text}
</button>

<style>
  .cthulhuUiIconTextButton[data-state='active'] {
    border-color: var(--cthulhu-ui-icon-button-border-active);
    background-color: var(--cthulhu-ui-icon-button-surface-active);
    color: var(--cthulhu-ui-icon-button-text-active);
    box-shadow: inset 0 1px 0 var(--cthulhu-ui-icon-button-highlight-active);
  }

  .cthulhuUiIconTextButton[data-state='inactive'] {
    border-color: var(--cthulhu-ui-icon-button-border-inactive);
    background-color: var(--cthulhu-ui-icon-button-surface-inactive);
    color: var(--cthulhu-ui-icon-button-text-inactive);
  }

  .cthulhuUiIconTextButton[data-state='inactive']:hover {
    border-color: var(--cthulhu-ui-icon-button-border-inactive-hover);
    background-color: var(--cthulhu-ui-icon-button-surface-inactive-hover);
    color: var(--cthulhu-ui-icon-button-text-inactive-hover);
  }

  .cthulhuUiIconTextButton[data-state='enabled'],
  .cthulhuUiIconTextButton[data-state='disabled'] {
    border-color: var(--cthulhu-ui-icon-button-border-enabled);
    background-color: var(--cthulhu-ui-icon-button-surface-enabled);
    color: var(--cthulhu-ui-icon-button-text-enabled);
    box-shadow: inset 0 1px 0 var(--cthulhu-ui-icon-button-highlight-enabled);
  }

  .cthulhuUiIconTextButton[data-state='enabled']:hover,
  .cthulhuUiIconTextButton[data-state='disabled']:hover {
    background-color: var(--cthulhu-ui-icon-button-surface-enabled-hover);
    color: var(--cthulhu-ui-icon-button-text-enabled-hover);
  }
</style>
