<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import '@renderer/common/cthulhu-ui/buttons/button.css'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  /** Toolbar feedback supports neutral actions and accented commands. */
  type ToolbarButtonHoverVariant = 'neutral' | 'accent'

  /** Compact labeled action with optional controlled toggle icons. */
  type Props = Omit<HTMLButtonAttributes, 'type' | 'disabled' | 'aria-pressed'> & {
    icon: ComponentType
    pressedIcon?: ComponentType
    pressedHoverIcon?: ComponentType
    text: string
    pressed?: boolean
    /** Prevents activation and applies the shared disabled appearance. */
    disabled?: boolean
    hoverVariant?: ToolbarButtonHoverVariant
    /** Removes the outline for buttons grouped inside a toolbar. */
    borderless?: boolean
    class?: string
    iconClass?: string
    iconSize?: number
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  /** Caller-controlled label, toggle state, and native button attributes. */
  let {
    icon: Icon,
    pressedIcon,
    pressedHoverIcon,
    text,
    pressed,
    disabled = false,
    hoverVariant = 'neutral',
    // Match the borderless treatment provided by IconButton.
    borderless = false,
    class: className,
    iconClass,
    iconSize = 16,
    testId,
    onclick,
    ...restProps
  }: Props = $props()

  // Reactive icon selection keeps controlled toggle state visually synchronized.
  const DisplayIcon = $derived(pressed === true && pressedIcon ? pressedIcon : Icon)
</script>

<!-- Compact toolbar action retains its 16px text line and optional toggle icons. -->
<button
  type="button"
  class={mergeClasses('cthulhuUiButtonBase cthulhuUiButtonSurface cthulhuUiButtonToggle cthulhuUiToolbarButton text-sm leading-4', className)}
  data-hover-variant={hoverVariant}
  data-borderless={borderless ? 'true' : 'false'}
  data-has-pressed-hover-icon={pressed === true && pressedHoverIcon !== undefined}
  data-testid={testId}
  aria-pressed={pressed}
  {disabled}
  {onclick}
  {...restProps}
>
  <span class="cthulhuUiToolbarButtonIconSlot cthulhuUiToolbarButtonDefaultIconSlot">
    <DisplayIcon
      class={mergeClasses('cthulhuUiButtonIcon cthulhuUiToolbarButtonIcon', iconClass)}
      size={iconSize}
      aria-hidden="true"
    />
  </span>
  {#if pressed === true && pressedHoverIcon}
    {@const PressedHoverIcon = pressedHoverIcon}
    <span class="cthulhuUiToolbarButtonIconSlot cthulhuUiToolbarButtonPressedHoverIconSlot">
      <PressedHoverIcon
        class={mergeClasses('cthulhuUiButtonIcon cthulhuUiToolbarButtonIcon', iconClass)}
        size={iconSize}
        aria-hidden="true"
      />
    </span>
  {/if}
  <span class="cthulhuUiButtonLabel">{text}</span>
</button>

<style>
  .cthulhuUiToolbarButton {
    /* Toolbar feedback retains its existing faster transition. */
    --cthulhu-ui-button-transition: var(--ui-animation-duration-fast) ease-out;
    font-weight: var(--font-weight-semibold);
    gap: 7px;
    height: 30px;
    justify-content: center;
    padding: 0 10px;
    white-space: nowrap;
  }

  :global(.cthulhuUiToolbarButtonIcon) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .cthulhuUiToolbarButton:where(:hover, :focus-visible, [aria-pressed='true'])
    :global(.cthulhuUiToolbarButtonIcon) {
    color: var(--ui-normal-text);
  }

  .cthulhuUiToolbarButtonIconSlot {
    align-items: center;
    display: inline-flex;
    flex: 0 0 auto;
  }

  .cthulhuUiToolbarButtonPressedHoverIconSlot {
    display: none;
  }

  .cthulhuUiToolbarButton[data-has-pressed-hover-icon='true']:hover
    .cthulhuUiToolbarButtonDefaultIconSlot,
  .cthulhuUiToolbarButton[data-has-pressed-hover-icon='true']:focus-visible
    .cthulhuUiToolbarButtonDefaultIconSlot {
    display: none;
  }

  .cthulhuUiToolbarButton[data-has-pressed-hover-icon='true']:hover
    .cthulhuUiToolbarButtonPressedHoverIconSlot,
  .cthulhuUiToolbarButton[data-has-pressed-hover-icon='true']:focus-visible
    .cthulhuUiToolbarButtonPressedHoverIconSlot {
    display: inline-flex;
  }
</style>
