<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type IconOnlyButtonVariant = 'default' | 'borderless'

  type Props = {
    icon: ComponentType
    label: string
    variant?: IconOnlyButtonVariant
    disabled?: boolean
    class?: string
    iconClass?: string
    testId?: string
    title?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    label,
    variant = 'default',
    disabled = false,
    class: className,
    iconClass,
    testId,
    title,
    onclick
  }: Props = $props()
</script>

<button
  class={mergeClasses('cthulhuUiIconOnlyButton', `cthulhuUiIconOnlyButton--${variant}`, className)}
  type="button"
  aria-label={label}
  data-testid={testId}
  {title}
  {disabled}
  {onclick}
>
  <Icon class={mergeClasses('h-4 w-4', iconClass)} />
</button>

<style>
  .cthulhuUiIconOnlyButton {
    align-items: center;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 0.75rem;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    height: 2.25rem;
    justify-content: center;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
    width: 2.25rem;
  }

  .cthulhuUiIconOnlyButton--default {
    border-color: var(--ui-neutral-normal-border);
  }

  .cthulhuUiIconOnlyButton--borderless {
    /* Keep the transparent border in the box model so variants do not shift layout. */
    border-color: transparent;
    background-color: transparent;
  }

  .cthulhuUiIconOnlyButton:hover {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconOnlyButton--default:hover {
    border-color: var(--ui-neutral-hover-border);
  }

  .cthulhuUiIconOnlyButton--borderless:hover {
    border-color: transparent;
  }

  .cthulhuUiIconOnlyButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
