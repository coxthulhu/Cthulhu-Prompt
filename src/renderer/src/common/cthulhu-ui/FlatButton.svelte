<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'
  import './flatActionButton.css'

  export type FlatButtonVariant = 'neutral' | 'accent' | 'danger'
  type FlatButtonState = 'enabled' | 'disabled'

  type Props = Omit<HTMLButtonAttributes, 'type' | 'disabled'> & {
    icon?: ComponentType
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
    onclick,
    ...restProps
  }: Props = $props()

  const isDisabled = $derived(state === 'disabled')
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiFlatActionButton cthulhuUiFlatButton', className)}
  data-variant={variant}
  data-testid={testId}
  {onclick}
  disabled={isDisabled}
  {...restProps}
>
  <!-- Flat text action button for row-level commands; icons are optional. -->
  {#if Icon}
    <Icon
      class={mergeClasses('cthulhuUiFlatButtonIcon', iconClass)}
      size={16}
      aria-hidden="true"
    />
  {/if}
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
    stroke-width: 2;
  }
</style>
