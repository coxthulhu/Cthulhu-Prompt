<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type ButtonState = 'enabled' | 'active' | 'inactive' | 'disabled'

  type Props = {
    icon: ComponentType
    text: string
    state?: ButtonState
    class?: string
    iconClass?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    state = 'enabled',
    class: className,
    iconClass,
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
  <Icon class={mergeClasses('h-4 w-4', iconClass)} />
  {text}
</button>

<style>
  .cthulhuUiIconTextButton[data-state='active'] {
    border-color: var(--ui-border-emphasis);
    background-color: var(--ui-surface-emphasis);
    color: var(--ui-text-bright);
    box-shadow: inset 0 1px 0 var(--ui-surface-default);
  }

  .cthulhuUiIconTextButton[data-state='inactive'] {
    border-color: var(--ui-border-muted);
    background-color: var(--ui-surface-muted);
    color: var(--ui-text-muted);
  }

  .cthulhuUiIconTextButton[data-state='inactive']:hover {
    border-color: var(--ui-surface-hover);
    background-color: var(--ui-surface-default);
    color: var(--ui-text);
  }

  .cthulhuUiIconTextButton[data-state='enabled'],
  .cthulhuUiIconTextButton[data-state='disabled'] {
    border-color: var(--ui-border-default);
    background-color: var(--ui-surface-default);
    color: var(--ui-text);
    box-shadow: inset 0 1px 0 var(--ui-surface-muted);
  }

  .cthulhuUiIconTextButton[data-state='enabled']:hover,
  .cthulhuUiIconTextButton[data-state='disabled']:hover {
    background-color: var(--ui-surface-hover);
    color: var(--ui-text-bright);
  }
</style>
