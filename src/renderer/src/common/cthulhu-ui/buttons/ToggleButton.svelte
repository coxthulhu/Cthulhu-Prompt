<script lang="ts">
  import '@renderer/common/cthulhu-ui/buttons/button.css'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  /** Controlled on/off button with an Enabled/Disabled label. */
  type Props = {
    pressed: boolean
    class?: string
    disabled?: boolean
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  /** Caller-controlled value and native disabled state. */
  let { pressed, class: className, disabled = false, testId, onclick }: Props = $props()
</script>

<!-- Labeled switch shares the filled button surface and pressed colors. -->
<button
  type="button"
  class={mergeClasses(
    'cthulhuUiButtonBase cthulhuUiButtonSurface cthulhuUiButtonToggle cthulhuUiToggleButton text-sm leading-5 font-semibold',
    className
  )}
  data-appearance="filled"
  data-testid={testId}
  aria-pressed={pressed}
  {onclick}
  {disabled}
>
  <span
    class="cthulhuUiToggleButtonTrack flex h-6 w-10 items-center rounded-full p-1 transition duration-[var(--ui-animation-duration-standard)]"
  >
    <span
      class="h-4 w-4 rounded-full bg-[var(--ui-normal-text)] shadow-[var(--cthulhu-ui-shadow-thumb)]"
    ></span>
  </span>
  <span class="w-[64px] text-left">
    {pressed ? 'Enabled' : 'Disabled'}
  </span>
</button>

<style>
  .cthulhuUiToggleButton {
    display: flex;
    flex: 0 1 auto;
    gap: 12px;
    height: 40px;
    padding: 0 14px;
  }

  .cthulhuUiToggleButtonTrack {
    background: var(--ui-neutral-emphasis-surface);
    justify-content: flex-start;
  }

  .cthulhuUiToggleButton[aria-pressed='true'] .cthulhuUiToggleButtonTrack {
    background: var(--ui-accent-action-fill);
    justify-content: flex-end;
  }
</style>
