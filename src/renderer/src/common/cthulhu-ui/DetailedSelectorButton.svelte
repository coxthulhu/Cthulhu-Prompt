<script lang="ts">
  import DropdownPopupDetailed, {
    type DropdownPopupDetailedItemDragOptions,
    type DropdownPopupDetailedItem
  } from './DropdownPopupDetailed.svelte'
  import SelectorButton from './SelectorButton.svelte'

  type Props = {
    label: string
    items: DropdownPopupDetailedItem[]
    selectedItem: DropdownPopupDetailedItem
    footerItem?: DropdownPopupDetailedItem
    state?: 'enabled' | 'disabled'
    testId?: string
    triggerTestId?: string
    dragOpenTypes?: string[]
    itemDragOptions?: DropdownPopupDetailedItemDragOptions
    onselect?: (item: DropdownPopupDetailedItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    selectedItem,
    footerItem,
    state = 'enabled',
    testId,
    triggerTestId,
    dragOpenTypes,
    itemDragOptions,
    onselect
  }: Props = $props()
</script>

<DropdownPopupDetailed
  {label}
  {items}
  {selectedItem}
  {footerItem}
  {itemDragOptions}
  {testId}
  {dragOpenTypes}
  placement="below-trigger"
  {onselect}
>
  {#snippet trigger(dropdown)}
    <SelectorButton
      icon={selectedItem.icon}
      text={selectedItem.label}
      detail={selectedItem.detail}
      detailParts={selectedItem.detailParts}
      open={dropdown.open}
      {state}
      ariaHaspopup={dropdown.ariaHaspopup}
      ariaExpanded={dropdown.ariaExpanded}
      buttonAction={dropdown.triggerAction}
      onclick={dropdown.toggle}
      testId={triggerTestId}
    />
  {/snippet}
</DropdownPopupDetailed>
