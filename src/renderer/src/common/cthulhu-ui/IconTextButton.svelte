<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type ButtonState = 'active' | 'enabled' | 'disabled'
  type ButtonVariant = 'neutral' | 'accent' | 'nav'

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
    variant = 'neutral',
    class: className,
    iconClass,
    testId,
    onclick
  }: Props = $props()

  const isDisabled = $derived(state === 'disabled')
  const variantClass = $derived(
    variant === 'nav' && state === 'active'
      ? 'cthulhuUiIconTextButton--navActive'
      : variant === 'nav' && state === 'enabled'
        ? 'cthulhuUiIconTextButton--navEnabled'
        : variant === 'accent'
          ? 'cthulhuUiIconTextButton--accent'
          : 'cthulhuUiIconTextButton--neutral'
  )
</script>

<button
  type="button"
  class={mergeClasses(
    'cthulhuUiIconTextButton inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 text-sm font-medium leading-5 transition disabled:pointer-events-none disabled:opacity-50',
    variantClass,
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
  /* Nav buttons show selected/unselected states, such as sidebar navigation. */
  .cthulhuUiIconTextButton--navActive {
    border-color: var(--ui-neutral-emphasis-border);
    background-color: var(--ui-neutral-emphasis-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconTextButton--navEnabled {
    border-color: var(--ui-neutral-muted-border);
    background-color: var(--ui-neutral-muted-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-hoverable-text);
  }

  .cthulhuUiIconTextButton--navEnabled:hover {
    border-color: var(--ui-neutral-hover-border);
    background-color: var(--ui-neutral-normal-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconTextButton--accent {
    border-color: var(--ui-accent-normal-border);
    background-color: var(--ui-accent-normal-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiIconTextButton--accent:hover {
    border-color: var(--ui-accent-hover-border);
    background-color: var(--ui-accent-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconTextButton--neutral {
    border-color: var(--ui-neutral-normal-border);
    background-color: var(--ui-neutral-normal-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-hoverable-text);
  }

  .cthulhuUiIconTextButton--neutral:hover {
    border-color: var(--ui-neutral-hover-border);
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }
</style>
