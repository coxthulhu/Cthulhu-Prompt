<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'

  export type FlatIconButtonState = 'enabled' | 'disabled'
  export type FlatIconButtonSize = 'default' | 'compact' | 'rail' | 'rail-fill' | 'sidebar-rail'
  export type FlatIconButtonVariant = 'normal' | 'dim'
  type FlatIconButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    label: string
    state?: FlatIconButtonState
    size?: FlatIconButtonSize
    variant?: FlatIconButtonVariant
    class?: string
    iconClass?: string
    iconTestId?: string
    testId?: string
    title?: string
    disabled?: boolean
    active?: boolean
    ariaHaspopup?: 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
    ariaExpanded?: boolean
    ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
    buttonAction?: FlatIconButtonAction | null
    buttonActionParameter?: unknown
    grabCursor?: boolean
    onclick?: (event: MouseEvent) => void
  }

  const noopButtonAction: FlatIconButtonAction = () => undefined

  let {
    icon: Icon,
    label,
    state = 'enabled',
    size = 'default',
    variant = 'normal',
    class: className,
    iconClass,
    iconTestId,
    testId,
    title,
    disabled,
    active,
    ariaHaspopup,
    ariaExpanded,
    ariaCurrent,
    buttonAction = null,
    buttonActionParameter,
    grabCursor = false,
    onclick
  }: Props = $props()

  const isDisabled = $derived(disabled === true || state === 'disabled')
  const iconSize = $derived(size === 'default' ? 20 : 16)
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  type="button"
  class={mergeClasses('cthulhuUiFlatIconButton', className)}
  aria-label={label}
  aria-haspopup={ariaHaspopup}
  aria-expanded={ariaExpanded}
  aria-current={ariaCurrent}
  data-disabled={isDisabled ? 'true' : 'false'}
  data-state={isDisabled ? 'disabled' : 'enabled'}
  data-size={size}
  data-variant={variant}
  data-active={active === undefined ? undefined : active ? 'true' : 'false'}
  data-testid={testId}
  data-grab-cursor={grabCursor ? 'true' : undefined}
  {title}
  disabled={isDisabled}
  {onclick}
>
  <!-- Flat icon button for compact icon-only actions. -->
  <Icon
    class={mergeClasses('cthulhuUiFlatIconButtonIcon', iconClass)}
    size={iconSize}
    data-testid={iconTestId}
    aria-hidden="true"
  />
</button>

<style>
  .cthulhuUiFlatIconButton {
    align-items: center;
    background: var(--ui-flat-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-flat-normal-text);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    height: 36px;
    justify-content: center;
    min-width: 0;
    padding: 0;
    transition:
      background-color 120ms ease,
      color 120ms ease;
    width: 36px;
  }

  .cthulhuUiFlatIconButton[data-size='compact'] {
    height: 28px;
    width: 28px;
  }

  .cthulhuUiFlatIconButton[data-size='rail'] {
    height: 28px;
    width: 28px;
  }

  .cthulhuUiFlatIconButton[data-size='rail-fill'] {
    height: 100%;
    min-height: 0;
    width: 28px;
  }

  .cthulhuUiFlatIconButton[data-size='sidebar-rail'] {
    height: 100%;
    min-height: 0;
    width: 100%;
  }

  .cthulhuUiFlatIconButton[data-grab-cursor='true'] {
    cursor: grab;
  }

  .cthulhuUiFlatIconButton[data-grab-cursor='true']:active {
    cursor: grabbing;
  }

  .cthulhuUiFlatIconButton[data-variant='dim'] {
    background: transparent;
    border-bottom: 1px solid var(--ui-flat-neutral-normal-border);
    border-radius: 0;
    color: var(--ui-flat-hoverable-icon-glyph);
  }

  .cthulhuUiFlatIconButton[data-variant='dim']:last-child {
    border-bottom: 0;
  }

  .cthulhuUiFlatIconButton:hover,
  .cthulhuUiFlatIconButton:focus-visible {
    background: var(--ui-flat-neutral-action-hover-fill);
  }

  .cthulhuUiFlatIconButton:focus-visible {
    outline: 2px solid var(--ui-flat-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuUiFlatIconButton[data-variant='dim']:hover,
  .cthulhuUiFlatIconButton[data-variant='dim']:focus-visible {
    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatIconButton[data-variant='dim']:focus-visible {
    outline: none;
  }

  .cthulhuUiFlatIconButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
