<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  export type IconDescriptionButtonVariant = 'gray' | 'purple' | 'red'
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
    variant = 'gray',
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
    'cthulhuUiIconDescriptionButton flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-[24px] border px-4 py-[18px] text-left transition disabled:pointer-events-none disabled:opacity-50',
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
    box-shadow: inset 0 1px 0 var(--ui-surface-muted);
  }

  .cthulhuUiIconDescriptionButtonIcon {
    align-items: center;
    border-radius: 1rem;
    display: flex;
    flex: 0 0 auto;
    height: 2.875rem;
    justify-content: center;
    width: 2.875rem;
  }

  .cthulhuUiIconDescriptionButtonText {
    color: var(--ui-text-bright);
    font-size: 0.975rem;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.2;
  }

  .cthulhuUiIconDescriptionButtonDescription {
    color: var(--ui-text);
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .cthulhuUiIconDescriptionButton[data-variant='gray'] {
    background-color: var(--ui-surface-default);
    border-color: var(--ui-border-default);
    color: var(--ui-text);
  }

  .cthulhuUiIconDescriptionButton[data-variant='gray']:hover {
    background-color: var(--ui-surface-hover);
    color: var(--ui-text-bright);
  }

  .cthulhuUiIconDescriptionButton[data-variant='gray'] .cthulhuUiIconDescriptionButtonIcon {
    background-color: var(--ui-surface-emphasis);
    box-shadow: 0 0 0 1px var(--ui-border-emphasis);
    color: var(--ui-text);
  }

  .cthulhuUiIconDescriptionButton[data-variant='purple'] {
    background-color: var(--ui-accent-surface);
    border-color: var(--ui-accent-border);
    color: var(--ui-accent-text);
  }

  .cthulhuUiIconDescriptionButton[data-variant='purple']:hover {
    background-color: var(--ui-accent-fill);
  }

  .cthulhuUiIconDescriptionButton[data-variant='purple'] .cthulhuUiIconDescriptionButtonIcon {
    background-color: var(--ui-accent-icon-surface);
    box-shadow: 0 0 0 1px var(--ui-accent-icon-ring);
    color: var(--ui-accent-icon);
  }

  .cthulhuUiIconDescriptionButton[data-variant='red'] {
    background-color: var(--ui-danger-surface);
    border-color: var(--ui-danger-border);
    color: var(--ui-danger-text);
    box-shadow: inset 0 1px 0 var(--ui-surface-muted);
  }

  .cthulhuUiIconDescriptionButton[data-variant='red']:hover {
    border-color: var(--ui-danger-ring);
  }

  .cthulhuUiIconDescriptionButton[data-variant='red'] .cthulhuUiIconDescriptionButtonIcon {
    background-color: var(--ui-danger-icon-surface);
    box-shadow: 0 0 0 1px var(--ui-danger-icon-ring);
    color: var(--ui-danger-icon);
  }

  .cthulhuUiIconDescriptionButton[data-variant='red'] .cthulhuUiIconDescriptionButtonText {
    color: var(--ui-text-bright);
  }

</style>
