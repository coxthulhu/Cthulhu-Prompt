<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    icon: ComponentType
    label: string
    active?: boolean
    class?: string
    iconClass?: string
    testId?: string
    title?: string
    ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
    disabled?: boolean
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    label,
    active = false,
    class: className,
    iconClass,
    testId,
    title,
    ariaCurrent,
    disabled = false,
    onclick
  }: Props = $props()
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiActivityBarButton', className)}
  aria-label={label}
  aria-current={ariaCurrent}
  data-active={active ? 'true' : 'false'}
  data-testid={testId}
  {title}
  {disabled}
  {onclick}
>
  <Icon
    class={mergeClasses('cthulhuUiActivityBarButtonIcon', iconClass)}
    strokeWidth={1.5}
    aria-hidden="true"
  />
</button>

<style>
  .cthulhuUiActivityBarButton {
    position: relative;
    display: inline-flex;
    height: 44px;
    width: 100%;
    flex: none;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--ui-muted-icon-glyph);
    transition: color 120ms ease-out;
  }

  .cthulhuUiActivityBarButton:hover {
    color: var(--ui-normal-text);
  }

  .cthulhuUiActivityBarButton[data-active='true'] {
    color: var(--ui-normal-text);
  }

  .cthulhuUiActivityBarButton[data-active='true']::before {
    position: absolute;
    top: 5px;
    bottom: 5px;
    left: 0;
    width: 2px;
    border-radius: 0 2px 2px 0;
    background-color: var(--ui-accent-strong-border);
    content: '';
  }

  .cthulhuUiActivityBarButton:disabled {
    pointer-events: none;
    cursor: default;
    opacity: 0.5;
  }

  .cthulhuUiActivityBarButtonIcon {
    height: 24px;
    width: 24px;
    flex: none;
  }
</style>
