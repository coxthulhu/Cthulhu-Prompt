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
    matchTriggerWidth?: boolean
    onselect?: (item: DropdownPopupItem, event: MouseEvent) => void
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
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-hoverable-icon-glyph);

    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-text);
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
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-accent-normal-text);

    color: var(--ui-accent-normal-text);
  }

  .cthulhuUiDropdownPopupSimpleItem[data-variant='danger'] {
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-danger-icon-glyph);

    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiDropdownPopupSimpleItem:hover {
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-normal-text);

    background: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupSimpleItem[data-variant='accent']:hover {
    background: var(--ui-accent-hover-surface);
  }

  .cthulhuUiDropdownPopupSimpleItem[data-variant='danger']:hover {
    --cthulhu-ui-dropdown-popup-item-icon-color: var(--ui-danger-icon-glyph);

    background: var(--ui-danger-hover-surface);
    color: var(--ui-danger-icon-glyph);
  }

  .cthulhuUiDropdownPopupSimpleItem > :global(svg) {
    color: var(--cthulhu-ui-dropdown-popup-item-icon-color);
  }

  .cthulhuUiDropdownPopupSimpleItemLabel {
    font-size: 13px;
    line-height: 1.25;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
