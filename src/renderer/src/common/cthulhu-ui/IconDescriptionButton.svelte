<script lang="ts">
  import type { ComponentType } from 'svelte'
  import AccentIconTile, { type AccentIconTileVariant } from './AccentIconTile.svelte'
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

  const variantClasses = {
    neutral:
      'border-[var(--ui-neutral-interactive-normal-border)] bg-[var(--ui-neutral-normal-surface)] text-[var(--ui-secondary-text)] hover:border-[var(--ui-neutral-interactive-hover-border)] hover:bg-[var(--ui-neutral-hover-surface)] hover:text-[var(--ui-normal-text)]',
    accent:
      'border-[var(--ui-accent-normal-border)] bg-[var(--ui-accent-normal-surface)] text-[var(--ui-accent-normal-text)] hover:border-[var(--ui-accent-hover-border)] hover:bg-[var(--ui-accent-hover-surface)]',
    danger:
      'border-[var(--ui-danger-normal-border)] bg-[var(--ui-danger-normal-surface)] hover:border-[var(--ui-danger-hover-border)] hover:bg-[var(--ui-danger-hover-surface)]'
  } satisfies Record<IconDescriptionButtonVariant, string>
  const iconTileVariants = {
    neutral: 'neutral',
    accent: 'accent',
    danger: 'danger'
  } satisfies Record<IconDescriptionButtonVariant, AccentIconTileVariant>

  const isDisabled = $derived(state === 'disabled')
</script>

<button
  type="button"
  class={mergeClasses(
    'cthulhuUiIconDescriptionButton group/icon-description-button grid w-full min-w-0 cursor-pointer grid-cols-[42px_minmax(0,1fr)] items-center gap-3 rounded-[7px] border p-2.5 text-left transition disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    className
  )}
  data-testid={testId}
  data-variant={variant}
  {onclick}
  disabled={isDisabled}
>
  <!-- Icon-leading action button with a persistent detail line. -->
  <AccentIconTile
    icon={Icon}
    variant={iconTileVariants[variant]}
    size="medium"
    class="cthulhuUiIconDescriptionButtonIcon"
    iconClass={mergeClasses('!stroke-[2] text-[var(--ui-normal-text)]', iconClass)}
  />

  <span class="flex min-w-0 flex-col gap-[3px]">
    <span
      class="cthulhuUiIconDescriptionButtonText text-[15px] leading-5 font-bold text-[var(--ui-normal-text)]"
      >{text}</span
    >
    <span
      class="cthulhuUiIconDescriptionButtonDescription text-[13px] leading-[18px] font-medium text-[var(--ui-secondary-text)]"
      >{description}</span
    >
  </span>
</button>
