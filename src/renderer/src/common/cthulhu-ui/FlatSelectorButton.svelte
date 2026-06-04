<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type FlatSelectorButtonState = 'enabled' | 'disabled'

  type Props = {
    icon: ComponentType
    text: string
    detail: string
    state?: FlatSelectorButtonState
    class?: string
    iconClass?: string
    testId?: string
    onclick?: (event: MouseEvent) => void
  }

  let {
    icon: Icon,
    text,
    detail,
    state = 'enabled',
    class: className,
    iconClass,
    testId,
    onclick
  }: Props = $props()

  const isDisabled = $derived(state === 'disabled')
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiFlatSelectorButton', className)}
  data-testid={testId}
  {onclick}
  disabled={isDisabled}
>
  <span class="cthulhuUiFlatSelectorButtonIconCell">
    <Icon class={mergeClasses('cthulhuUiFlatSelectorButtonIcon', iconClass)} size={24} aria-hidden="true" />
  </span>

  <span class="cthulhuUiFlatSelectorButtonTextStack">
    <span class="cthulhuUiFlatSelectorButtonText">{text}</span>
    <span class="cthulhuUiFlatSelectorButtonDetail" title={detail}>{detail}</span>
  </span>
</button>

<style>
  .cthulhuUiFlatSelectorButton {
    align-items: center;
    background-color: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: grid;
    gap: 12px;
    grid-template-columns: 34px minmax(0, 1fr);
    min-width: 0;
    padding: 8px;
    text-align: left;
    transition:
      background-color 120ms ease,
      color 120ms ease;
    width: 100%;
  }

  .cthulhuUiFlatSelectorButton:hover,
  .cthulhuUiFlatSelectorButton:focus-visible {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiFlatSelectorButton:disabled {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiFlatSelectorButtonIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 34px;
    justify-content: center;
    transition: color 120ms ease;
    width: 34px;
  }

  .cthulhuUiFlatSelectorButton:hover .cthulhuUiFlatSelectorButtonIconCell,
  .cthulhuUiFlatSelectorButton:focus-visible .cthulhuUiFlatSelectorButtonIconCell {
    color: var(--ui-normal-text);
  }

  .cthulhuUiFlatSelectorButtonIcon {
    stroke-width: 2;
  }

  .cthulhuUiFlatSelectorButtonTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiFlatSelectorButtonText,
  .cthulhuUiFlatSelectorButtonDetail {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .cthulhuUiFlatSelectorButtonText {
    color: inherit;
    display: block;
    font-size: 15px;
    font-weight: 600;
    text-overflow: ellipsis;
  }

  .cthulhuUiFlatSelectorButtonDetail {
    color: var(--ui-muted-text);
    display: block;
    font-size: 13px;
    text-overflow: ellipsis;
  }
</style>
