<script lang="ts">
  import { mergeClasses } from './mergeClasses'

  type Props = {
    pressed: boolean
    class?: string
    disabled?: boolean
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    pressed,
    class: className,
    disabled = false,
    testId,
    onclick
  }: Props = $props()
</script>

<button
  type="button"
  class={mergeClasses(
    'cthulhuUiToggleTextButton flex h-11 cursor-pointer items-center gap-3 rounded-2xl border px-3.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
    className
  )}
  data-testid={testId}
  aria-pressed={pressed}
  {onclick}
  {disabled}
>
  <span class="cthulhuUiToggleTextButtonTrack flex h-6 w-10 items-center rounded-full p-1 transition">
    <span class="cthulhuUiToggleTextButtonThumb h-4 w-4 rounded-full"></span>
  </span>
  <span class="w-[64px] text-left">
    {pressed ? 'Enabled' : 'Disabled'}
  </span>
</button>

<style>
  .cthulhuUiToggleTextButton {
    border-color: var(--ui-neutral-normal-border);
    background-color: var(--ui-neutral-normal-surface);
    color: var(--ui-hoverable-text);
    box-shadow: inset 0 1px 0 var(--ui-neutral-muted-surface);
  }

  .cthulhuUiToggleTextButton:hover {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiToggleTextButton[aria-pressed='true'] {
    border-color: var(--ui-accent-normal-border);
    background-color: var(--ui-accent-normal-surface);
    color: var(--ui-accent-normal-text);
    box-shadow: none;
  }

  .cthulhuUiToggleTextButton[aria-pressed='true']:hover {
    background-color: var(--ui-accent-hover-surface);
  }

  .cthulhuUiToggleTextButtonTrack {
    justify-content: flex-start;
    background-color: var(--ui-neutral-emphasis-surface);
  }

  .cthulhuUiToggleTextButton[aria-pressed='true'] .cthulhuUiToggleTextButtonTrack {
    justify-content: flex-end;
    background-color: var(--ui-accent-normal-fill);
  }

  .cthulhuUiToggleTextButtonThumb {
    background-color: var(--ui-normal-text);
    box-shadow: 0 1px 2px var(--ui-shadow-raised);
  }
</style>
