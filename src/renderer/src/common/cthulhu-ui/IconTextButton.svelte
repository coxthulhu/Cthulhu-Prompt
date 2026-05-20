<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type ButtonState = 'active' | 'enabled' | 'disabled'
  type ButtonVariant = 'neutral' | 'accent' | 'danger' | 'nav'

  type Props = {
    icon: ComponentType
    endIcon?: ComponentType
    text: string
    state?: ButtonState
    variant?: ButtonVariant
    class?: string
    iconClass?: string
    endIconClass?: string
    href?: string
    target?: string
    rel?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    endIcon: EndIcon,
    text,
    state = 'enabled',
    variant = 'neutral',
    class: className,
    iconClass,
    endIconClass,
    href,
    target,
    rel,
    testId,
    onclick
  }: Props = $props()

  const isDisabled = $derived(state === 'disabled')
  const variantClass = $derived(
    variant === 'nav' && state === 'active'
      ? 'cthulhuUiIconTextButton--navActive'
      : variant === 'nav' && state === 'enabled'
        ? 'cthulhuUiIconTextButton--navEnabled'
        : variant === 'accent'
          ? 'cthulhuUiIconTextButton--accent'
          : variant === 'danger'
            ? 'cthulhuUiIconTextButton--danger'
            : 'cthulhuUiIconTextButton--neutral'
  )
</script>

{#if href}
  <a
    class={mergeClasses(
      'cthulhuUiIconTextButton inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 text-sm font-medium leading-5 no-underline transition',
      variantClass,
      className
    )}
    data-active={state === 'active'}
    data-disabled={isDisabled}
    data-testid={testId}
    href={isDisabled ? undefined : href}
    {target}
    {rel}
    {onclick}
    aria-disabled={isDisabled}
  >
    <Icon class={mergeClasses('h-4 w-4', iconClass)} />
    <span>{text}</span>
    {#if EndIcon}
      <EndIcon class={mergeClasses('h-4 w-4', endIconClass)} />
    {/if}
  </a>
{:else}
  <button
    type="button"
    class={mergeClasses(
      'cthulhuUiIconTextButton inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 text-sm font-medium leading-5 transition disabled:pointer-events-none disabled:opacity-50',
      variantClass,
      className
    )}
    data-active={state === 'active'}
    data-testid={testId}
    {onclick}
    disabled={isDisabled}
  >
    <Icon class={mergeClasses('h-4 w-4', iconClass)} />
    <span>{text}</span>
    {#if EndIcon}
      <EndIcon class={mergeClasses('h-4 w-4', endIconClass)} />
    {/if}
  </button>
{/if}

<style>
  /* Nav buttons show selected/unselected states, such as sidebar navigation. */
  .cthulhuUiIconTextButton--navActive {
    border-color: var(--ui-neutral-emphasis-border);
    background-color: var(--ui-neutral-emphasis-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconTextButton--navEnabled {
    border-color: var(--ui-neutral-muted-border);
    background-color: var(--ui-neutral-muted-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-hoverable-text);
  }

  .cthulhuUiIconTextButton--navEnabled:hover {
    border-color: var(--ui-neutral-hover-border);
    background-color: var(--ui-neutral-normal-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconTextButton[data-disabled='true'] {
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiIconTextButton--accent {
    border-color: var(--ui-accent-normal-border);
    background-color: var(--ui-accent-normal-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiIconTextButton--accent:hover {
    border-color: var(--ui-accent-hover-border);
    background-color: var(--ui-accent-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiIconTextButton--danger {
    border-color: var(--ui-danger-normal-border);
    background-color: var(--ui-danger-normal-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiIconTextButton--danger:hover {
    border-color: var(--ui-danger-hover-border);
    background-color: var(--ui-danger-hover-surface);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiIconTextButton--neutral {
    border-color: var(--ui-neutral-normal-border);
    background-color: var(--ui-neutral-normal-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-hoverable-text);
  }

  .cthulhuUiIconTextButton--neutral:hover {
    border-color: var(--ui-neutral-hover-border);
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }
</style>
