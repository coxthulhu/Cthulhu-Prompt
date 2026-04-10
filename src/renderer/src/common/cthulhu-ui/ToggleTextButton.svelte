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
    border-color: var(--cthulhu-ui-toggle-button-border-off);
    background-color: var(--cthulhu-ui-toggle-button-surface-off);
    color: var(--cthulhu-ui-toggle-button-text-off);
    box-shadow: inset 0 1px 0 var(--cthulhu-ui-toggle-button-highlight-off);
  }

  .cthulhuUiToggleTextButton:hover {
    background-color: var(--cthulhu-ui-toggle-button-surface-off-hover);
    color: var(--cthulhu-ui-toggle-button-text-off-hover);
  }

  .cthulhuUiToggleTextButton[aria-pressed='true'] {
    border-color: var(--cthulhu-ui-toggle-button-border-on);
    background-color: var(--cthulhu-ui-toggle-button-surface-on);
    color: var(--cthulhu-ui-toggle-button-text-on);
    box-shadow: none;
  }

  .cthulhuUiToggleTextButtonTrack {
    justify-content: flex-start;
    background-color: var(--cthulhu-ui-toggle-track-off);
  }

  .cthulhuUiToggleTextButton[aria-pressed='true'] .cthulhuUiToggleTextButtonTrack {
    justify-content: flex-end;
    background-color: var(--cthulhu-ui-toggle-track-on);
  }

  .cthulhuUiToggleTextButtonThumb {
    background-color: var(--cthulhu-ui-toggle-thumb-surface);
    box-shadow: 0 1px 2px var(--cthulhu-ui-toggle-thumb-shadow);
  }
</style>
