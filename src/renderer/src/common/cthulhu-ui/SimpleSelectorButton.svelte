<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { ChevronDown } from 'lucide-svelte'
  import DropdownPopupMoreOptions from './DropdownPopupMoreOptions.svelte'
  import type { DropdownPopupDetailedItem } from './DropdownPopupDetailed.svelte'
  import IconButton from './IconButton.svelte'
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
    valueWidth?: string
    testId?: string
    moreOptionsTestId?: string
    menuTestId?: string
    menuWidth?: string
    moreOptionsLabel?: string
    onselect?: (item: SimpleSelectorButtonItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    selectedItem,
    class: className,
    disabled = false,
    showIcon = false,
    valueWidth = 'auto',
    testId,
    moreOptionsTestId,
    menuTestId,
    menuWidth,
    moreOptionsLabel = `${label} More Options`,
    onselect
  }: SimpleSelectorButtonProps = $props()

  const selectedLabel = $derived(selectedItem.selectedLabel ?? selectedItem.label)
  const selectedItemLabel = $derived(`${label}: ${selectedLabel}`)
  const SelectedIcon = $derived<ComponentType>(selectedItem.icon)
  const selectorStyle = $derived(`--cthulhu-ui-simple-selector-value-width: ${valueWidth};`)
</script>

<DropdownPopupMoreOptions
  label={moreOptionsLabel}
  {items}
  {menuWidth}
  testId={menuTestId}
  onselect={(item, event) => onselect?.(item, event)}
>
  {#snippet trigger(dropdown)}
    {@const triggerAction = dropdown.triggerAction}
    <span
      use:triggerAction
      class={mergeClasses('cthulhuUiSimpleSelectorButton', className)}
      data-tone={selectedItem.tone ?? 'neutral'}
      data-open={dropdown.open ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      style={selectorStyle}
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
        {#if showIcon}
          <SelectedIcon class={selectedItem.iconClass} size={16} aria-hidden="true" />
        {/if}
        <span>{selectedLabel}</span>
      </button>

      <IconButton
        icon={ChevronDown}
        label={moreOptionsLabel}
        title="More Options"
        ariaHaspopup={dropdown.ariaHaspopup}
        ariaExpanded={dropdown.ariaExpanded}
        {disabled}
        onclick={dropdown.toggle}
        testId={moreOptionsTestId}
        class="cthulhuUiSimpleSelectorButtonMoreOptions"
      />
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
    display: inline-flex;
    height: 36px;
    transition:
      background-color 120ms ease,
      border-color 120ms ease;
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
    border-right: 1px solid var(--cthulhu-ui-simple-selector-border);
    border-radius: 0;
    box-sizing: border-box;
    color: var(--cthulhu-ui-simple-selector-text);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 var(--cthulhu-ui-simple-selector-value-width);
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    gap: 6px;
    height: 34px;
    justify-content: center;
    padding: 0 12px;
    white-space: nowrap;
    width: var(--cthulhu-ui-simple-selector-value-width);
  }

  .cthulhuUiSimpleSelectorButtonValue:focus-visible {
    outline: none;
  }

  .cthulhuUiSimpleSelectorButtonValue :global(svg) {
    flex: 0 0 auto;
  }

  :global(.cthulhuUiSimpleSelectorButtonMoreOptions.cthulhuUiIconButton) {
    background: transparent;
    border: 0;
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
    height: 34px;
    width: 23px;
  }

  :global(.cthulhuUiSimpleSelectorButtonMoreOptions.cthulhuUiIconButton:hover),
  :global(.cthulhuUiSimpleSelectorButtonMoreOptions.cthulhuUiIconButton:focus-visible) {
    background: transparent;
    outline: none;
  }
</style>
