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
</script>

<button
  type="button"
  class={mergeClasses(
    'cthulhuUiToggleTextButton flex h-11 cursor-pointer items-center gap-3 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
    className
  )}
  data-testid={testId}
  aria-pressed={pressed}
  {onclick}
  {disabled}
>
  <span
    class="cthulhuUiToggleTextButtonTrack flex h-6 w-10 items-center rounded-full p-1 transition"
  >
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
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-hoverable-text);
  }

  .cthulhuUiToggleTextButton:hover {
    border-color: var(--ui-neutral-hover-border);
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiToggleTextButton[aria-pressed='true'] {
    border-color: var(--ui-accent-normal-border);
    background-color: var(--ui-accent-normal-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiToggleTextButton[aria-pressed='true']:hover {
    border-color: var(--ui-accent-hover-border);
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
    box-shadow: var(--cthulhu-ui-shadow-thumb);
  }
</style>
