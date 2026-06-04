<script lang="ts">
  import { ChevronRight } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'
  import { mergeClasses } from './mergeClasses'

  type Props = {
    icon: ComponentType
    text: string
    detail?: string
    open?: boolean
    showChevron?: boolean
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
    class: className,
    iconClass,
    testId
  }: Props = $props()
</script>

<button
  type="button"
  class={mergeClasses('cthulhuUiDropdownSelectorButton', className)}
  data-open={open ? 'true' : 'false'}
  data-chevron={showChevron ? 'true' : 'false'}
  data-testid={testId}
  aria-expanded={showChevron ? open : undefined}
>
  <!-- Compact dropdown trigger matching the sidebar selector layout. -->
  <span class="cthulhuUiDropdownSelectorButtonIconCell">
    <Icon
      class={mergeClasses('cthulhuUiDropdownSelectorButtonIcon', iconClass)}
      aria-hidden="true"
    />
  </span>

  <span class="cthulhuUiDropdownSelectorButtonTextStack">
    <span class="cthulhuUiDropdownSelectorButtonText">{text}</span>
    {#if detail}
      <span class="cthulhuUiDropdownSelectorButtonDetail">{detail}</span>
    {/if}
  </span>

  {#if showChevron}
    <span
      class="cthulhuUiDropdownSelectorButtonChevronWrap"
      data-expanded={open ? 'true' : 'false'}
    >
      <ChevronRight class="cthulhuUiDropdownSelectorButtonChevronIcon" aria-hidden="true" />
    </span>
  {/if}
</button>

<style>
  .cthulhuUiDropdownSelectorButton {
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

  .cthulhuUiDropdownSelectorButton[data-chevron='false'] {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .cthulhuUiDropdownSelectorButton:hover,
  .cthulhuUiDropdownSelectorButton[data-open='true'] {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownSelectorButtonIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 34px;
    justify-content: center;
    transition: color 120ms ease;
    width: 34px;
  }

  .cthulhuUiDropdownSelectorButton:hover .cthulhuUiDropdownSelectorButtonIconCell,
  .cthulhuUiDropdownSelectorButton[data-open='true'] .cthulhuUiDropdownSelectorButtonIconCell {
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownSelectorButtonIcon {
    height: 18px;
    width: 18px;
  }

  .cthulhuUiDropdownSelectorButtonTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiDropdownSelectorButtonText,
  .cthulhuUiDropdownSelectorButtonDetail {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiDropdownSelectorButtonText {
    color: inherit;
    font-size: 14px;
    font-weight: 600;
  }

  .cthulhuUiDropdownSelectorButtonDetail {
    color: var(--ui-muted-text);
    font-size: 12px;
  }

  .cthulhuUiDropdownSelectorButtonChevronWrap {
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

  .cthulhuUiDropdownSelectorButton:hover .cthulhuUiDropdownSelectorButtonChevronWrap,
  .cthulhuUiDropdownSelectorButton[data-open='true'] .cthulhuUiDropdownSelectorButtonChevronWrap {
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownSelectorButtonChevronIcon {
    height: 18px;
    width: 18px;
  }

  .cthulhuUiDropdownSelectorButtonChevronWrap[data-expanded='true'] {
    transform: rotate(90deg);
  }
</style>
