<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { ChevronDown, ChevronUp } from 'lucide-svelte'
  import DropdownPopupMoreOptions from './DropdownPopupMoreOptions.svelte'
  import type { DropdownPopupDetailedItem } from './DropdownPopupDetailed.svelte'
  import { mergeClasses } from './mergeClasses'

  export type SimpleSelectorButtonTone = 'neutral' | 'warning' | 'success'

  export type SimpleSelectorButtonItem = DropdownPopupDetailedItem & {
    selectedLabel?: string
    tone?: SimpleSelectorButtonTone
    variant?: string
  }

  export type SimpleSelectorButtonProps = {
    label: string
    items: SimpleSelectorButtonItem[]
    selectedItem: SimpleSelectorButtonItem
    class?: string
    disabled?: boolean
    showIcon?: boolean
    testId?: string
    moreOptionsTestId?: string
    menuTestId?: string
    menuWidth?: string
    onselect?: (item: SimpleSelectorButtonItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    selectedItem,
    class: className,
    disabled = false,
    showIcon = false,
    testId,
    moreOptionsTestId,
    menuTestId,
    menuWidth,
    onselect
  }: SimpleSelectorButtonProps = $props()

  const selectedLabel = $derived(selectedItem.selectedLabel ?? selectedItem.label)
  const selectedItemLabel = $derived(`${label}: ${selectedLabel}`)
  const SelectedIcon = $derived<ComponentType>(selectedItem.icon)
</script>

<DropdownPopupMoreOptions
  label={`${label} More Options`}
  {items}
  {menuWidth}
  testId={menuTestId}
  onselect={(item, event) => onselect?.(item, event)}
>
  {#snippet trigger(dropdown)}
    {@const triggerAction = dropdown.triggerAction}
    {@const DropdownChevron = dropdown.open ? ChevronUp : ChevronDown}
    <span
      use:triggerAction
      class={mergeClasses('cthulhuUiSimpleSelectorButton', className)}
      data-tone={selectedItem.tone ?? 'neutral'}
      data-open={dropdown.open ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
    >
      <button
        type="button"
        class="cthulhuUiSimpleSelectorButtonValue"
        data-variant={selectedItem.variant ?? selectedItem.tone ?? 'neutral'}
        data-testid={testId}
        title={selectedItemLabel}
        aria-label={selectedItemLabel}
        aria-haspopup={dropdown.ariaHaspopup}
        aria-expanded={dropdown.ariaExpanded}
        {disabled}
        onclick={dropdown.toggle}
      >
        <span class="cthulhuUiSimpleSelectorButtonValueContent">
          {#if showIcon}
            <SelectedIcon class={selectedItem.iconClass} size={16} aria-hidden="true" />
          {/if}
          <span>{selectedLabel}</span>
        </span>
        <span
          class="cthulhuUiSimpleSelectorButtonMoreOptions"
          data-testid={moreOptionsTestId}
          title="More Options"
          aria-hidden="true"
        >
          <DropdownChevron size={20} />
        </span>
      </button>
      <span class="cthulhuUiSimpleSelectorButtonWidthSizer" aria-hidden="true">
        {#each [...items, selectedItem] as sizingItem, index (`${sizingItem.id}-${index}`)}
          {@const SizingIcon = sizingItem.icon}
          <span class="cthulhuUiSimpleSelectorButtonWidthSizerItem">
            {#if showIcon}
              <SizingIcon size={16} />
            {/if}
            <span>{sizingItem.selectedLabel ?? sizingItem.label}</span>
          </span>
        {/each}
      </span>
    </span>
  {/snippet}
</DropdownPopupMoreOptions>

<style>
  .cthulhuUiSimpleSelectorButton {
    --cthulhu-ui-simple-selector-border: var(--ui-neutral-normal-border);
    --cthulhu-ui-simple-selector-text: var(--ui-normal-text);

    align-items: stretch;
    background: transparent;
    border: 1px solid var(--cthulhu-ui-simple-selector-border);
    border-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    display: inline-grid;
    height: 36px;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-standard) ease;
    width: fit-content;
  }

  .cthulhuUiSimpleSelectorButton[data-tone='warning'] {
    --cthulhu-ui-simple-selector-text: var(--ui-warning-icon-glyph);
  }

  .cthulhuUiSimpleSelectorButton[data-tone='success'] {
    --cthulhu-ui-simple-selector-text: var(--ui-success-normal-text);
  }

  .cthulhuUiSimpleSelectorButton:hover {
    --cthulhu-ui-simple-selector-border: var(--ui-neutral-hover-border);

    background: var(--ui-neutral-action-fill);
  }

  .cthulhuUiSimpleSelectorButton[data-open='true'] {
    background: var(--ui-neutral-action-hover-fill);
  }

  .cthulhuUiSimpleSelectorButton:has(:focus-visible) {
    --cthulhu-ui-simple-selector-border: var(--ui-neutral-hover-border);

    background: var(--ui-neutral-action-fill);
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  .cthulhuUiSimpleSelectorButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiSimpleSelectorButtonValue {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-sizing: border-box;
    color: var(--cthulhu-ui-simple-selector-text);
    cursor: pointer;
    display: inline-flex;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    grid-area: 1 / 1;
    height: 34px;
    padding: 0;
    white-space: nowrap;
    width: 100%;
  }

  .cthulhuUiSimpleSelectorButtonValue:focus-visible {
    outline: none;
  }

  .cthulhuUiSimpleSelectorButtonValueContent {
    align-items: center;
    box-sizing: border-box;
    display: inline-flex;
    flex: 1 1 auto;
    gap: 6px;
    height: 34px;
    justify-content: center;
    min-width: 0;
    padding-left: 8px;
  }

  .cthulhuUiSimpleSelectorButtonWidthSizerItem {
    align-items: center;
    display: inline-flex;
    gap: 6px;
  }

  .cthulhuUiSimpleSelectorButtonWidthSizer {
    display: grid;
    grid-area: 1 / 1;
    pointer-events: none;
    visibility: hidden;
  }

  .cthulhuUiSimpleSelectorButtonWidthSizerItem {
    grid-area: 1 / 1;
    padding-left: 8px;
    padding-right: 32px;
    width: max-content;
  }

  .cthulhuUiSimpleSelectorButtonValueContent :global(svg),
  .cthulhuUiSimpleSelectorButtonWidthSizerItem :global(svg) {
    flex: 0 0 auto;
  }

  .cthulhuUiSimpleSelectorButtonMoreOptions {
    align-items: center;
    color: var(--ui-normal-text);
    display: inline-flex;
    flex: 0 0 auto;
    height: 34px;
    justify-content: center;
    margin-left: auto;
    padding: 0 6px;
  }
</style>
