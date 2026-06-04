<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import DropdownPopupCore, {
    type DropdownPopupPlacement,
    type DropdownPopupTriggerContext
  } from './DropdownPopupCore.svelte'
  import SelectorButton from './SelectorButton.svelte'

  export type DropdownPopupDetailedItem = {
    id: string
    label: string
    detail: string
    icon: ComponentType
    testId?: string
  }

  type Props = {
    label: string
    items: DropdownPopupDetailedItem[]
    selectedItem: DropdownPopupDetailedItem | null
    trigger: Snippet<[DropdownPopupTriggerContext]>
    footerItem?: DropdownPopupDetailedItem
    menuWidth?: string
    testId?: string
    placement?: DropdownPopupPlacement
    matchTriggerWidth?: boolean
    onselect?: (item: DropdownPopupDetailedItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    selectedItem,
    trigger,
    footerItem,
    menuWidth = '280px',
    testId,
    placement = 'cursor',
    matchTriggerWidth = false,
    onselect
  }: Props = $props()

  const selectItem = (
    item: DropdownPopupDetailedItem,
    event: MouseEvent,
    close: () => void
  ) => {
    close()
    onselect?.(item, event)
  }
</script>

<DropdownPopupCore
  {label}
  {trigger}
  {menuWidth}
  {testId}
  {placement}
  {matchTriggerWidth}
  menuClass="cthulhuUiDropdownPopupDetailedMenu p-[6px]"
>
  {#snippet children({ close })}
    <div class="cthulhuUiDropdownPopupDetailedContent">
      <div class="cthulhuUiDropdownPopupDetailedItems">
        {#each items as item (item.id)}
          <SelectorButton
            icon={item.icon}
            text={item.label}
            detail={item.detail}
            showChevron={false}
            selected={selectedItem?.id === item.id}
            role="menuitem"
            ariaSelected={selectedItem?.id === item.id}
            testId={item.testId}
            class="cthulhuUiDropdownPopupDetailedItem"
            onclick={(event) => selectItem(item, event, close)}
          />
        {/each}
      </div>

      {#if footerItem}
        <div class="cthulhuUiDropdownPopupDetailedFooter">
          <SelectorButton
            icon={footerItem.icon}
            text={footerItem.label}
            detail={footerItem.detail}
            showChevron={false}
            selected={selectedItem?.id === footerItem.id}
            role="menuitem"
            ariaSelected={selectedItem?.id === footerItem.id}
            testId={footerItem.testId}
            class="cthulhuUiDropdownPopupDetailedItem cthulhuUiDropdownPopupDetailedFooterItem"
            onclick={(event) => selectItem(footerItem, event, close)}
          />
        </div>
      {/if}
    </div>
  {/snippet}
</DropdownPopupCore>

<style>
  :global(.cthulhuUiDropdownPopupDetailedMenu) {
    max-height: min(392px, calc(100vh - 32px));
    overflow: hidden;
  }

  .cthulhuUiDropdownPopupDetailedContent {
    display: flex;
    flex-direction: column;
    max-height: inherit;
    min-height: 0;
  }

  .cthulhuUiDropdownPopupDetailedItems {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 0;
    overflow-y: auto;
  }

  .cthulhuUiDropdownPopupDetailedFooter {
    border-top: 1px solid var(--ui-neutral-muted-border);
    flex-shrink: 0;
    margin: 5px -6px 0;
    padding: 5px 6px 0;
  }

  :global(.cthulhuUiDropdownPopupDetailedItem) {
    border-radius: 8px;
    min-height: 50px;
  }

  :global(.cthulhuUiDropdownPopupDetailedFooterItem:hover),
  :global(.cthulhuUiDropdownPopupDetailedFooterItem[data-selected='true']) {
    background-color: var(--ui-accent-hover-surface);
  }
</style>
