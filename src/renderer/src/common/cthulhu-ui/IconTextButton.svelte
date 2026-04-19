<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type ButtonState = 'active' | 'enabled' | 'disabled'
  type ButtonVariant = 'default' | 'activatable'

  type Props = {
    icon: ComponentType
    text: string
    state?: ButtonState
    variant?: ButtonVariant
    class?: string
    iconClass?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    state = 'enabled',
    variant = 'default',
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
    variant === 'activatable' && state === 'active'
      ? 'cthulhuUiIconTextButton--activatableActive'
      : null,
    variant === 'activatable' && state === 'enabled'
      ? 'cthulhuUiIconTextButton--activatableEnabled'
      : null,
    variant === 'default' || state === 'disabled'
      ? 'cthulhuUiIconTextButton--defaultSurface'
      : null,
    className
  )}
  data-active={state === 'active'}
  data-testid={testId}
  {onclick}
  disabled={isDisabled}
>
  <Icon class={mergeClasses('h-4 w-4', iconClass)} />
  {text}
</button>

<style>
  /* Activatable buttons show selected/unselected states, such as sidebar navigation. */
  .cthulhuUiIconTextButton--activatableActive {
    border-color: var(--ui-border-emphasis);
    background-color: var(--ui-surface-emphasis);
    color: var(--ui-text-bright);
    box-shadow: inset 0 1px 0 var(--ui-surface-default);
  }

  .cthulhuUiIconTextButton--activatableEnabled {
    border-color: var(--ui-border-muted);
    background-color: var(--ui-surface-muted);
    color: var(--ui-text-muted);
  }

  .cthulhuUiIconTextButton--activatableEnabled:hover {
    border-color: var(--ui-surface-hover);
    background-color: var(--ui-surface-default);
    color: var(--ui-text);
  }

  .cthulhuUiIconTextButton--defaultSurface {
    border-color: var(--ui-border-default);
    background-color: var(--ui-surface-default);
    color: var(--ui-text);
    box-shadow: inset 0 1px 0 var(--ui-surface-muted);
  }

  .cthulhuUiIconTextButton--defaultSurface:hover {
    background-color: var(--ui-surface-hover);
    color: var(--ui-text-bright);
  }
</style>
