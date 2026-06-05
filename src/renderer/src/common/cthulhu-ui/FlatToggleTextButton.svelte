<script lang="ts">
  import { mergeClasses } from './mergeClasses'

  type Props = {
    pressed: boolean
    class?: string
    disabled?: boolean
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let { pressed, class: className, disabled = false, testId, onclick }: Props = $props()

  const buttonStateClasses = {
    off: 'bg-[var(--ui-neutral-normal-surface)] text-[var(--ui-hoverable-text)] hover:bg-[var(--ui-neutral-hover-surface)] hover:text-[var(--ui-normal-text)]',
    on: 'bg-[var(--ui-accent-normal-surface)] text-[var(--ui-accent-normal-text)] hover:bg-[var(--ui-accent-hover-surface)]'
  }
  const trackStateClasses = {
    off: 'justify-start bg-[var(--ui-neutral-emphasis-surface)]',
    on: 'justify-end bg-[var(--ui-accent-normal-fill)]'
  }
  const stateClassKey = $derived(pressed ? 'on' : 'off')
</script>

<button
  type="button"
  class={mergeClasses(
    'cthulhuUiFlatToggleTextButton flex h-10 cursor-pointer items-center gap-3 rounded-[var(--cthulhu-ui-radius-control)] px-3.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
    buttonStateClasses[stateClassKey],
    className
  )}
  data-testid={testId}
  aria-pressed={pressed}
  {onclick}
  {disabled}
>
  <span
    class={mergeClasses(
      'cthulhuUiFlatToggleTextButtonTrack flex h-6 w-10 items-center rounded-full p-1 transition',
      trackStateClasses[stateClassKey]
    )}
  >
    <span
      class="cthulhuUiFlatToggleTextButtonThumb h-4 w-4 rounded-full bg-[var(--ui-normal-text)] shadow-[var(--cthulhu-ui-shadow-thumb)]"
    ></span>
  </span>
  <span class="w-[64px] text-left">
    {pressed ? 'Enabled' : 'Disabled'}
  </span>
</button>
