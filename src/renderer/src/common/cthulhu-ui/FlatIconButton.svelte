<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type FlatIconButtonState = 'enabled' | 'disabled'

  type Props = {
    icon: ComponentType
    label: string
    state?: FlatIconButtonState
    class?: string
    iconClass?: string
    iconTestId?: string
    testId?: string
    title?: string
    disabled?: boolean
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    label,
    state = 'enabled',
    class: className,
    iconClass,
    iconTestId,
    testId,
    title,
    disabled,
    onclick
  }: Props = $props()

  const isDisabled = $derived(disabled === true || state === 'disabled')
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiFlatIconButton', className)}
  aria-label={label}
  data-disabled={isDisabled ? 'true' : 'false'}
  data-state={isDisabled ? 'disabled' : 'enabled'}
  data-testid={testId}
  {title}
  disabled={isDisabled}
  {onclick}
>
  <!-- Backgroundless flat icon button for compact row actions. -->
  <Icon
    class={mergeClasses('cthulhuUiFlatIconButtonIcon', iconClass)}
    size={20}
    data-testid={iconTestId}
    aria-hidden="true"
  />
</button>

<style>
  .cthulhuUiFlatIconButton {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    height: 30px;
    justify-content: center;
    min-width: 0;
    padding: 0;
    transition: color 120ms ease;
    width: 30px;
  }

  .cthulhuUiFlatIconButton:hover,
  .cthulhuUiFlatIconButton:focus-visible {
    color: var(--ui-normal-text);
  }

  .cthulhuUiFlatIconButton:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuUiFlatIconButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiFlatIconButtonIcon {
    height: 16px;
    stroke-width: 2;
    width: 16px;
  }
</style>
