<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'
  import './actionButton.css'

  export type ButtonVariant = 'neutral' | 'accent' | 'danger'
  export type ButtonAppearance = 'filled' | 'outline'
  type ButtonState = 'enabled' | 'disabled'

  type Props = Omit<HTMLButtonAttributes, 'type' | 'disabled'> & {
    icon?: ComponentType
    text: string
    variant?: ButtonVariant
    appearance?: ButtonAppearance
    state?: ButtonState
    class?: string
    iconClass?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    variant = 'neutral',
    appearance = 'filled',
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
  class={mergeClasses('cthulhuUiActionButton cthulhuUiButton', className)}
  data-variant={variant}
  data-appearance={appearance}
  data-testid={testId}
  {onclick}
  disabled={isDisabled}
  {...restProps}
>
  <!-- Text action button for row-level commands; icons are optional. -->
  {#if Icon}
    <Icon class={mergeClasses('cthulhuUiButtonIcon', iconClass)} size={16} aria-hidden="true" />
  {/if}
  <span>{text}</span>
</button>

<style>
  .cthulhuUiButton {
    cursor: pointer;
  }

  .cthulhuUiButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiButtonIcon {
    flex: 0 0 auto;
    stroke-width: 2;
  }
</style>
