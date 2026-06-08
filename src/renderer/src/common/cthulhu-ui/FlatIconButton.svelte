<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type FlatIconButtonState = 'enabled' | 'disabled'
  type FlatIconButtonSize = 'default' | 'compact'

  type Props = {
    icon: ComponentType
    label: string
    state?: FlatIconButtonState
    size?: FlatIconButtonSize
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
    size = 'default',
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
  data-size={size}
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
    background: var(--ui-flat-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-flat-hoverable-icon-glyph);
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

  .cthulhuUiFlatIconButton[data-size='compact'] {
    height: 28px;
    width: 28px;
  }

  .cthulhuUiFlatIconButton:hover,
  .cthulhuUiFlatIconButton:focus-visible {
    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatIconButton:focus-visible {
    outline: 2px solid var(--ui-flat-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuUiFlatIconButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
