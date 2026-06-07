<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import DropdownPopupCore, {
    type DropdownPopupPlacement,
    type DropdownPopupTriggerContext
  } from './DropdownPopupCore.svelte'
  import FlatSelectorButton from './FlatSelectorButton.svelte'

  export type FlatDropdownPopupDetailedItem = {
    id: string
    label: string
    detail?: string
    detailParts?: string[]
    icon: ComponentType
    testId?: string
  }

  type Props = {
    label: string
    items: FlatDropdownPopupDetailedItem[]
    selectedItem: FlatDropdownPopupDetailedItem | null
    trigger: Snippet<[DropdownPopupTriggerContext]>
    footerItem?: FlatDropdownPopupDetailedItem
    menuWidth?: string
    testId?: string
    placement?: DropdownPopupPlacement
    matchTriggerWidth?: boolean
    onselect?: (item: FlatDropdownPopupDetailedItem, event: MouseEvent) => void
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
    item: FlatDropdownPopupDetailedItem,
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
  menuClass="cthulhuUiFlatDropdownPopupDetailedMenu p-[6px]"
>
  {#snippet children({ close })}
    <div class="cthulhuUiFlatDropdownPopupDetailedContent">
      <div class="cthulhuUiFlatDropdownPopupDetailedItems">
        {#each items as item (item.id)}
          <FlatSelectorButton
            icon={item.icon}
            text={item.label}
            detail={item.detail}
            detailParts={item.detailParts}
            showChevron={false}
            selected={selectedItem?.id === item.id}
            role="menuitem"
            ariaSelected={selectedItem?.id === item.id}
            testId={item.testId}
            class="cthulhuUiFlatDropdownPopupDetailedItem"
            onclick={(event) => selectItem(item, event, close)}
          />
        {/each}
      </div>

      {#if footerItem}
        <div class="cthulhuUiFlatDropdownPopupDetailedFooter">
          <FlatSelectorButton
            icon={footerItem.icon}
            text={footerItem.label}
            detail={footerItem.detail}
            detailParts={footerItem.detailParts}
            showChevron={false}
            selected={selectedItem?.id === footerItem.id}
            role="menuitem"
            ariaSelected={selectedItem?.id === footerItem.id}
            testId={footerItem.testId}
            class="cthulhuUiFlatDropdownPopupDetailedItem cthulhuUiFlatDropdownPopupDetailedFooterItem"
            onclick={(event) => selectItem(footerItem, event, close)}
          />
        </div>
      {/if}
    </div>
  {/snippet}
</DropdownPopupCore>

<style>
  :global(.cthulhuUiFlatDropdownPopupDetailedMenu) {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .cthulhuUiFlatDropdownPopupDetailedContent {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  .cthulhuUiFlatDropdownPopupDetailedItems {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 2px;
    max-height: calc((58px * 5) + (2px * 4));
    min-height: 0;
    overflow-y: auto;
  }

  .cthulhuUiFlatDropdownPopupDetailedFooter {
    border-top: 1px solid var(--ui-neutral-muted-border);
    flex-shrink: 0;
    margin: 5px -6px 0;
    padding: 5px 6px 0;
  }

  :global(.cthulhuUiFlatDropdownPopupDetailedItem) {
    border-radius: 8px;
    flex: 0 0 auto;
    height: 58px;
  }

  :global(.cthulhuUiFlatDropdownPopupDetailedFooterItem:hover),
  :global(.cthulhuUiFlatDropdownPopupDetailedFooterItem[data-selected='true']) {
    background-color: var(--ui-accent-hover-surface);
  }
</style>
