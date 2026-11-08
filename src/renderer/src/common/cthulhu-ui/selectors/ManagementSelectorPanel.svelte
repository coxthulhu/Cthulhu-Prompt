<script lang="ts">
  import { ChevronRight, GripVertical, Plus } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { flip } from 'svelte/animate'
  import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
  import { draggable } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { createListReorder } from '@renderer/common/drag-drop/listReorder.svelte.ts'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import SelectorButton, {
    type SelectorButtonRowState
  } from '@renderer/common/cthulhu-ui/selectors/SelectorButton.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  /** One selectable item rendered by a management dialog's navigation panel. */
  export type ManagementSelectorPanelItem = {
    id: string
    icon: ComponentType
    text: string
    detail: string
  }

  /** Inputs and callbacks for a standard management-dialog selector panel. */
  type Props = {
    label: string
    items: ManagementSelectorPanelItem[]
    selectedId: string | null
    addText: string
    class?: string
    itemTestIdPrefix?: string
    addTestId?: string
    /** Test ID prefix for each row's drag handle, followed by the item ID. */
    dragHandleTestIdPrefix?: string
    onselect: (id: string) => void
    onadd: () => void
    /** Enables drag handles and receives the complete new item order after a drop. */
    onreorder?: (ids: string[]) => void
  }

  /** Reactive selector-panel inputs supplied by the owning management dialog. */
  let {
    label,
    items,
    selectedId,
    addText,
    class: className,
    itemTestIdPrefix,
    addTestId,
    dragHandleTestIdPrefix,
    onselect,
    onadd,
    onreorder
  }: Props = $props()

  /** Row action typed for SelectorButton's generic button action slot. */
  const draggableButtonAction = draggable as unknown as Action<HTMLButtonElement, unknown>
  /** Stationary row list that owns pointer capture while rows reorder. */
  let itemsElement = $state<HTMLElement>()
  /** Live drag reordering shared with the activity bar's project buttons. */
  const reorder = createListReorder({
    dragType: 'management-selector-item',
    getIds: () => items.map((item) => item.id),
    getListElement: () => itemsElement,
    onReorder: (ids) => onreorder!(ids)
  })

  /** Selection and drag state shown by one row, matching the Show All collection dropdown. */
  const getRowState = (id: string): SelectorButtonRowState => {
    if (reorder.draggedId === id) return 'dragging'
    if (selectedId === id) return reorder.draggedId ? 'drag-active' : 'active'
    return reorder.draggedId ? 'drag-idle' : 'idle'
  }
</script>

{#snippet dragHandle()}
  <GripVertical size={16} aria-hidden="true" />
{/snippet}

<!-- Standard left-side selector panel for multi-item management dialogs. -->
<aside
  class={mergeClasses('cthulhuUiManagementSelectorPanel', className)}
  aria-label={label}
>
  <div class="cthulhuUiManagementSelectorPanelHeader">
    <span class="text-sm leading-5">{label}</span>
    <span class="text-xs leading-4">{items.length}</span>
  </div>

  <div bind:this={itemsElement} class="cthulhuUiManagementSelectorPanelItems" data-pointer-drag-owner>
    {#each reorder.sort(items) as item (item.id)}
      <!-- Rows only slide while a drag previews a reorder; other list changes apply instantly. -->
      <div
        class="cthulhuUiManagementSelectorPanelRow"
        animate:flip={{ duration: reorder.draggedId ? uiAnimationDurationMs.standard : 0 }}
      >
        <SelectorButton
          icon={item.icon}
          iconClass="text-[var(--ui-secondary-icon-glyph)]"
          text={item.text}
          detail={item.detail}
          showChevron={false}
          selected={selectedId === item.id}
          rowState={getRowState(item.id)}
          selectionVariant="accent"
          ariaPressed={selectedId === item.id}
          class="cthulhuUiManagementSelectorPanelItem"
          testId={itemTestIdPrefix ? `${itemTestIdPrefix}-${item.id}` : undefined}
          leadingAccessory={onreorder ? dragHandle : undefined}
          leadingAccessoryTestId={dragHandleTestIdPrefix ? `${dragHandleTestIdPrefix}-${item.id}` : undefined}
          buttonAction={onreorder ? draggableButtonAction : null}
          buttonActionParameter={reorder.getDraggableOptions(item.id)}
          onclick={() => onselect(item.id)}
        >
          {#snippet trailingAccessory()}
            {#if selectedId === item.id}
              <ChevronRight
                size={14}
                class="text-[var(--ui-secondary-icon-glyph)]"
                aria-hidden="true"
              />
            {/if}
          {/snippet}
        </SelectorButton>
      </div>
    {/each}
  </div>

  <Button
    icon={Plus}
    text={addText}
    class="cthulhuUiManagementSelectorPanelAdd"
    testId={addTestId}
    onclick={onadd}
  />
</aside>

<style>
  .cthulhuUiManagementSelectorPanel {
    border-right: 1px solid var(--ui-neutral-normal-border);
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 18px 14px 20px 0;
    /* Pressing a row to drag it must not start highlighting text, as in the app sidebar. */
    user-select: none;
    -webkit-user-select: none;
  }

  .cthulhuUiManagementSelectorPanelHeader {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-weight: var(--font-weight-semibold);
    justify-content: space-between;
    padding: 0 10px 14px;
  }

  .cthulhuUiManagementSelectorPanelHeader span:last-child {
    color: var(--ui-muted-text);
    font-weight: var(--font-weight-normal);
  }

  .cthulhuUiManagementSelectorPanelItems {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    overflow: auto;
  }

  .cthulhuUiManagementSelectorPanelRow {
    flex: 0 0 auto;
  }

  :global(.cthulhuUiManagementSelectorPanelItem.cthulhuUiSelectorButton) {
    height: 58px;
  }

  :global(.cthulhuUiManagementSelectorPanelItem .cthulhuUiSelectorButtonLeadingCell) {
    cursor: grab;
  }

  :global(.cthulhuUiManagementSelectorPanelItem:active .cthulhuUiSelectorButtonLeadingCell) {
    cursor: grabbing;
  }

  :global(.cthulhuUiManagementSelectorPanelAdd.cthulhuUiButton) {
    margin-top: 16px;
    width: 100%;
  }
</style>
