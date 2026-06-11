<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import DropdownPopupCore, {
    type DropdownPopupPlacement,
    type DropdownPopupTriggerContext
  } from './DropdownPopupCore.svelte'

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
    matchTriggerWidth?: boolean
    onselect?: (item: FlatDropdownPopupItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    trigger,
    menuWidth = '236px',
    testId,
    placement = 'cursor',
    matchTriggerWidth = false,
    onselect
  }: Props = $props()
</script>

<DropdownPopupCore
  {label}
  {trigger}
  {menuWidth}
  {testId}
  {placement}
  {matchTriggerWidth}
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
</DropdownPopupCore>

<style>
  .cthulhuUiFlatDropdownPopupSimpleItems {
    display: grid;
  }

  .cthulhuUiFlatDropdownPopupSimpleItem {
    --cthulhu-ui-flat-dropdown-popup-item-icon-color: var(--ui-flat-hoverable-icon-glyph);

    align-items: center;
    background: var(--ui-flat-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-flat-hoverable-text);
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
    --cthulhu-ui-flat-dropdown-popup-item-icon-color: var(--ui-flat-accent-normal-text);

    color: var(--ui-flat-accent-normal-text);
  }

  .cthulhuUiFlatDropdownPopupSimpleItem[data-variant='danger'] {
    --cthulhu-ui-flat-dropdown-popup-item-icon-color: var(--ui-flat-danger-icon-glyph);

    color: var(--ui-flat-danger-icon-glyph);
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
    --cthulhu-ui-flat-dropdown-popup-item-icon-color: var(--ui-flat-danger-icon-glyph);

    background: var(--ui-flat-danger-action-hover-fill);
    color: var(--ui-flat-danger-icon-glyph);
  }

  .cthulhuUiFlatDropdownPopupSimpleItem > :global(svg) {
    color: var(--cthulhu-ui-flat-dropdown-popup-item-icon-color);
  }

  .cthulhuUiFlatDropdownPopupSimpleItemLabel {
    font-size: 13px;
    line-height: 1.25;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
