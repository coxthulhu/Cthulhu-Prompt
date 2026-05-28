<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type ButtonState = 'active' | 'enabled' | 'disabled'
  type ButtonVariant = 'neutral' | 'accent' | 'danger' | 'nav'
  type NonNavButtonVariant = Exclude<ButtonVariant, 'nav'>

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

  const baseAnchorClass =
    'cthulhuUiIconTextButton inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 text-sm font-medium leading-5 no-underline transition data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50'
  const baseButtonClass =
    'cthulhuUiIconTextButton inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 text-sm font-medium leading-5 transition disabled:pointer-events-none disabled:opacity-50'
  const variantClasses = {
    neutral:
      'border-[var(--ui-neutral-interactive-normal-border)] bg-[var(--ui-neutral-normal-surface)] text-[var(--ui-hoverable-text)] hover:border-[var(--ui-neutral-interactive-hover-border)] hover:bg-[var(--ui-neutral-hover-surface)] hover:text-[var(--ui-normal-text)]',
    accent:
      'border-[var(--ui-accent-normal-border)] bg-[var(--ui-accent-normal-surface)] text-[var(--ui-accent-normal-text)] hover:border-[var(--ui-accent-hover-border)] hover:bg-[var(--ui-accent-hover-surface)] hover:text-[var(--ui-normal-text)]',
    danger:
      'border-[var(--ui-danger-normal-border)] bg-[var(--ui-danger-normal-surface)] text-[var(--ui-danger-icon-glyph)] hover:border-[var(--ui-danger-hover-border)] hover:bg-[var(--ui-danger-hover-surface)] hover:text-[var(--ui-danger-icon-glyph)]'
  } satisfies Record<NonNavButtonVariant, string>
  const navVariantClasses = {
    active: 'border-0 bg-[var(--ui-neutral-emphasis-surface)] text-[var(--ui-normal-text)]',
    enabled:
      'border-0 bg-[var(--ui-neutral-muted-surface)] text-[var(--ui-hoverable-text)] hover:bg-[var(--ui-neutral-normal-surface)] hover:text-[var(--ui-normal-text)]',
    disabled: 'border-0 bg-[var(--ui-neutral-muted-surface)] text-[var(--ui-hoverable-text)]'
  } satisfies Record<ButtonState, string>

  const isDisabled = $derived(state === 'disabled')
  const variantClass = $derived(
    variant === 'nav'
      ? navVariantClasses[state]
      : variant === 'accent'
        ? variantClasses.accent
        : variant === 'danger'
          ? variantClasses.danger
          : variantClasses.neutral
  )
</script>

{#if href}
  <a
    class={mergeClasses(
      baseAnchorClass,
      variantClass,
      className
    )}
    data-active={state === 'active' ? 'true' : 'false'}
    data-disabled={isDisabled ? 'true' : undefined}
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
      baseButtonClass,
      variantClass,
      className
    )}
    data-active={state === 'active' ? 'true' : 'false'}
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
