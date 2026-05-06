<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type IconPillButtonVariant = 'accent' | 'neutral'

  type Props = {
    icon: ComponentType
    text: string
    variant?: IconPillButtonVariant
    disabled?: boolean
    class?: string
    iconClass?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    variant = 'neutral',
    disabled = false,
    class: className,
    iconClass,
    testId,
    onclick
  }: Props = $props()
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiIconPillButton', className)}
  data-testid={testId}
  data-variant={variant}
  {disabled}
  {onclick}
>
  <Icon class={mergeClasses('h-3.5 w-3.5', iconClass)} />
  {text}
</button>

<style>
  .cthulhuUiIconPillButton {
    align-items: center;
    border: 1px solid transparent;
    border-radius: 999px;
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 0.75rem;
    font-weight: 750;
    gap: 0.4375rem;
    height: 1.875rem;
    line-height: 1rem;
    padding: 0 0.75rem;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
    white-space: nowrap;
  }

  .cthulhuUiIconPillButton[data-variant='accent'] {
    background-color: var(--ui-accent-normal-surface);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiIconPillButton[data-variant='accent']:hover {
    background-color: var(--ui-accent-hover-surface);
    border-color: var(--ui-accent-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconPillButton[data-variant='neutral'] {
    background-color: var(--ui-neutral-normal-surface);
    border-color: var(--ui-neutral-normal-border);
    color: var(--ui-hoverable-text);
  }

  .cthulhuUiIconPillButton[data-variant='neutral']:hover {
    background-color: var(--ui-neutral-hover-surface);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconPillButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
