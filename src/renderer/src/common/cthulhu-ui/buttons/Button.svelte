<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import '@renderer/common/cthulhu-ui/buttons/button.css'

  export type ButtonVariant = 'neutral' | 'accent' | 'danger'
  export type ButtonAppearance = 'filled' | 'outline'

  type Props = Omit<HTMLButtonAttributes, 'type' | 'disabled'> & {
    icon?: ComponentType
    endIcon?: ComponentType
    text: string
    variant?: ButtonVariant
    appearance?: ButtonAppearance
    /** Prevents activation and applies the shared disabled appearance. */
    disabled?: boolean
    /** Removes the border while preserving the selected appearance. */
    borderless?: boolean
    class?: string
    iconClass?: string
    testId?: string
    /** Attaches dropdown anchoring or another action to the native button. */
    buttonAction?: Action<HTMLButtonElement>
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    endIcon: EndIcon,
    text,
    variant = 'neutral',
    appearance = 'filled',
    disabled = false,
    borderless = false,
    class: className,
    iconClass,
    testId,
    buttonAction,
    onclick,
    ...restProps
  }: Props = $props()

  /** Leaves ordinary buttons unchanged when no DOM action is supplied. */
  const noopButtonAction: Action<HTMLButtonElement> = () => undefined
  /** Keeps the action attached to the button that owns focus and pointer interaction. */
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
</script>

<button
  use:resolvedButtonAction
  type="button"
  class={mergeClasses('cthulhuUiButtonBase cthulhuUiButtonSurface cthulhuUiButtonAction text-sm leading-5 cthulhuUiButton', className)}
  data-variant={variant}
  data-appearance={appearance}
  data-borderless={borderless ? 'true' : 'false'}
  data-testid={testId}
  {onclick}
  {disabled}
  {...restProps}
>
  <!-- Text action button for row-level commands; icons are optional. -->
  {#if Icon}
    <Icon class={mergeClasses('cthulhuUiButtonIcon', iconClass)} size={16} aria-hidden="true" />
  {/if}
  <span class="cthulhuUiButtonLabel">{text}</span>
  {#if EndIcon}
    <EndIcon class={mergeClasses('cthulhuUiButtonIcon', iconClass)} size={16} aria-hidden="true" />
  {/if}
</button>
