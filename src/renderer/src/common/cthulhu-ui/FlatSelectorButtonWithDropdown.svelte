<script lang="ts">
  import FlatDropdownPopupDetailed, {
    type FlatDropdownPopupDetailedItem
  } from './FlatDropdownPopupDetailed.svelte'
  import FlatSelectorButton from './FlatSelectorButton.svelte'

  type Props = {
    label: string
    items: FlatDropdownPopupDetailedItem[]
    selectedItem: FlatDropdownPopupDetailedItem
    footerItem?: FlatDropdownPopupDetailedItem
    testId?: string
    triggerTestId?: string
    onselect?: (item: FlatDropdownPopupDetailedItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    selectedItem,
    footerItem,
    testId,
    triggerTestId,
    onselect
  }: Props = $props()
</script>

<FlatDropdownPopupDetailed
  {label}
  {items}
  {selectedItem}
  {footerItem}
  {testId}
  placement="below-trigger"
  matchTriggerWidth
  {onselect}
>
  {#snippet trigger(dropdown)}
    <FlatSelectorButton
      icon={selectedItem.icon}
      text={selectedItem.label}
      detail={selectedItem.detail}
      detailParts={selectedItem.detailParts}
      open={dropdown.open}
      ariaHaspopup={dropdown.ariaHaspopup}
      ariaExpanded={dropdown.ariaExpanded}
      buttonAction={dropdown.triggerAction}
      onclick={dropdown.toggle}
      testId={triggerTestId}
    />
  {/snippet}
</FlatDropdownPopupDetailed>
