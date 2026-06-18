<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'

  export type IconButtonSize = 'default' | 'compact' | 'tiny' | 'sidebar-rail'
  export type IconButtonBaseVariant = 'normal' | 'dim' | 'muted'
  export type IconButtonHoverVariant = 'neutral' | 'accent' | 'danger' | 'glyph'
  type IconButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    label: string
    size?: IconButtonSize
    baseVariant?: IconButtonBaseVariant
    hoverVariant?: IconButtonHoverVariant
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
    buttonAction?: IconButtonAction | null
    buttonActionParameter?: unknown
    grabCursor?: boolean
    onclick?: (event: MouseEvent) => void
  }

  const noopButtonAction: IconButtonAction = () => undefined

  let {
    icon: Icon,
    label,
    size = 'default',
    baseVariant = 'normal',
    hoverVariant = 'neutral',
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

  const isDisabled = $derived(disabled === true)
  const iconSize = $derived(size === 'default' ? 20 : size === 'tiny' ? 14 : 16)
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  type="button"
  class={mergeClasses('cthulhuUiIconButton', className)}
  aria-label={label}
  aria-haspopup={ariaHaspopup}
  aria-expanded={ariaExpanded}
  aria-current={ariaCurrent}
  data-disabled={isDisabled ? 'true' : 'false'}
  data-size={size}
  data-base-variant={baseVariant}
  data-hover-variant={hoverVariant}
  data-active={active === undefined ? undefined : active ? 'true' : 'false'}
  data-testid={testId}
  data-grab-cursor={grabCursor ? 'true' : undefined}
  {title}
  disabled={isDisabled}
  {onclick}
>
  <!-- Icon button for compact icon-only actions. -->
  <Icon class={iconClass} size={iconSize} data-testid={iconTestId} aria-hidden="true" />
</button>

<style>
  .cthulhuUiIconButton {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-icon-glyph);
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

  .cthulhuUiIconButton[data-size='compact'] {
    height: 28px;
    width: 28px;
  }

  .cthulhuUiIconButton[data-size='tiny'] {
    border-radius: 0;
    height: 18px;
    width: 18px;
  }

  .cthulhuUiIconButton[data-size='sidebar-rail'] {
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    border-radius: 0;
    height: 100%;
    min-height: 0;
    width: 100%;
  }

  .cthulhuUiIconButton[data-size='sidebar-rail']:last-child {
    border-bottom: 0;
  }

  .cthulhuUiIconButton[data-grab-cursor='true'] {
    cursor: grab;
  }

  .cthulhuUiIconButton[data-grab-cursor='true']:active {
    cursor: grabbing;
  }

  .cthulhuUiIconButton[data-base-variant='dim'] {
    background: transparent;
    color: var(--ui-secondary-icon-glyph);
  }

  .cthulhuUiIconButton[data-base-variant='muted'] {
    color: var(--ui-muted-icon-glyph);
  }

  .cthulhuUiIconButton:hover,
  .cthulhuUiIconButton:focus-visible {
    background: var(--ui-neutral-action-hover-fill);
  }

  .cthulhuUiIconButton[data-size='sidebar-rail']:hover,
  .cthulhuUiIconButton[data-size='sidebar-rail']:focus-visible {
    background: var(--ui-neutral-subtle-action-hover-fill);
  }

  .cthulhuUiIconButton[data-hover-variant='accent']:hover,
  .cthulhuUiIconButton[data-hover-variant='accent']:focus-visible {
    background: var(--ui-accent-action-hover-fill);
  }

  .cthulhuUiIconButton[data-hover-variant='danger']:hover,
  .cthulhuUiIconButton[data-hover-variant='danger']:focus-visible {
    background: var(--ui-danger-action-hover-fill);
  }

  .cthulhuUiIconButton[data-hover-variant='glyph']:hover,
  .cthulhuUiIconButton[data-hover-variant='glyph']:focus-visible {
    background: var(--ui-ghost-surface);
    color: var(--ui-hoverable-icon-glyph);
  }

  .cthulhuUiIconButton[data-active='true'] {
    background: var(--ui-neutral-action-fill);
    color: var(--ui-hoverable-icon-glyph);
  }

  .cthulhuUiIconButton:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuUiIconButton[data-base-variant='dim']:not([data-hover-variant='glyph']):hover,
  .cthulhuUiIconButton[data-base-variant='dim']:not([data-hover-variant='glyph']):focus-visible {
    color: var(--ui-hoverable-icon-glyph);
  }

  .cthulhuUiIconButton[data-base-variant='dim']:focus-visible {
    outline: none;
  }

  .cthulhuUiIconButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
