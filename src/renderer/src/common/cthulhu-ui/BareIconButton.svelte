<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    icon: ComponentType
    label: string
    class?: string
    iconClass?: string
    testId?: string
    title?: string
    disabled?: boolean
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    label,
    class: className,
    iconClass,
    testId,
    title,
    disabled = false,
    onclick
  }: Props = $props()
</script>

<button
  type="button"
  class={mergeClasses(
    'cthulhuUiBareIconButton inline-flex h-[18px] w-[18px] flex-none cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[var(--ui-muted-text)] transition-colors duration-[120ms] hover:text-[var(--ui-hoverable-text)] disabled:pointer-events-none disabled:cursor-default disabled:opacity-50',
    className
  )}
  aria-label={label}
  data-testid={testId}
  {title}
  {disabled}
  {onclick}
>
  <Icon
    class={mergeClasses('cthulhuUiBareIconButtonIcon h-3.5 w-3.5', iconClass)}
    aria-hidden="true"
  />
</button>
