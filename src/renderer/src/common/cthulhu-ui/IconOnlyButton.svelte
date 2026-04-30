<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'
  import type { CthulhuTone } from './types'

  type IconOnlyButtonAppearance = 'solid' | 'outline' | 'muted-border' | 'transparent'
  type IconOnlyButtonSize = 'default' | 'rail'
  type IconOnlyButtonTone = Extract<CthulhuTone, 'neutral' | 'accent' | 'danger'>

  type Props = {
    icon: ComponentType
    label: string
    appearance?: IconOnlyButtonAppearance
    size?: IconOnlyButtonSize
    tone?: IconOnlyButtonTone
    disabled?: boolean
    class?: string
    iconClass?: string
    testId?: string
    title?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    label,
    appearance = 'solid',
    size = 'default',
    tone = 'neutral',
    disabled = false,
    class: className,
    iconClass,
    testId,
    title,
    onclick
  }: Props = $props()

  const appearanceClass = $derived(
    appearance === 'solid'
      ? 'cthulhuUiIconOnlyButton--solid'
      : appearance === 'outline'
        ? 'cthulhuUiIconOnlyButton--outline'
        : appearance === 'muted-border'
          ? 'cthulhuUiIconOnlyButton--mutedBorder'
          : 'cthulhuUiIconOnlyButton--transparent'
  )

  const toneClass = $derived(
    tone === 'accent'
      ? 'cthulhuUiIconOnlyButton--accent'
      : tone === 'danger'
        ? 'cthulhuUiIconOnlyButton--danger'
        : null
  )

  const sizeClass = $derived(size === 'rail' ? 'cthulhuUiIconOnlyButton--rail' : null)
</script>

<button
  class={mergeClasses('cthulhuUiIconOnlyButton', appearanceClass, toneClass, sizeClass, className)}
  type="button"
  aria-label={label}
  data-testid={testId}
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

  .cthulhuUiIconOnlyButton--solid {
    background-color: var(--ui-neutral-normal-surface);
    border-color: var(--ui-neutral-normal-border);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
  }

  .cthulhuUiIconOnlyButton--rail {
    height: 2rem;
    width: 2.25rem;
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
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiIconOnlyButton--danger {
    border-color: var(--ui-danger-normal-border);
    background-color: var(--ui-danger-normal-surface);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiIconOnlyButton:hover {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconOnlyButton--solid:hover,
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
