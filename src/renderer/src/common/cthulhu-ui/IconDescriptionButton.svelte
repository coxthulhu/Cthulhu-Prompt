<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  export type IconDescriptionButtonVariant = 'neutral' | 'accent' | 'danger'
  type ButtonState = 'enabled' | 'disabled'

  type Props = {
    icon: ComponentType
    text: string
    description: string
    variant?: IconDescriptionButtonVariant
    state?: ButtonState
    class?: string
    iconClass?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    description,
    variant = 'neutral',
    state = 'enabled',
    class: className,
    iconClass,
    testId,
    onclick
  }: Props = $props()

  const isDisabled = $derived(state === 'disabled')
</script>

<button
  type="button"
  class={mergeClasses(
    'cthulhuUiIconDescriptionButton flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-[var(--cthulhu-ui-radius-action)] border px-4 py-[18px] text-left transition disabled:pointer-events-none disabled:opacity-50',
    className
  )}
  data-state={state}
  data-testid={testId}
  data-variant={variant}
  {onclick}
  disabled={isDisabled}
>
  <!-- Icon-leading action button with a persistent detail line. -->
  <span class="cthulhuUiIconDescriptionButtonIcon">
    <Icon class={mergeClasses('h-5 w-5', iconClass)} />
  </span>

  <span class="flex min-w-0 flex-col gap-1">
    <span class="cthulhuUiIconDescriptionButtonText">{text}</span>
    <span class="cthulhuUiIconDescriptionButtonDescription">{description}</span>
  </span>
</button>

<style>
  .cthulhuUiIconDescriptionButton {
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
  }

  .cthulhuUiIconDescriptionButtonIcon {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-control);
    display: flex;
    flex: 0 0 auto;
    height: 2.875rem;
    justify-content: center;
    width: 2.875rem;
  }

  .cthulhuUiIconDescriptionButtonText {
    color: var(--ui-normal-text);
    font-size: 0.975rem;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .cthulhuUiIconDescriptionButtonDescription {
    color: var(--ui-secondary-text);
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .cthulhuUiIconDescriptionButton[data-variant='neutral'] {
    background-color: var(--ui-neutral-normal-surface);
    border-color: var(--ui-neutral-normal-border);
    color: var(--ui-secondary-text);
  }

  .cthulhuUiIconDescriptionButton[data-variant='neutral']:hover {
    border-color: var(--ui-neutral-hover-border);
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconDescriptionButton[data-variant='neutral'] .cthulhuUiIconDescriptionButtonIcon {
    background-color: var(--ui-neutral-emphasis-surface);
    box-shadow: var(--cthulhu-ui-shadow-icon-neutral);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconDescriptionButton[data-variant='accent'] {
    background-color: var(--ui-accent-normal-surface);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiIconDescriptionButton[data-variant='accent']:hover {
    border-color: var(--ui-accent-hover-border);
    background-color: var(--ui-accent-hover-surface);
  }

  .cthulhuUiIconDescriptionButton[data-variant='accent'] .cthulhuUiIconDescriptionButtonIcon {
    background-color: var(--ui-accent-icon-surface);
    box-shadow: var(--cthulhu-ui-shadow-icon-accent);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconDescriptionButton[data-variant='danger'] {
    background-color: var(--ui-danger-normal-surface);
    border-color: var(--ui-danger-normal-border);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
  }

  .cthulhuUiIconDescriptionButton[data-variant='danger']:hover {
    background-color: var(--ui-danger-hover-surface);
    border-color: var(--ui-danger-hover-border);
  }

  .cthulhuUiIconDescriptionButton[data-variant='danger'] .cthulhuUiIconDescriptionButtonIcon {
    background-color: var(--ui-danger-icon-surface);
    box-shadow: var(--cthulhu-ui-shadow-icon-danger);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconDescriptionButton[data-variant='danger'] .cthulhuUiIconDescriptionButtonText {
    color: var(--ui-normal-text);
  }
</style>
