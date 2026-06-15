<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import { GripVertical } from 'lucide-svelte'
  import {
    draggable,
    type DraggableOptions,
    type DroppableOptions
  } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import DropIndicator from '@renderer/features/drag-drop/DropIndicator.svelte'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import DropdownPopupCore, {
    type DropdownPopupPlacement,
    type DropdownPopupTriggerContext
  } from './DropdownPopupCore.svelte'
  import SelectorButton, { type SelectorButtonRowState } from './SelectorButton.svelte'

  export type DropdownPopupDetailedItem = {
    id: string
    label: string
    detail?: string
    detailParts?: string[]
    icon: ComponentType
    testId?: string
  }

  export type DropdownPopupDetailedItemDragOptions = {
    getDraggableOptions: (item: DropdownPopupDetailedItem) => DraggableOptions<unknown, unknown>
    getDroppableOptions: (item: DropdownPopupDetailedItem) => DroppableOptions<unknown, unknown>
    getRowDroppableOptions?: (item: DropdownPopupDetailedItem) => DroppableOptions<unknown, unknown>
    getDragHandleTestId: (item: DropdownPopupDetailedItem) => string
    getDropIndicatorTestId: (item: DropdownPopupDetailedItem) => string
    isDragging: (item: DropdownPopupDetailedItem) => boolean
    isDraggingAny: () => boolean
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
    dragOpenTypes?: string[]
    itemDragOptions?: DropdownPopupDetailedItemDragOptions
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
    dragOpenTypes,
    itemDragOptions,
    onselect
  }: Props = $props()

  const draggableButtonAction = draggable as unknown as Action<HTMLButtonElement, unknown>

  const getItemRowState = (
    item: DropdownPopupDetailedItem,
    isRowDropOver: boolean
  ): SelectorButtonRowState => {
    const isDraggingAny = itemDragOptions?.isDraggingAny() ?? false

    if (isRowDropOver) return 'over'
    if (itemDragOptions?.isDragging(item)) return 'dragging'
    if (selectedItem?.id === item.id) return isDraggingAny ? 'drag-active' : 'active'
    return isDraggingAny ? 'drag-idle' : 'idle'
  }

  const selectItem = (item: DropdownPopupDetailedItem, event: MouseEvent, close: () => void) => {
    close()
    onselect?.(item, event)
  }
</script>

{#snippet draggableItem(item: DropdownPopupDetailedItem, close: () => void, isRowDropOver: boolean)}
  <PromptDropTarget
    getOptions={() => itemDragOptions!.getDroppableOptions(item)}
    class="cthulhuUiDropdownPopupDetailedDragTarget"
  >
    {#snippet children({ edge })}
      <SelectorButton
        icon={item.icon}
        text={item.label}
        detail={item.detail}
        detailParts={item.detailParts}
        showChevron={false}
        selected={selectedItem?.id === item.id}
        rowState={getItemRowState(item, isRowDropOver)}
        role="menuitem"
        ariaSelected={selectedItem?.id === item.id}
        testId={item.testId}
        leadingAccessoryTestId={itemDragOptions!.getDragHandleTestId(item)}
        buttonAction={draggableButtonAction}
        buttonActionParameter={itemDragOptions!.getDraggableOptions(item)}
        class="cthulhuUiDropdownPopupDetailedItem cthulhuUiDropdownPopupDetailedDragItem"
        onclick={(event) => selectItem(item, event, close)}
      >
        {#snippet leadingAccessory()}
          <GripVertical size={16} aria-hidden="true" />
        {/snippet}
      </SelectorButton>

      {#if edge}
        <DropIndicator
          testId={itemDragOptions!.getDropIndicatorTestId(item)}
          {edge}
          edgeOffset="1px"
          insetStart="8px"
        />
      {/if}
    {/snippet}
  </PromptDropTarget>
{/snippet}

<DropdownPopupCore
  {label}
  {trigger}
  {menuWidth}
  {testId}
  {placement}
  {dragOpenTypes}
  menuClass="cthulhuUiDropdownPopupDetailedMenu p-[6px]"
>
  {#snippet children({ close })}
    <div class="cthulhuUiDropdownPopupDetailedContent">
      <div class="cthulhuUiDropdownPopupDetailedItems">
        {#each items as item (item.id)}
          {#if itemDragOptions}
            {#if itemDragOptions.getRowDroppableOptions}
              <PromptDropTarget
                getOptions={() => itemDragOptions.getRowDroppableOptions!(item)}
                class="cthulhuUiDropdownPopupDetailedRowDropTarget"
              >
                {#snippet children({ isOver })}
                  {@render draggableItem(item, close, isOver)}
                {/snippet}
              </PromptDropTarget>
            {:else}
              {@render draggableItem(item, close, false)}
            {/if}
          {:else}
            <SelectorButton
              icon={item.icon}
              text={item.label}
              detail={item.detail}
              detailParts={item.detailParts}
              showChevron={false}
              selected={selectedItem?.id === item.id}
              rowState={getItemRowState(item, false)}
              role="menuitem"
              ariaSelected={selectedItem?.id === item.id}
              testId={item.testId}
              class="cthulhuUiDropdownPopupDetailedItem"
              onclick={(event) => selectItem(item, event, close)}
            />
          {/if}
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
            rowState={getItemRowState(footerItem, false)}
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

  :global(.cthulhuUiDropdownPopupDetailedDragTarget) {
    flex: 0 0 auto;
    position: relative;
  }

  :global(.cthulhuUiDropdownPopupDetailedRowDropTarget) {
    flex: 0 0 auto;
  }

  :global(.cthulhuUiDropdownPopupDetailedDragItem .cthulhuUiSelectorButtonLeadingCell) {
    cursor: grab;
  }

  :global(.cthulhuUiDropdownPopupDetailedDragItem:active .cthulhuUiSelectorButtonLeadingCell) {
    cursor: grabbing;
  }

  :global(.cthulhuUiDropdownPopupDetailedFooterItem[data-row-state='idle']:hover),
  :global(.cthulhuUiDropdownPopupDetailedFooterItem[data-row-state='active']:hover),
  :global(.cthulhuUiDropdownPopupDetailedFooterItem[data-selected='true']) {
    background-color: var(--ui-accent-action-hover-fill);
  }
</style>
