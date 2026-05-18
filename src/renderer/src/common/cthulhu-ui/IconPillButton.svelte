<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    icon: ComponentType
    text: string
    disabled?: boolean
    class?: string
    iconClass?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
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
  {disabled}
  {onclick}
>
  <Icon class={mergeClasses('h-3.5 w-3.5', iconClass)} />
  {text}
</button>

<style>
  .cthulhuUiIconPillButton {
    align-items: center;
    background-color: var(--ui-accent-normal-surface);
    border: 1px solid var(--ui-accent-normal-border);
    border-radius: 999px;
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-accent-normal-text);
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

  .cthulhuUiIconPillButton:hover {
    background-color: var(--ui-accent-hover-surface);
    border-color: var(--ui-accent-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconPillButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
