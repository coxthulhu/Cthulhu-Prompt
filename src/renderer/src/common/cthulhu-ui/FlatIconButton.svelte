<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'

  export type FlatIconButtonSize = 'default' | 'compact' | 'tiny' | 'sidebar-rail'
  export type FlatIconButtonBaseVariant = 'normal' | 'dim' | 'muted'
  export type FlatIconButtonHoverVariant = 'neutral' | 'accent' | 'danger' | 'glyph'
  type FlatIconButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    label: string
    size?: FlatIconButtonSize
    baseVariant?: FlatIconButtonBaseVariant
    hoverVariant?: FlatIconButtonHoverVariant
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
  class={mergeClasses('cthulhuUiFlatIconButton', className)}
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
  <!-- Flat icon button for compact icon-only actions. -->
  <Icon class={iconClass} size={iconSize} data-testid={iconTestId} aria-hidden="true" />
</button>

<style>
  .cthulhuUiFlatIconButton {
    align-items: center;
    background: var(--ui-flat-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-flat-hoverable-icon-glyph);
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

  .cthulhuUiFlatIconButton[data-size='tiny'] {
    border-radius: 0;
    height: 18px;
    width: 18px;
  }

  .cthulhuUiFlatIconButton[data-size='sidebar-rail'] {
    border-bottom: 1px solid var(--ui-flat-neutral-normal-border);
    border-radius: 0;
    height: 100%;
    min-height: 0;
    width: 100%;
  }

  .cthulhuUiFlatIconButton[data-size='sidebar-rail']:last-child {
    border-bottom: 0;
  }

  .cthulhuUiFlatIconButton[data-grab-cursor='true'] {
    cursor: grab;
  }

  .cthulhuUiFlatIconButton[data-grab-cursor='true']:active {
    cursor: grabbing;
  }

  .cthulhuUiFlatIconButton[data-base-variant='dim'] {
    background: transparent;
    color: var(--ui-flat-secondary-icon-glyph);
  }

  .cthulhuUiFlatIconButton[data-base-variant='muted'] {
    color: var(--ui-flat-muted-icon-glyph);
  }

  .cthulhuUiFlatIconButton:hover,
  .cthulhuUiFlatIconButton:focus-visible {
    background: var(--ui-flat-neutral-action-hover-fill);
  }

  .cthulhuUiFlatIconButton[data-hover-variant='accent']:hover,
  .cthulhuUiFlatIconButton[data-hover-variant='accent']:focus-visible {
    background: var(--ui-flat-accent-action-hover-fill);
  }

  .cthulhuUiFlatIconButton[data-hover-variant='danger']:hover,
  .cthulhuUiFlatIconButton[data-hover-variant='danger']:focus-visible {
    background: var(--ui-flat-danger-action-hover-fill);
  }

  .cthulhuUiFlatIconButton[data-hover-variant='glyph']:hover,
  .cthulhuUiFlatIconButton[data-hover-variant='glyph']:focus-visible {
    background: var(--ui-flat-ghost-surface);
    color: var(--ui-flat-hoverable-icon-glyph);
  }

  .cthulhuUiFlatIconButton[data-active='true'] {
    background: var(--ui-flat-neutral-action-fill);
    color: var(--ui-flat-hoverable-icon-glyph);
  }

  .cthulhuUiFlatIconButton:focus-visible {
    outline: 2px solid var(--ui-flat-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuUiFlatIconButton[data-base-variant='dim']:not([data-hover-variant='glyph']):hover,
  .cthulhuUiFlatIconButton[data-base-variant='dim']:not([data-hover-variant='glyph']):focus-visible {
    color: var(--ui-flat-hoverable-icon-glyph);
  }

  .cthulhuUiFlatIconButton[data-base-variant='dim']:focus-visible {
    outline: none;
  }

  .cthulhuUiFlatIconButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

</style>
