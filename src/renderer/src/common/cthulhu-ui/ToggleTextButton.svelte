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
    border-color: var(--ui-border-default);
    background-color: var(--ui-surface-default);
    color: var(--ui-default-text);
    box-shadow: inset 0 1px 0 var(--ui-surface-muted);
  }

  .cthulhuUiToggleTextButton:hover {
    background-color: var(--ui-surface-hover);
    color: var(--ui-emphasis-text);
  }

  .cthulhuUiToggleTextButton[aria-pressed='true'] {
    border-color: var(--ui-accent-border);
    background-color: var(--ui-accent-surface-default);
    color: var(--ui-accent-text);
    box-shadow: none;
  }

  .cthulhuUiToggleTextButton[aria-pressed='true']:hover {
    background-color: var(--ui-accent-surface-hover);
  }

  .cthulhuUiToggleTextButtonTrack {
    justify-content: flex-start;
    background-color: var(--ui-surface-emphasis);
  }

  .cthulhuUiToggleTextButton[aria-pressed='true'] .cthulhuUiToggleTextButtonTrack {
    justify-content: flex-end;
    background-color: var(--ui-accent-fill);
  }

  .cthulhuUiToggleTextButtonThumb {
    background-color: var(--ui-emphasis-text);
    box-shadow: 0 1px 2px var(--ui-shadow-raised);
  }
</style>
