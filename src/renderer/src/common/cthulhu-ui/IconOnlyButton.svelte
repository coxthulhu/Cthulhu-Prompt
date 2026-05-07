<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'

  type IconOnlyButtonSize = 'default' | 'compact' | 'rail' | 'rail-fill'
  type IconOnlyButtonVariant = 'outline' | 'transparent' | 'muted-border' | 'accent' | 'danger'
  type IconOnlyButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    label: string
    variant?: IconOnlyButtonVariant
    size?: IconOnlyButtonSize
    disabled?: boolean
    class?: string
    iconClass?: string
    testId?: string
    title?: string
    buttonAction?: IconOnlyButtonAction | null
    buttonActionParameter?: unknown
    grabCursor?: boolean
    onclick?: (event: MouseEvent) => void
  }

  const noopButtonAction: IconOnlyButtonAction = () => undefined

  let {
    icon: Icon,
    label,
    variant = 'outline',
    size = 'default',
    disabled = false,
    class: className,
    iconClass,
    testId,
    title,
    buttonAction = null,
    buttonActionParameter,
    grabCursor = false,
    onclick,
  }: Props = $props()

  const variantClass = $derived(
    variant === 'muted-border'
      ? 'cthulhuUiIconOnlyButton--mutedBorder'
      : `cthulhuUiIconOnlyButton--${variant}`
  )

  const sizeClass = $derived(
    size === 'rail'
      ? 'cthulhuUiIconOnlyButton--rail'
      : size === 'compact'
        ? 'cthulhuUiIconOnlyButton--compact'
        : size === 'rail-fill'
        ? 'cthulhuUiIconOnlyButton--railFill'
        : null
  )
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  class={mergeClasses('cthulhuUiIconOnlyButton', variantClass, sizeClass, className)}
  type="button"
  aria-label={label}
  data-testid={testId}
  data-grab-cursor={grabCursor ? 'true' : undefined}
  {title}
  {disabled}
  {onclick}
>
  <Icon class={mergeClasses('h-4 w-4', iconClass)} />
</button>

<style>
  .cthulhuUiIconOnlyButton {
    align-items: center;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-icon-button);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    height: 2.25rem;
    justify-content: center;
    transition:
      background-color 120ms ease,
      box-shadow 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
    width: 2.25rem;
  }

  .cthulhuUiIconOnlyButton--rail {
    height: 1.75rem;
    width: 1.75rem;
  }

  .cthulhuUiIconOnlyButton--compact {
    height: 1.75rem;
    width: 1.75rem;
  }

  .cthulhuUiIconOnlyButton--railFill {
    height: 100%;
    min-height: 0;
    width: 1.75rem;
  }

  .cthulhuUiIconOnlyButton[data-grab-cursor='true'] {
    cursor: grab;
  }

  .cthulhuUiIconOnlyButton[data-grab-cursor='true']:active {
    cursor: grabbing;
  }

  .cthulhuUiIconOnlyButton--outline {
    border-color: var(--ui-neutral-normal-border);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
  }

  .cthulhuUiIconOnlyButton--mutedBorder {
    background-color: var(--ui-neutral-normal-surface);
    border-color: var(--ui-neutral-muted-border);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-secondary-text);
  }

  .cthulhuUiIconOnlyButton--transparent {
    /* Keep the transparent border in the box model so appearances do not shift layout. */
    border-color: transparent;
    background-color: transparent;
    box-shadow: none;
  }

  .cthulhuUiIconOnlyButton--accent {
    border-color: var(--ui-accent-normal-border);
    background-color: var(--ui-accent-normal-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiIconOnlyButton--danger {
    border-color: var(--ui-danger-normal-border);
    background-color: var(--ui-danger-normal-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiIconOnlyButton:hover {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconOnlyButton--outline:hover,
  .cthulhuUiIconOnlyButton--mutedBorder:hover {
    border-color: var(--ui-neutral-hover-border);
  }

  .cthulhuUiIconOnlyButton--transparent:hover {
    border-color: transparent;
  }

  .cthulhuUiIconOnlyButton--accent:hover {
    border-color: var(--ui-accent-hover-border);
    background-color: var(--ui-accent-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconOnlyButton--danger:hover {
    border-color: var(--ui-danger-hover-border);
    background-color: var(--ui-danger-hover-surface);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiIconOnlyButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
