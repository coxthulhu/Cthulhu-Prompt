<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import FlatDropdownPopupCore, {
    type DropdownPopupPlacement,
    type DropdownPopupTriggerContext
  } from './FlatDropdownPopupCore.svelte'

  export type FlatDropdownPopupItemVariant = 'neutral' | 'accent' | 'danger'

  export type FlatDropdownPopupItem = {
    id: string
    label: string
    icon: ComponentType
    testId?: string
    variant?: FlatDropdownPopupItemVariant
  }

  type Props = {
    label: string
    items: FlatDropdownPopupItem[]
    trigger: Snippet<[DropdownPopupTriggerContext]>
    menuWidth?: string
    testId?: string
    placement?: DropdownPopupPlacement
    onselect?: (item: FlatDropdownPopupItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    trigger,
    menuWidth = '236px',
    testId,
    placement = 'cursor',
    onselect
  }: Props = $props()
</script>

<FlatDropdownPopupCore
  {label}
  {trigger}
  {menuWidth}
  {testId}
  {placement}
  menuClass="cthulhuUiFlatDropdownPopupSimpleMenu p-[6px]"
>
  {#snippet children({ close })}
    <div class="cthulhuUiFlatDropdownPopupSimpleItems">
      {#each items as item (item.id)}
        {@const ItemIcon = item.icon}
        <button
          type="button"
          class="cthulhuUiFlatDropdownPopupSimpleItem"
          role="menuitem"
          data-variant={item.variant ?? 'neutral'}
          data-testid={item.testId}
          onclick={(event) => {
            close()
            onselect?.(item, event)
          }}
        >
          <ItemIcon size={16} aria-hidden="true" />
          <span class="cthulhuUiFlatDropdownPopupSimpleItemLabel">{item.label}</span>
        </button>
      {/each}
    </div>
  {/snippet}
</FlatDropdownPopupCore>

<style>
  .cthulhuUiFlatDropdownPopupSimpleItems {
    display: grid;
  }

  .cthulhuUiFlatDropdownPopupSimpleItem {
    --cthulhu-ui-flat-dropdown-popup-item-icon-color: var(--ui-flat-normal-text);

    align-items: center;
    background: var(--ui-flat-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-flat-normal-text);
    cursor: pointer;
    display: grid;
    gap: 8px;
    grid-template-columns: 18px minmax(0, 1fr);
    min-height: 34px;
    padding: 4px 8px;
    text-align: left;
    transition:
      background-color 120ms ease,
      color 120ms ease;
    width: 100%;
  }

  .cthulhuUiFlatDropdownPopupSimpleItem[data-variant='accent'] {
    --cthulhu-ui-flat-dropdown-popup-item-icon-color: var(--ui-flat-normal-text);

    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatDropdownPopupSimpleItem[data-variant='danger'] {
    --cthulhu-ui-flat-dropdown-popup-item-icon-color: var(--ui-flat-normal-text);

    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatDropdownPopupSimpleItem:hover {
    --cthulhu-ui-flat-dropdown-popup-item-icon-color: var(--ui-flat-normal-text);

    background: var(--ui-flat-neutral-action-hover-fill);
    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatDropdownPopupSimpleItem[data-variant='accent']:hover {
    background: var(--ui-flat-accent-action-hover-fill);
  }

  .cthulhuUiFlatDropdownPopupSimpleItem[data-variant='danger']:hover {
    --cthulhu-ui-flat-dropdown-popup-item-icon-color: var(--ui-flat-normal-text);

    background: var(--ui-flat-danger-action-hover-fill);
    color: var(--ui-flat-normal-text);
  }

  .cthulhuUiFlatDropdownPopupSimpleItem > :global(svg) {
    color: var(--cthulhu-ui-flat-dropdown-popup-item-icon-color);
  }

  .cthulhuUiFlatDropdownPopupSimpleItemLabel {
    font-size: 13px;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
</style>
