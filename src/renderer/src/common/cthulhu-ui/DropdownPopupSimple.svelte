<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import DropdownPopupCore, {
    type DropdownPopupPlacement,
    type DropdownPopupTriggerContext
  } from './DropdownPopupCore.svelte'

  export type DropdownPopupItemVariant = 'neutral' | 'accent' | 'danger'

  export type DropdownPopupItem = {
    id: string
    label: string
    icon: ComponentType
    testId?: string
    variant?: DropdownPopupItemVariant
  }

  type Props = {
    label: string
    items: DropdownPopupItem[]
    trigger: Snippet<[DropdownPopupTriggerContext]>
    menuWidth?: string
    testId?: string
    placement?: DropdownPopupPlacement
    dragOpenTypes?: string[]
    onselect?: (item: DropdownPopupItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    trigger,
    menuWidth = '236px',
    testId,
    placement = 'cursor',
    dragOpenTypes,
    onselect
  }: Props = $props()
</script>

<DropdownPopupCore
  {label}
  {trigger}
  {menuWidth}
  {testId}
  {placement}
  {dragOpenTypes}
  menuClass="cthulhuUiDropdownPopupSimpleMenu p-[6px]"
>
  {#snippet children({ close })}
    <div class="cthulhuUiDropdownPopupSimpleItems">
      {#each items as item (item.id)}
        {@const ItemIcon = item.icon}
        <button
          type="button"
          class="cthulhuUiDropdownPopupSimpleItem"
          role="menuitem"
          data-variant={item.variant ?? 'neutral'}
          data-testid={item.testId}
          onclick={(event) => {
            close()
            onselect?.(item, event)
          }}
        >
          <ItemIcon size={16} aria-hidden="true" />
          <span class="cthulhuUiDropdownPopupSimpleItemLabel">{item.label}</span>
        </button>
      {/each}
    </div>
  {/snippet}
</DropdownPopupCore>

<style>
  .cthulhuUiDropdownPopupSimpleItems {
    display: grid;
  }

  .cthulhuUiDropdownPopupSimpleItem {
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-normal-text);

    align-items: center;
    background: var(--ui-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-normal-text);
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

  .cthulhuUiDropdownPopupSimpleItem[data-variant='accent'] {
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-normal-text);

    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupSimpleItem[data-variant='danger'] {
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-normal-text);

    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupSimpleItem:hover {
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-normal-text);

    background: var(--ui-neutral-action-fill);
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupSimpleItem[data-variant='accent']:hover {
    background: var(--ui-accent-action-hover-fill);
  }

  .cthulhuUiDropdownPopupSimpleItem[data-variant='danger']:hover {
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-normal-text);

    background: var(--ui-danger-action-hover-fill);
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupSimpleItem > :global(svg) {
    color: var(--cthulhu-ui-dropdown-popup-item-icon-color);
  }

  .cthulhuUiDropdownPopupSimpleItemLabel {
    font-size: 13px;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }
</style>
