<script lang="ts">
  import type { ComponentType } from 'svelte'
  import '@renderer/common/cthulhu-ui/buttons/button.css'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    icon: ComponentType
    label: string
    active?: boolean
    /** Shortens the active indicator while its sidebar is hidden. */
    compactIndicator?: boolean
    class?: string
    iconClass?: string
    testId?: string
    title?: string
    ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
    ariaExpanded?: boolean
    disabled?: boolean
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    label,
    active = false,
    compactIndicator = false,
    class: className,
    iconClass,
    testId,
    title,
    ariaCurrent,
    ariaExpanded,
    disabled = false,
    onclick
  }: Props = $props()
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiButtonBase cthulhuUiActivityBarButton', className)}
  aria-label={label}
  aria-current={ariaCurrent}
  aria-expanded={ariaExpanded}
  data-active={active ? 'true' : 'false'}
  data-compact-indicator={compactIndicator ? 'true' : 'false'}
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
    height: 44px;
    width: 100%;
    flex: none;
    justify-content: center;
    color: var(--ui-muted-icon-glyph);
    transition: color var(--ui-animation-duration-standard) ease-out;
  }

  .cthulhuUiActivityBarButton:hover,
  .cthulhuUiActivityBarButton:focus-visible {
    color: var(--ui-normal-text);
  }

  .cthulhuUiActivityBarButton[data-active='true'] {
    color: var(--ui-normal-text);
  }

  .cthulhuUiActivityBarButton[data-active='true']::before {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 0;
    width: 2px;
    border-radius: 0 2px 2px 0;
    background-color: var(--ui-accent-strong-border);
    content: '';
  }

  .cthulhuUiActivityBarButton[data-active='true'][data-compact-indicator='true']::before {
    top: 9px;
    bottom: 9px;
  }

  .cthulhuUiActivityBarButtonIcon {
    height: 24px;
    width: 24px;
    flex: none;
  }
</style>
