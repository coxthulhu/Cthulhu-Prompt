<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'

  type IconOnlyButtonSize = 'default' | 'compact' | 'rail' | 'rail-fill' | 'tree-action'
  type IconOnlyButtonVariant =
    | 'outline'
    | 'transparent'
    | 'dim-border'
    | 'accent'
    | 'danger'
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
    ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
    buttonAction?: IconOnlyButtonAction | null
    buttonActionParameter?: unknown
    grabCursor?: boolean
    onclick?: (event: MouseEvent) => void
  }

  const noopButtonAction: IconOnlyButtonAction = () => undefined
  const baseButtonClass =
    'cthulhuUiIconOnlyButton inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[var(--cthulhu-ui-radius-icon-button)] border text-[var(--ui-hoverable-text)] transition-[background-color,box-shadow,border-color,color] duration-[120ms] hover:bg-[var(--ui-neutral-hover-surface)] hover:text-[var(--ui-normal-text)] disabled:pointer-events-none disabled:cursor-default disabled:opacity-50'
  const variantClasses = {
    outline:
      'border-[var(--ui-neutral-interactive-normal-border)] shadow-[var(--cthulhu-ui-shadow-surface-highlight)] hover:border-[var(--ui-neutral-interactive-hover-border)]',
    'dim-border':
      'border-[var(--ui-neutral-muted-border)] bg-[var(--ui-neutral-muted-surface)] text-[var(--ui-secondary-text)] shadow-[var(--cthulhu-ui-shadow-surface-highlight)] hover:border-[var(--ui-neutral-hover-border)] hover:bg-[var(--ui-neutral-normal-surface)]',
    transparent:
      'border-0 bg-transparent shadow-none hover:border-0 hover:bg-[var(--ui-neutral-normal-surface)]',
    accent:
      'border-[var(--ui-accent-normal-border)] bg-[var(--ui-accent-normal-surface)] text-[var(--ui-accent-normal-text)] shadow-[var(--cthulhu-ui-shadow-surface-highlight)] hover:border-[var(--ui-accent-hover-border)] hover:bg-[var(--ui-accent-hover-surface)] hover:text-[var(--ui-normal-text)]',
    danger:
      'border-[var(--ui-danger-normal-border)] bg-[var(--ui-danger-normal-surface)] text-[var(--ui-danger-icon-glyph)] shadow-[var(--cthulhu-ui-shadow-surface-highlight)] hover:border-[var(--ui-danger-hover-border)] hover:bg-[var(--ui-danger-hover-surface)] hover:text-[var(--ui-danger-icon-glyph)]'
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
    ariaCurrent,
    buttonAction = null,
    buttonActionParameter,
    grabCursor = false,
    onclick,
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
