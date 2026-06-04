<script lang="ts">
  import { ChevronRight } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type SelectorButtonSize = 'compact' | 'large'

  type Props = {
    icon: ComponentType
    text: string
    detail?: string
    open?: boolean
    showChevron?: boolean
    size?: SelectorButtonSize
    class?: string
    iconClass?: string
    testId?: string
  }

  let {
    icon: Icon,
    text,
    detail,
    open = false,
    showChevron = true,
    size = 'compact',
    class: className,
    iconClass,
    testId
  }: Props = $props()

  const iconSize = $derived(size === 'large' ? 24 : 20)
  const chevronSize = $derived(size === 'large' ? 24 : 20)
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiSelectorButton', className)}
  data-size={size}
  data-open={open ? 'true' : 'false'}
  data-chevron={showChevron ? 'true' : 'false'}
  data-testid={testId}
  aria-expanded={showChevron ? open : undefined}
>
  <!-- Compact dropdown trigger matching the sidebar selector layout. -->
  <span class="cthulhuUiSelectorButtonIconCell">
    <Icon
      class={mergeClasses('cthulhuUiSelectorButtonIcon', iconClass)}
      size={iconSize}
      aria-hidden="true"
    />
  </span>

  <span class="cthulhuUiSelectorButtonTextStack">
    <span class="cthulhuUiSelectorButtonText">{text}</span>
    {#if detail}
      <span class="cthulhuUiSelectorButtonDetail">{detail}</span>
    {/if}
  </span>

  {#if showChevron}
    <span
      class="cthulhuUiSelectorButtonChevronWrap"
      data-expanded={open ? 'true' : 'false'}
    >
      <ChevronRight
        class="cthulhuUiSelectorButtonChevronIcon"
        size={chevronSize}
        aria-hidden="true"
      />
    </span>
  {/if}
</button>

<style>
  .cthulhuUiSelectorButton {
    align-items: center;
    background-color: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: grid;
    gap: 8px;
    grid-template-columns: 34px minmax(0, 1fr) 22px;
    min-width: 0;
    padding: 8px;
    text-align: left;
    transition:
      background-color 120ms ease,
      color 120ms ease;
    width: 100%;
  }

  .cthulhuUiSelectorButton[data-chevron='false'] {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .cthulhuUiSelectorButton:hover,
  .cthulhuUiSelectorButton[data-open='true'] {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiSelectorButtonIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 34px;
    justify-content: center;
    transition: color 120ms ease;
    width: 34px;
  }

  .cthulhuUiSelectorButton:hover .cthulhuUiSelectorButtonIconCell,
  .cthulhuUiSelectorButton[data-open='true'] .cthulhuUiSelectorButtonIconCell {
    color: var(--ui-normal-text);
  }

  .cthulhuUiSelectorButtonTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiSelectorButtonText,
  .cthulhuUiSelectorButtonDetail {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiSelectorButtonText {
    color: inherit;
    font-size: 14px;
    font-weight: 600;
  }

  .cthulhuUiSelectorButton[data-size='large'] .cthulhuUiSelectorButtonText {
    font-size: 15px;
  }

  .cthulhuUiSelectorButtonDetail {
    color: var(--ui-muted-text);
    font-size: 12px;
  }

  .cthulhuUiSelectorButton[data-size='large'] .cthulhuUiSelectorButtonDetail {
    font-size: 13px;
  }

  .cthulhuUiSelectorButtonChevronWrap {
    align-items: center;
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 22px;
    justify-content: center;
    transform: rotate(0deg);
    transform-origin: center;
    transition: transform 50ms ease-out;
    width: 22px;
  }

  .cthulhuUiSelectorButton:hover .cthulhuUiSelectorButtonChevronWrap,
  .cthulhuUiSelectorButton[data-open='true'] .cthulhuUiSelectorButtonChevronWrap {
    color: var(--ui-normal-text);
  }

  .cthulhuUiSelectorButtonChevronWrap[data-expanded='true'] {
    transform: rotate(90deg);
  }
</style>
