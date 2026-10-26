<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import DropdownPopupCore, {
    type DropdownPopupMenuAlignment,
    type DropdownPopupPlacement,
    type DropdownPopupTriggerContext
  } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupCore.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupDetailed.svelte'
  import SeparatorDot from '@renderer/common/cthulhu-ui/layout/SeparatorDot.svelte'

  type DetailPart = {
    text: string
    icon?: ComponentType
    testId?: string
  }

  type Props = {
    label: string
    items: DropdownPopupDetailedItem[]
    trigger: Snippet<[DropdownPopupTriggerContext]>
    menuWidth?: string
    testId?: string
    placement?: DropdownPopupPlacement
    menuAlignment?: DropdownPopupMenuAlignment
    dragOpenTypes?: string[]
    onselect?: (item: DropdownPopupDetailedItem, event: MouseEvent) => void
  }

  let {
    label,
    items,
    trigger,
    menuWidth = '240px',
    testId,
    placement = 'below-trigger',
    menuAlignment = 'right',
    dragOpenTypes,
    onselect
  }: Props = $props()

  const getDetailParts = (item: DropdownPopupDetailedItem): DetailPart[] =>
    (item.detailParts?.length ? item.detailParts : item.detail ? [item.detail] : []).map(
      (detailPart) => (typeof detailPart === 'string' ? { text: detailPart } : detailPart)
    )
</script>

<DropdownPopupCore
  {label}
  {trigger}
  {menuWidth}
  {testId}
  {placement}
  {menuAlignment}
  {dragOpenTypes}
  menuClass="cthulhuUiDropdownPopupMoreOptionsMenu p-[4px]"
>
  {#snippet children({ close })}
    <div class="cthulhuUiDropdownPopupMoreOptionsItems">
      {#each items as item (item.id)}
        {@const ItemIcon = item.icon}
        {@const detailParts = getDetailParts(item)}
        <button
          type="button"
          class="cthulhuUiDropdownPopupItem cthulhuUiDropdownPopupMoreOptionsItem"
          role="menuitem"
          data-testid={item.testId}
          onclick={(event) => {
            close()
            onselect?.(item, event)
          }}
        >
          <IconCell
            icon={ItemIcon}
            iconClass={item.iconClass}
            variant="menu"
            class="cthulhuUiDropdownPopupMoreOptionsIcon"
          />

          <span class="cthulhuUiDropdownPopupMoreOptionsTextStack">
            <!-- Menu button titles are explicitly excluded from default line heights. -->
            <span class="cthulhuUiDropdownPopupMoreOptionsTitle truncate text-sm leading-4.5">{item.label}</span>
            {#if detailParts.length}
              <span
                class="cthulhuUiDropdownPopupMoreOptionsSubtitle text-xs leading-4"
                title={detailParts.map((detailPart) => detailPart.text).join(' / ')}
              >
                {#each detailParts as detailPart, index (index)}
                  {#if index > 0}
                    <SeparatorDot />
                  {/if}
                  <span
                    class="cthulhuUiDropdownPopupMoreOptionsSubtitlePart min-w-0 truncate"
                    data-testid={detailPart.testId}
                  >
                    {#if detailPart.icon}
                      {@const DetailIcon = detailPart.icon}
                      <DetailIcon
                        class="cthulhuUiDropdownPopupMoreOptionsSubtitleIcon"
                        size={10}
                        aria-hidden="true"
                      />
                    {/if}
                    {detailPart.text}
                  </span>
                {/each}
              </span>
            {/if}
          </span>
        </button>
      {/each}
    </div>
  {/snippet}
</DropdownPopupCore>

<style>
  :global(.cthulhuUiDropdownPopupMoreOptionsMenu) {
    overflow: hidden;
  }

  .cthulhuUiDropdownPopupMoreOptionsItems {
    display: grid;
    gap: 1px;
  }

  .cthulhuUiDropdownPopupMoreOptionsItem {
    grid-template-columns: 28px minmax(0, 1fr);
    min-height: 50px;
    padding: 6px 8px;
  }

  .cthulhuUiDropdownPopupMoreOptionsItem:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: -2px;
  }

  .cthulhuUiDropdownPopupMoreOptionsItem
    :global(.cthulhuUiDropdownPopupMoreOptionsIcon) {
    color: var(--ui-hoverable-icon-glyph);
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .cthulhuUiDropdownPopupMoreOptionsItem:where(:hover, :focus-visible)
    :global(.cthulhuUiDropdownPopupMoreOptionsIcon) {
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupMoreOptionsTextStack {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiDropdownPopupMoreOptionsTitle {
    font-weight: var(--font-weight-semibold);
  }

  .cthulhuUiDropdownPopupMoreOptionsSubtitle {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .cthulhuUiDropdownPopupMoreOptionsItem:where(:hover, :focus-visible)
    .cthulhuUiDropdownPopupMoreOptionsSubtitle {
    color: var(--ui-normal-text);
  }

  .cthulhuUiDropdownPopupMoreOptionsSubtitlePart {
    align-items: center;
    display: inline-flex;
    gap: 4px;
  }

  .cthulhuUiDropdownPopupMoreOptionsSubtitlePart
    :global(.cthulhuUiDropdownPopupMoreOptionsSubtitleIcon) {
    flex: 0 0 auto;
  }
</style>
