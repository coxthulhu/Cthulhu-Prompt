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
  class={mergeClasses('cthulhuUiFlatActivityBarButton', className)}
  aria-label={label}
  aria-current={ariaCurrent}
  data-active={active ? 'true' : 'false'}
  data-testid={testId}
  {title}
  {disabled}
  {onclick}
>
  <Icon
    class={mergeClasses('cthulhuUiFlatActivityBarButtonIcon', iconClass)}
    strokeWidth={1.5}
    aria-hidden="true"
  />
</button>

<style>
  .cthulhuUiFlatActivityBarButton {
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
    background: var(--ui-flat-ghost-surface);
    color: var(--ui-flat-muted-icon-glyph);
    transition: color 120ms ease-out;
  }

  .cthulhuUiFlatActivityBarButton:hover {
    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatActivityBarButton[data-active='true'] {
    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatActivityBarButton[data-active='true']::before {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 0;
    width: 2px;
    border-radius: 0 2px 2px 0;
    background-color: var(--ui-flat-accent-strong-border);
    content: '';
  }

  .cthulhuUiFlatActivityBarButton:disabled {
    pointer-events: none;
    cursor: default;
    opacity: 0.5;
  }

  .cthulhuUiFlatActivityBarButtonIcon {
    height: 24px;
    width: 24px;
    flex: none;
  }
</style>
