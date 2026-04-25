<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    icon: ComponentType
    label: string
    disabled?: boolean
    class?: string
    iconClass?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    label,
    disabled = false,
    class: className,
    iconClass,
    onclick
  }: Props = $props()
</script>

<button
  class={mergeClasses('cthulhuUiIconOnlyButton', className)}
  type="button"
  aria-label={label}
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

  .cthulhuUiIconOnlyButton:hover {
    background-color: var(--ui-neutral-hover-surface);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconOnlyButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
