<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import { flip } from 'svelte/animate'
  import { ChevronRight, GripVertical } from 'lucide-svelte'
  import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
  import {
    draggable,
    type DraggableOptions,
    type DroppableOptions
  } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import DropTarget from '@renderer/common/drag-drop/DropTarget.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import DropdownPopupCore, {
    type DropdownPopupPlacement,
    type DropdownPopupTriggerContext
  } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupCore.svelte'
  import SelectorButton, {
    type SelectorButtonDetailPart,
    type SelectorButtonRowState,
    type SelectorButtonSelectionVariant
  } from '@renderer/common/cthulhu-ui/selectors/SelectorButton.svelte'

  export type DropdownPopupDetailedItem = {
    id: string
    label: string
    detail?: string
    detailParts?: SelectorButtonDetailPart[]
    icon: ComponentType
    iconClass?: string
    testId?: string
  }

  export type DropdownPopupDetailedItemDragOptions = {
    getDraggableOptions: (item: DropdownPopupDetailedItem, sectionId: string) => DraggableOptions<unknown, unknown>
    getRowDroppableOptions?: (item: DropdownPopupDetailedItem, sectionId: string) => DroppableOptions<unknown, unknown>
    getDragHandleTestId: (item: DropdownPopupDetailedItem, sectionId: string) => string
    isDragging: (item: DropdownPopupDetailedItem, sectionId: string) => boolean
    isDraggingAny: () => boolean
    onItemsElementChange?: (element: HTMLElement | null) => void
  }

  /** Optional labeled groups retain separate row identities and drag boundaries. */
  export type DropdownPopupDetailedSection = {
    /** Stable identity supplied to row actions. */
    id: string
    /** Heading displayed without text transformation. */
    label?: string
    /** Rows in this section's display order. */
    items: DropdownPopupDetailedItem[]
    /** Guidance displayed when the section has no rows. */
    emptyText?: string
  }

  type Props = {
    label: string
    items: DropdownPopupDetailedItem[]
    /** Grouped rows replace the ordinary unsectioned list when supplied. */
    sections?: DropdownPopupDetailedSection[]
    /** Independent action placed to the left of the row selection button. */
    rowAccessory?: Snippet<[DropdownPopupDetailedItem, string]>
    selectedItem: DropdownPopupDetailedItem | null
    trigger: Snippet<[DropdownPopupTriggerContext]>
    footerItem?: DropdownPopupDetailedItem
    menuWidth?: string
    testId?: string
    placement?: DropdownPopupPlacement
    dragOpenTypes?: string[]
    itemDragOptions?: DropdownPopupDetailedItemDragOptions
    itemSelectionVariant?: SelectorButtonSelectionVariant
    showSelectedItemChevron?: boolean
    onselect?: (item: DropdownPopupDetailedItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    sections,
    rowAccessory,
    selectedItem,
    trigger,
    footerItem,
    menuWidth = '320px',
    testId,
    placement = 'cursor',
    dragOpenTypes,
    itemDragOptions,
    itemSelectionVariant = 'neutral',
    showSelectedItemChevron = true,
    onselect
  }: Props = $props()

  const draggableButtonAction = draggable as unknown as Action<HTMLButtonElement, unknown>

  /** Existing flat dropdowns keep a single unlabeled group. */
  const itemSections = $derived<DropdownPopupDetailedSection[]>(sections ?? [{ id: 'all', items }])

  const getItemRowState = (
    item: DropdownPopupDetailedItem,
    isRowDropOver: boolean,
    isDropBlocked = false,
    sectionId = 'all'
  ): SelectorButtonRowState => {
    const isDraggingAny = itemDragOptions?.isDraggingAny() ?? false

    if (isRowDropOver) return isDropBlocked ? 'blocked-over' : 'over'
    if (itemDragOptions?.isDragging(item, sectionId)) return 'dragging'
    if (selectedItem?.id === item.id) return isDraggingAny ? 'drag-active' : 'active'
    return isDraggingAny ? 'drag-idle' : 'idle'
  }

  const selectItem = (item: DropdownPopupDetailedItem, event: MouseEvent, close: () => void) => {
    close()
    onselect?.(item, event)
  }

  const itemsElementAction: Action<HTMLDivElement> = (node) => {
    itemDragOptions?.onItemsElementChange?.(node)

    return {
      destroy() {
        itemDragOptions?.onItemsElementChange?.(null)
      }
    }
  }
</script>

{#snippet selectedItemChevron()}
  <ChevronRight
    size={14}
    class="text-[var(--ui-secondary-icon-glyph)]"
    aria-hidden="true"
  />
{/snippet}

{#snippet draggableItem(
  item: DropdownPopupDetailedItem,
  sectionId: string,
  close: () => void,
  isRowDropOver: boolean,
  isDropBlocked = false
)}
  <SelectorButton
    icon={item.icon}
    iconClass={item.iconClass}
    text={item.label}
    detail={item.detail}
    detailParts={item.detailParts}
    showChevron={false}
    selected={selectedItem?.id === item.id}
    rowState={getItemRowState(item, isRowDropOver, isDropBlocked, sectionId)}
    selectionVariant={itemSelectionVariant}
    role="menuitem"
    ariaSelected={selectedItem?.id === item.id}
    testId={item.testId}
    leadingAccessoryTestId={itemDragOptions!.getDragHandleTestId(item, sectionId)}
    buttonAction={draggableButtonAction}
    buttonActionParameter={itemDragOptions!.getDraggableOptions(item, sectionId)}
    trailingAccessory={showSelectedItemChevron && selectedItem?.id === item.id
      ? selectedItemChevron
      : undefined}
    class="cthulhuUiDropdownPopupDetailedItem cthulhuUiDropdownPopupDetailedDragItem"
    onclick={(event) => selectItem(item, event, close)}
  >
    {#snippet leadingAccessory()}
      <GripVertical size={16} aria-hidden="true" />
    {/snippet}
  </SelectorButton>
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
      <div
        use:itemsElementAction
        class="cthulhuUiDropdownPopupDetailedItems"
        data-pointer-drag-owner
        data-testid={testId ? `${testId}-items` : undefined}
      >
        {#each itemSections as section (section.id)}
          {#if section.label}
            <div class="cthulhuUiDropdownPopupDetailedSectionHeader text-sm leading-5" role="presentation">
              {section.label}
              <Separator class="flex-1" />
            </div>
          {/if}
          <div class="cthulhuUiDropdownPopupDetailedSection" data-dropdown-section={section.id}>
            {#each section.items as item (item.id)}
              <div
                class="cthulhuUiDropdownPopupDetailedAnimatedItem"
                animate:flip={{ duration: uiAnimationDurationMs.standard }}
              >
                {@render rowAccessory?.(item, section.id)}
                {#if itemDragOptions}
                  {#if itemDragOptions.getRowDroppableOptions}
                    <DropTarget
                      getOptions={() => itemDragOptions.getRowDroppableOptions!(item, section.id)}
                      class="cthulhuUiDropdownPopupDetailedRowDropTarget"
                    >
                      {#snippet children({ isOver, isBlocked })}
                        {@render draggableItem(item, section.id, close, isOver, isBlocked)}
                      {/snippet}
                    </DropTarget>
                  {:else}
                    {@render draggableItem(item, section.id, close, false)}
                  {/if}
                {:else}
                  <SelectorButton
                    icon={item.icon}
                    iconClass={item.iconClass}
                    text={item.label}
                    detail={item.detail}
                    detailParts={item.detailParts}
                    showChevron={false}
                    selected={selectedItem?.id === item.id}
                    rowState={getItemRowState(item, false)}
                    selectionVariant={itemSelectionVariant}
                    role="menuitem"
                    ariaSelected={selectedItem?.id === item.id}
                    testId={item.testId}
                    trailingAccessory={showSelectedItemChevron && selectedItem?.id === item.id
                      ? selectedItemChevron
                      : undefined}
                    class="cthulhuUiDropdownPopupDetailedItem"
                    onclick={(event) => selectItem(item, event, close)}
                  />
                {/if}
              </div>
            {:else}
              {#if section.emptyText}
                <p class="cthulhuUiDropdownPopupDetailedEmpty text-sm leading-5">{section.emptyText}</p>
              {/if}
            {/each}
          </div>
        {/each}
      </div>

      {#if footerItem}
        <div class="cthulhuUiDropdownPopupDetailedFooter">
          <SelectorButton
            icon={footerItem.icon}
            iconClass={footerItem.iconClass}
            text={footerItem.label}
            detail={footerItem.detail}
            detailParts={footerItem.detailParts}
            showChevron={false}
            selected={selectedItem?.id === footerItem.id}
            rowState={getItemRowState(footerItem, false)}
            selectionVariant={itemSelectionVariant}
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
    display: grid;
    flex: 1 1 auto;
    gap: 2px;
    max-height: calc((58px * 8) + (2px * 7));
    min-height: 0;
    overflow-y: auto;
  }

  .cthulhuUiDropdownPopupDetailedSection {
    display: grid;
    gap: 2px;
  }

  .cthulhuUiDropdownPopupDetailedSectionHeader {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0 8px;
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
  }

  .cthulhuUiDropdownPopupDetailedEmpty {
    margin: 0;
    padding: 8px 8px 10px 42px;
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupDetailedAnimatedItem {
    display: flex;
    gap: 4px;
  }

  :global(.cthulhuUiDropdownPopupDetailedRowDropTarget) {
    flex: 1;
    min-width: 0;
  }

  .cthulhuUiDropdownPopupDetailedFooter {
    border-top: 1px solid var(--ui-neutral-muted-border);
    flex-shrink: 0;
    margin: 5px -6px 0;
    padding: 5px 6px 0;
  }

  :global(.cthulhuUiDropdownPopupDetailedItem) {
    flex: 1;
    height: 58px;
  }

  :global(.cthulhuUiDropdownPopupDetailedDragItem .cthulhuUiSelectorButtonLeadingCell) {
    cursor: grab;
  }

  :global(.cthulhuUiDropdownPopupDetailedDragItem:active .cthulhuUiSelectorButtonLeadingCell) {
    cursor: grabbing;
  }

  :global(.cthulhuUiDropdownPopupDetailedFooterItem[data-row-state='idle']:hover),
  :global(.cthulhuUiDropdownPopupDetailedFooterItem[data-row-state='active']:hover),
  :global(.cthulhuUiDropdownPopupDetailedFooterItem:focus-visible),
  :global(.cthulhuUiDropdownPopupDetailedFooterItem[data-selected='true']) {
    background-color: var(--ui-accent-action-hover-fill);
  }

  :global(
    .cthulhuUiDropdownPopupDetailedMenu
      .cthulhuUiDropdownPopupDetailedFooterItem[data-selection-variant='accent']:where(
          :hover,
          :focus-visible,
          [data-selected='true']
        )
  ) {
    border-color: var(--ui-accent-muted-hover-border);
  }
</style>
