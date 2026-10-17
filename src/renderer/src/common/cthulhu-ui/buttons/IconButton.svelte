<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import '@renderer/common/cthulhu-ui/buttons/button.css'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  export type IconButtonSize =
    | 'default'
    | 'compact'
    | 'compact-large-icon'
    | 'tiny'
    | 'sidebar-rail'
  export type IconButtonBaseVariant = 'normal' | 'dim' | 'muted'
  export type IconButtonHoverVariant = 'neutral' | 'accent' | 'success' | 'danger' | 'glyph'
  type IconButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    label: string
    size?: IconButtonSize
    iconSize?: number
    baseVariant?: IconButtonBaseVariant
    hoverVariant?: IconButtonHoverVariant
    class?: string
    iconClass?: string
    iconTestId?: string
    testId?: string
    title?: string
    disabled?: boolean
    active?: boolean
    borderless?: boolean
    ariaHaspopup?: 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
    ariaExpanded?: boolean
    ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
    ariaPressed?: boolean | 'mixed'
    buttonAction?: IconButtonAction | null
    buttonActionParameter?: unknown
    grabCursor?: boolean
    tabindex?: number
    onclick?: (event: MouseEvent) => void
    onmousedown?: (event: MouseEvent) => void
  }

  const noopButtonAction: IconButtonAction = () => undefined

  let {
    icon: Icon,
    label,
    size = 'default',
    iconSize: requestedIconSize,
    baseVariant = 'normal',
    hoverVariant = 'neutral',
    class: className,
    iconClass,
    iconTestId,
    testId,
    title,
    disabled = false,
    active,
    borderless = false,
    ariaHaspopup,
    ariaExpanded,
    ariaCurrent,
    ariaPressed,
    buttonAction = null,
    buttonActionParameter,
    grabCursor = false,
    tabindex,
    onclick,
    onmousedown
  }: Props = $props()

  const iconSize = $derived(
    requestedIconSize ??
      (size === 'default' || size === 'compact-large-icon' ? 20 : size === 'tiny' ? 14 : 16)
  )
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  type="button"
  class={mergeClasses('cthulhuUiButtonBase cthulhuUiButtonSurface cthulhuUiIconButton', className)}
  aria-label={label}
  aria-haspopup={ariaHaspopup}
  aria-expanded={ariaExpanded}
  aria-current={ariaCurrent}
  aria-pressed={ariaPressed}
  data-size={size}
  data-base-variant={baseVariant}
  data-hover-variant={hoverVariant}
  data-active={active === undefined ? undefined : active ? 'true' : 'false'}
  data-borderless={borderless ? 'true' : 'false'}
  data-testid={testId}
  data-grab-cursor={grabCursor ? 'true' : undefined}
  {title}
  {tabindex}
  {disabled}
  {onclick}
  {onmousedown}
>
  <!-- Icon button for compact icon-only actions. -->
  <Icon class={mergeClasses('cthulhuUiButtonIcon', iconClass)} size={iconSize} data-testid={iconTestId} aria-hidden="true" />
</button>

<style>
  .cthulhuUiIconButton {
    /* Icon-only controls use the glyph foreground instead of the text foreground. */
    --cthulhu-ui-button-text: var(--ui-hoverable-icon-glyph);
    height: 36px;
    justify-content: center;
    padding: 0;
    width: 36px;
  }

  .cthulhuUiIconButton[data-size='compact'] {
    height: 28px;
    width: 28px;
  }

  .cthulhuUiIconButton[data-size='compact-large-icon'] {
    height: 28px;
    width: 36px;
  }

  .cthulhuUiIconButton[data-size='tiny'] {
    border-radius: 0;
    height: 18px;
    width: 18px;
  }

  .cthulhuUiIconButton[data-size='sidebar-rail'] {
    /* Rail controls keep their existing separator-only treatment. */
    border: 0;
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    border-radius: 0;
    box-sizing: content-box;
    height: 100%;
    min-height: 0;
    width: 100%;
  }

  .cthulhuUiIconButton[data-size='sidebar-rail']:last-child {
    border-bottom: 0;
  }

  .cthulhuUiIconButton[data-grab-cursor='true']:not(:disabled) {
    cursor: grab;
  }

  .cthulhuUiIconButton[data-grab-cursor='true']:not(:disabled):active {
    cursor: grabbing;
  }

  .cthulhuUiIconButton[data-base-variant='dim'] {
    --cthulhu-ui-button-text: var(--ui-secondary-icon-glyph);
  }

  .cthulhuUiIconButton[data-base-variant='muted'] {
    --cthulhu-ui-button-text: var(--ui-muted-icon-glyph);
  }

  .cthulhuUiIconButton[data-size='sidebar-rail'][data-hover-variant='neutral'] {
    /* Rail hover preserves its separator and uses the subtler fill. */
    --cthulhu-ui-button-hover-fill: var(--ui-neutral-subtle-action-hover-fill);
    --cthulhu-ui-button-hover-border: var(--ui-neutral-normal-border);
  }

  .cthulhuUiIconButton[data-hover-variant='glyph'] {
    /* Glyph-only actions intentionally remain visually borderless. */
    border: 0;
  }

  .cthulhuUiIconButton[data-hover-variant='glyph']:hover,
  .cthulhuUiIconButton[data-hover-variant='glyph']:focus-visible {
    background: var(--ui-ghost-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconButton[data-active='true'] {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-normal-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconButton[data-base-variant='dim']:focus-visible {
    outline: none;
  }
</style>
