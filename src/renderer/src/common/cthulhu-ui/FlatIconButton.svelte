<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'

  type FlatIconButtonState = 'enabled' | 'disabled'
  type FlatIconButtonSize = 'default' | 'compact' | 'rail' | 'rail-fill'
  type FlatIconButtonVariant = 'ghost' | 'neutral'
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
    variant = 'ghost',
    class: className,
    iconClass,
    iconTestId,
    testId,
    title,
    disabled,
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
  data-disabled={isDisabled ? 'true' : 'false'}
  data-state={isDisabled ? 'disabled' : 'enabled'}
  data-size={size}
  data-variant={variant}
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

  .cthulhuUiFlatIconButton[data-size='rail'] {
    height: 28px;
    width: 28px;
  }

  .cthulhuUiFlatIconButton[data-size='rail-fill'] {
    height: 100%;
    min-height: 0;
    width: 28px;
  }

  .cthulhuUiFlatIconButton[data-grab-cursor='true'] {
    cursor: grab;
  }

  .cthulhuUiFlatIconButton[data-grab-cursor='true']:active {
    cursor: grabbing;
  }

  .cthulhuUiFlatIconButton[data-variant='neutral'] {
    background: var(--ui-flat-neutral-action-fill);
  }

  .cthulhuUiFlatIconButton:hover,
  .cthulhuUiFlatIconButton:focus-visible {
    background: var(--ui-flat-neutral-action-hover-fill);
    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatIconButton:focus-visible {
    outline: 2px solid var(--ui-flat-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuUiFlatIconButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
