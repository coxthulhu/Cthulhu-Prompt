<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'
  import './flatActionButton.css'

  export type FlatButtonVariant = 'neutral' | 'accent'
  type FlatButtonState = 'enabled' | 'disabled'

  type Props = {
    icon: ComponentType
    text: string
    variant?: FlatButtonVariant
    state?: FlatButtonState
    class?: string
    iconClass?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    variant = 'neutral',
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
  class={mergeClasses('cthulhuUiFlatActionButton cthulhuUiFlatButton', className)}
  data-variant={variant}
  data-state={state}
  data-testid={testId}
  {onclick}
  disabled={isDisabled}
>
  <!-- Flat text action button with a leading icon. -->
  <Icon class={mergeClasses('cthulhuUiFlatButtonIcon', iconClass)} size={16} aria-hidden="true" />
  <span>{text}</span>
</button>

<style>
  .cthulhuUiFlatButton {
    cursor: pointer;
  }

  .cthulhuUiFlatButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiFlatButtonIcon {
    flex: 0 0 auto;
    stroke-width: 2.2;
  }
</style>
