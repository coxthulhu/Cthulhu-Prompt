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
    detail?: string
    detailParts?: string[]
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
    onselect?: (item: DropdownPopupDetailedItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    selectedItem,
    trigger,
    footerItem,
    menuWidth = '320px',
    testId,
    placement = 'cursor',
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
            detailParts={item.detailParts}
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
            detailParts={footerItem.detailParts}
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
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .cthulhuUiDropdownPopupDetailedContent {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  .cthulhuUiDropdownPopupDetailedItems {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 2px;
    max-height: calc((58px * 5) + (2px * 4));
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
    flex: 0 0 auto;
    height: 58px;
  }

  :global(.cthulhuUiDropdownPopupDetailedFooterItem:hover),
  :global(.cthulhuUiDropdownPopupDetailedFooterItem[data-selected='true']) {
    background-color: var(--ui-accent-action-hover-fill);
  }
</style>
