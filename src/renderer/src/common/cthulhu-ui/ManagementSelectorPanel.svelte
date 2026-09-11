<script lang="ts">
  import { ChevronRight, Plus } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'
  import Button from './Button.svelte'
  import SelectorButton from './SelectorButton.svelte'
  import { mergeClasses } from './mergeClasses'

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
    onselect: (id: string) => void
    onadd: () => void
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
    onselect,
    onadd
  }: Props = $props()
</script>

<!-- Standard left-side selector panel for multi-item management dialogs. -->
<aside
  class={mergeClasses('cthulhuUiManagementSelectorPanel', className)}
  aria-label={label}
>
  <div class="cthulhuUiManagementSelectorPanelHeader">
    <span class="text-sm leading-5">{label}</span>
    <span class="text-xs leading-4">{items.length}</span>
  </div>

  <div class="cthulhuUiManagementSelectorPanelItems">
    {#each items as item (item.id)}
      <SelectorButton
        icon={item.icon}
        iconClass="text-[var(--ui-secondary-icon-glyph)]"
        text={item.text}
        detail={item.detail}
        showChevron={false}
        selected={selectedId === item.id}
        rowState={selectedId === item.id ? 'active' : 'idle'}
        selectionVariant="accent"
        ariaPressed={selectedId === item.id}
        class="cthulhuUiManagementSelectorPanelItem"
        testId={itemTestIdPrefix ? `${itemTestIdPrefix}-${item.id}` : undefined}
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

  :global(.cthulhuUiManagementSelectorPanelItem.cthulhuUiSelectorButton) {
    flex: 0 0 auto;
    height: 58px;
  }

  :global(.cthulhuUiManagementSelectorPanelAdd.cthulhuUiButton) {
    margin-top: 16px;
    width: 100%;
  }
</style>
