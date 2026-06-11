<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'

  type ButtonState = 'active' | 'enabled' | 'disabled'
  type ButtonVariant = 'neutral' | 'accent' | 'danger' | 'nav'
  type NonNavButtonVariant = Exclude<ButtonVariant, 'nav'>
  type IconTextButtonAction = Action<HTMLButtonElement, unknown>

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
    ariaHaspopup?: 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
    ariaExpanded?: boolean
    buttonAction?: IconTextButtonAction | null
    buttonActionParameter?: unknown
    onclick?: (event: MouseEvent) => void
  }

  const noopButtonAction: IconTextButtonAction = () => undefined

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
    ariaHaspopup,
    ariaExpanded,
    buttonAction = null,
    buttonActionParameter,
    onclick
  }: Props = $props()

  const baseAnchorClass =
    'cthulhuUiIconTextButton inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 text-sm font-medium leading-5 no-underline transition data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50'
  const baseButtonClass =
    'cthulhuUiIconTextButton inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 text-sm font-medium leading-5 transition disabled:pointer-events-none disabled:opacity-50'
  const variantClasses = {
    neutral:
      'border-[var(--ui-neutral-interactive-normal-border)] bg-[var(--ui-neutral-normal-surface)] text-[var(--ui-normal-text)] hover:border-[var(--ui-neutral-interactive-hover-border)] hover:bg-[var(--ui-neutral-hover-surface)]',
    accent:
      'border-[var(--ui-accent-normal-border)] bg-[var(--ui-accent-normal-surface)] text-[var(--ui-normal-text)] hover:border-[var(--ui-accent-hover-border)] hover:bg-[var(--ui-accent-hover-surface)]',
    danger:
      'border-[var(--ui-danger-normal-border)] bg-[var(--ui-danger-normal-surface)] text-[var(--ui-normal-text)] hover:border-[var(--ui-danger-hover-border)] hover:bg-[var(--ui-danger-hover-surface)]'
  } satisfies Record<NonNavButtonVariant, string>
  const navVariantClasses = {
    active: 'border-0 bg-[var(--ui-neutral-emphasis-surface)] text-[var(--ui-normal-text)]',
    enabled:
      'border-0 bg-[var(--ui-neutral-muted-surface)] text-[var(--ui-normal-text)] hover:bg-[var(--ui-neutral-normal-surface)]',
    disabled: 'border-0 bg-[var(--ui-neutral-muted-surface)] text-[var(--ui-normal-text)]'
  } satisfies Record<ButtonState, string>

  const isDisabled = $derived(state === 'disabled')
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
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
    class={mergeClasses(baseAnchorClass, variantClass, className)}
    data-variant={variant}
    data-state={state}
    data-active={state === 'active' ? 'true' : 'false'}
    data-disabled={isDisabled ? 'true' : undefined}
    data-testid={testId}
    href={isDisabled ? undefined : href}
    {target}
    {rel}
    {onclick}
    aria-haspopup={ariaHaspopup}
    aria-expanded={ariaExpanded}
    aria-disabled={isDisabled}
  >
    <Icon class={mergeClasses('cthulhuUiIconTextButtonIcon h-4 w-4', iconClass)} />
    <span>{text}</span>
    {#if EndIcon}
      <EndIcon class={mergeClasses('cthulhuUiIconTextButtonIcon h-4 w-4', endIconClass)} />
    {/if}
  </a>
{:else}
  <button
    use:resolvedButtonAction={buttonActionParameter}
    type="button"
    class={mergeClasses(baseButtonClass, variantClass, className)}
    data-variant={variant}
    data-state={state}
    data-active={state === 'active' ? 'true' : 'false'}
    data-testid={testId}
    aria-haspopup={ariaHaspopup}
    aria-expanded={ariaExpanded}
    {onclick}
    disabled={isDisabled}
  >
    <Icon class={mergeClasses('cthulhuUiIconTextButtonIcon h-4 w-4', iconClass)} />
    <span>{text}</span>
    {#if EndIcon}
      <EndIcon class={mergeClasses('cthulhuUiIconTextButtonIcon h-4 w-4', endIconClass)} />
    {/if}
  </button>
{/if}

<style>
  .cthulhuUiIconTextButton {
    --cthulhu-ui-icon-text-button-icon-color: currentColor;
  }

  .cthulhuUiIconTextButton[data-variant='neutral'],
  .cthulhuUiIconTextButton[data-variant='nav'][data-state='enabled'],
  .cthulhuUiIconTextButton[data-variant='nav'][data-state='disabled'] {
    --cthulhu-ui-icon-text-button-icon-color: var(--ui-hoverable-icon-glyph);
  }

  .cthulhuUiIconTextButton[data-variant='neutral']:hover,
  .cthulhuUiIconTextButton[data-variant='nav'][data-state='enabled']:hover,
  .cthulhuUiIconTextButton[data-variant='nav'][data-state='active'] {
    --cthulhu-ui-icon-text-button-icon-color: var(--ui-normal-text);
  }

  .cthulhuUiIconTextButtonIcon {
    color: var(--cthulhu-ui-icon-text-button-icon-color);
  }
</style>
