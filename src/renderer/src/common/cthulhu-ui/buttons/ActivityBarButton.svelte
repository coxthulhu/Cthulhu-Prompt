<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import '@renderer/common/cthulhu-ui/buttons/button.css'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    /** Standard rail glyph; ignored when custom content is supplied. */
    icon?: ComponentType
    label: string
    active?: boolean
    /** Shortens the active indicator while its sidebar is hidden. */
    compactIndicator?: boolean
    /** Highlights the button while it is being dragged to a new position. */
    dragging?: boolean
    class?: string
    iconClass?: string
    testId?: string
    title?: string
    ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
    ariaExpanded?: boolean
    disabled?: boolean
    /** Bound native button, used as an anchor by popup triggers. */
    buttonElement?: HTMLButtonElement
    onclick?: (event: MouseEvent) => void
    children?: Snippet
  }

  let {
    icon: Icon,
    label,
    active = false,
    compactIndicator = false,
    dragging = false,
    class: className,
    iconClass,
    testId,
    title,
    ariaCurrent,
    ariaExpanded,
    disabled = false,
    buttonElement = $bindable(),
    onclick,
    children
  }: Props = $props()
</script>

<button
  bind:this={buttonElement}
  type="button"
  class={mergeClasses('cthulhuUiButtonBase cthulhuUiActivityBarButton', className)}
  aria-label={label}
  aria-current={ariaCurrent}
  aria-expanded={ariaExpanded}
  data-active={active ? 'true' : 'false'}
  data-compact-indicator={compactIndicator ? 'true' : 'false'}
  data-dragging={dragging ? 'true' : 'false'}
  data-testid={testId}
  {title}
  {disabled}
  {onclick}
>
  {#if children}
    {@render children()}
  {:else if Icon}
    <Icon
      class={mergeClasses('cthulhuUiActivityBarButtonIcon', iconClass)}
      strokeWidth={1.5}
      aria-hidden="true"
    />
  {/if}
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
  .cthulhuUiActivityBarButton:focus-visible,
  .cthulhuUiActivityBarButton[aria-expanded='true'],
  .cthulhuUiActivityBarButton[data-active='true'],
  .cthulhuUiActivityBarButton[data-dragging='true'] {
    color: var(--ui-normal-text);
  }

  /* Dragged buttons share the dragged-row fill used by reorderable selector lists. */
  .cthulhuUiActivityBarButton[data-dragging='true'] {
    background-color: var(--ui-info-normal-surface);
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
