<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { mergeClasses } from './mergeClasses'

  type IconTextButtonState = 'enabled' | 'disabled'
  type IconTextButtonHoverVariant = 'neutral' | 'accent'

  type Props = Omit<HTMLButtonAttributes, 'type' | 'disabled' | 'aria-pressed'> & {
    icon: ComponentType
    pressedIcon?: ComponentType
    text: string
    pressed?: boolean
    state?: IconTextButtonState
    hoverVariant?: IconTextButtonHoverVariant
    class?: string
    iconClass?: string
    iconSize?: number
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    pressedIcon,
    text,
    pressed,
    state = 'enabled',
    hoverVariant = 'neutral',
    class: className,
    iconClass,
    iconSize = 16,
    testId,
    onclick,
    ...restProps
  }: Props = $props()

  // Derived from state so native disabled behavior mirrors the visual state.
  const isDisabled = $derived(state === 'disabled')
  // Reactive icon selection keeps controlled toggle state visually synchronized.
  const DisplayIcon = $derived(pressed === true && pressedIcon ? pressedIcon : Icon)
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiIconTextButton', className)}
  data-state={state}
  data-hover-variant={hoverVariant}
  data-testid={testId}
  aria-pressed={pressed}
  disabled={isDisabled}
  {onclick}
  {...restProps}
>
  <DisplayIcon
    class={mergeClasses('cthulhuUiIconTextButtonIcon', iconClass)}
    size={iconSize}
    aria-hidden="true"
  />
  <span>{text}</span>
</button>

<style>
  .cthulhuUiIconTextButton {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 14px;
    font-weight: 600;
    gap: 7px;
    height: 30px;
    justify-content: center;
    line-height: 16px;
    min-width: 0;
    padding: 0 10px;
    transition:
      background-color 50ms ease-out,
      border-color 50ms ease-out,
      color 50ms ease-out;
    white-space: nowrap;
  }

  .cthulhuUiIconTextButton:hover,
  .cthulhuUiIconTextButton:focus-visible {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
  }

  .cthulhuUiIconTextButton[data-hover-variant='accent']:hover,
  .cthulhuUiIconTextButton[data-hover-variant='accent']:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
  }

  .cthulhuUiIconTextButton[aria-pressed='true'] {
    background: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-muted-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconTextButton[aria-pressed='true']:hover,
  .cthulhuUiIconTextButton[aria-pressed='true']:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
  }

  .cthulhuUiIconTextButton:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuUiIconTextButton[data-state='disabled'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiIconTextButtonIcon {
    color: var(--ui-hoverable-icon-glyph);
    flex: 0 0 auto;
    stroke-width: 2;
  }

  .cthulhuUiIconTextButton span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
