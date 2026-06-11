<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'

  type IconOnlyButtonSize = 'default' | 'compact' | 'rail' | 'rail-fill' | 'tree-action'
  type IconOnlyButtonVariant = 'outline' | 'transparent' | 'dim-border' | 'accent' | 'danger'
  type IconOnlyButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    label: string
    variant?: IconOnlyButtonVariant
    size?: IconOnlyButtonSize
    disabled?: boolean
    class?: string
    iconClass?: string
    iconTestId?: string
    testId?: string
    title?: string
    active?: boolean
    ariaHaspopup?: 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
    ariaExpanded?: boolean
    ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
    buttonAction?: IconOnlyButtonAction | null
    buttonActionParameter?: unknown
    grabCursor?: boolean
    onclick?: (event: MouseEvent) => void
  }

  const noopButtonAction: IconOnlyButtonAction = () => undefined
  const baseButtonClass =
    'cthulhuUiIconOnlyButton inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[var(--cthulhu-ui-radius-icon-button)] border text-[var(--ui-flat-hoverable-icon-glyph)] transition-[background-color,box-shadow,border-color,color] duration-[120ms] hover:bg-[var(--ui-flat-neutral-action-hover-fill)] hover:text-[var(--ui-flat-normal-text)] disabled:pointer-events-none disabled:cursor-default disabled:opacity-50'
  const variantClasses = {
    outline:
      'border-[var(--ui-flat-neutral-interactive-normal-border)] hover:border-[var(--ui-flat-neutral-interactive-hover-border)]',
    'dim-border':
      'border-[var(--ui-flat-neutral-muted-border)] bg-[var(--ui-flat-neutral-action-fill)] text-[var(--ui-flat-secondary-icon-glyph)] hover:border-[var(--ui-flat-neutral-hover-border)] hover:bg-[var(--ui-flat-neutral-action-hover-fill)]',
    transparent:
      'border-0 bg-[var(--ui-flat-ghost-surface)] shadow-none hover:border-0 hover:bg-[var(--ui-flat-neutral-action-fill)]',
    accent:
      'border-[var(--ui-flat-accent-normal-border)] bg-[var(--ui-flat-accent-action-fill)] text-[var(--ui-flat-accent-normal-text)] hover:border-[var(--ui-flat-accent-hover-border)] hover:bg-[var(--ui-flat-accent-action-hover-fill)] hover:text-[var(--ui-flat-normal-text)]',
    danger:
      'border-[var(--ui-flat-danger-normal-border)] bg-[var(--ui-flat-danger-action-fill)] text-[var(--ui-flat-danger-icon-glyph)] hover:border-[var(--ui-flat-danger-hover-border)] hover:bg-[var(--ui-flat-danger-action-hover-fill)] hover:text-[var(--ui-flat-danger-icon-glyph)]'
  } satisfies Record<IconOnlyButtonVariant, string>
  const sizeClasses = {
    default: null,
    compact: 'h-7 w-7',
    rail: 'h-7 w-7',
    'rail-fill': 'h-full min-h-0 w-7',
    'tree-action': 'h-7 w-7'
  } satisfies Record<IconOnlyButtonSize, string | null>

  let {
    icon: Icon,
    label,
    variant = 'outline',
    size = 'default',
    disabled = false,
    class: className,
    iconClass,
    iconTestId,
    testId,
    title,
    active,
    ariaHaspopup,
    ariaExpanded,
    ariaCurrent,
    buttonAction = null,
    buttonActionParameter,
    grabCursor = false,
    onclick
  }: Props = $props()

  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  class={mergeClasses(
    baseButtonClass,
    variantClasses[variant],
    sizeClasses[size],
    grabCursor ? 'cursor-grab active:cursor-grabbing' : null,
    className
  )}
  type="button"
  aria-label={label}
  aria-haspopup={ariaHaspopup}
  aria-expanded={ariaExpanded}
  aria-current={ariaCurrent}
  data-active={active === undefined ? undefined : active ? 'true' : 'false'}
  data-testid={testId}
  data-grab-cursor={grabCursor ? 'true' : undefined}
  {title}
  {disabled}
  {onclick}
>
  <Icon class={mergeClasses('h-4 w-4', iconClass)} data-testid={iconTestId} aria-hidden="true" />
</button>
