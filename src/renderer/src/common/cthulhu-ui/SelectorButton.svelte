<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'
  import RotatingChevron from './RotatingChevron.svelte'
  import SeparatorDot from './SeparatorDot.svelte'

  type SelectorButtonState = 'enabled' | 'disabled'
  type SelectorButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    text: string
    detail?: string
    detailParts?: string[]
    open?: boolean
    selected?: boolean
    dragging?: boolean
    over?: boolean
    showChevron?: boolean
    state?: SelectorButtonState
    class?: string
    iconClass?: string
    leadingAccessory?: Snippet
    leadingAccessoryTestId?: string
    testId?: string
    role?: string
    ariaHaspopup?: 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
    ariaExpanded?: boolean
    ariaSelected?: boolean
    buttonAction?: SelectorButtonAction | null
    buttonActionParameter?: unknown
    onclick?: (event: MouseEvent) => void
  }

  const noopButtonAction: SelectorButtonAction = () => undefined

  let {
    icon: Icon,
    text,
    detail,
    detailParts,
    open = false,
    selected = false,
    dragging = false,
    over = false,
    showChevron = true,
    state = 'enabled',
    class: className,
    iconClass,
    leadingAccessory,
    leadingAccessoryTestId,
    testId,
    role,
    ariaHaspopup,
    ariaExpanded,
    ariaSelected,
    buttonAction = null,
    buttonActionParameter,
    onclick
  }: Props = $props()

  const isDisabled = $derived(state === 'disabled')
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
  const resolvedDetailParts = $derived(detailParts?.length ? detailParts : detail ? [detail] : [])
  const detailTitle = $derived(resolvedDetailParts.join(' \u00b7 '))
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  type="button"
  class={mergeClasses('cthulhuUiSelectorButton', className)}
  data-open={open ? 'true' : 'false'}
  data-selected={selected ? 'true' : 'false'}
  data-dragging={dragging ? 'true' : 'false'}
  data-over={over ? 'true' : 'false'}
  data-chevron={showChevron ? 'true' : 'false'}
  data-leading-accessory={leadingAccessory ? 'true' : 'false'}
  data-disabled={isDisabled ? 'true' : 'false'}
  data-testid={testId}
  disabled={isDisabled}
  {role}
  aria-haspopup={ariaHaspopup}
  aria-expanded={ariaExpanded ?? (showChevron ? open : undefined)}
  aria-selected={ariaSelected}
  {onclick}
>
  <!-- Compact dropdown trigger matching the sidebar selector layout. -->
  {#if leadingAccessory}
    <span class="cthulhuUiSelectorButtonLeadingCell" data-testid={leadingAccessoryTestId}>
      {@render leadingAccessory()}
    </span>
  {/if}

  <span class="cthulhuUiSelectorButtonIconCell">
    <Icon class={iconClass} size={20} aria-hidden="true" />
  </span>

  <span class="cthulhuUiSelectorButtonTextStack">
    <span class="cthulhuUiSelectorButtonText">{text}</span>
    {#if resolvedDetailParts.length}
      <span class="cthulhuUiSelectorButtonDetail" title={detailTitle}>
        {#each resolvedDetailParts as detailPart, index (`${index}-${detailPart}`)}
          {#if index > 0}
            <SeparatorDot />
          {/if}
          <span class="cthulhuUiSelectorButtonDetailText">{detailPart}</span>
        {/each}
      </span>
    {/if}
  </span>

  {#if showChevron}
    <RotatingChevron
      expanded={open}
      size={22}
      iconSize={20}
      class="cthulhuUiSelectorButtonChevronWrap"
    />
  {/if}
</button>

<style>
  .cthulhuUiSelectorButton {
    align-items: center;
    background-color: var(--ui-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-normal-text);
    cursor: pointer;
    display: grid;
    gap: 8px;
    grid-template-columns: 34px minmax(0, 1fr) 22px;
    min-width: 0;
    padding: 8px;
    text-align: left;
    transition:
      background-color 120ms ease,
      color 120ms ease;
    width: 100%;
  }

  .cthulhuUiSelectorButton[data-chevron='false'] {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true'] {
    grid-template-columns: 22px 34px minmax(0, 1fr) 22px;
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true'][data-chevron='false'] {
    grid-template-columns: 22px 34px minmax(0, 1fr);
  }

  .cthulhuUiSelectorButton:not(:disabled):hover,
  .cthulhuUiSelectorButton:not(:disabled):focus-visible,
  .cthulhuUiSelectorButton[data-open='true'],
  .cthulhuUiSelectorButton[data-selected='true'] {
    background-color: var(--ui-neutral-action-hover-fill);
  }

  .cthulhuUiSelectorButton[data-dragging='true'],
  .cthulhuUiSelectorButton[data-over='true'] {
    background-color: var(--ui-info-normal-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiSelectorButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiSelectorButtonIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-normal-text);
    display: flex;
    height: 34px;
    justify-content: center;
    transition: color 120ms ease;
    width: 34px;
  }

  .cthulhuUiSelectorButtonLeadingCell {
    align-items: center;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    height: 34px;
    justify-content: center;
    width: 22px;
  }

  .cthulhuUiSelectorButtonTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiSelectorButtonText,
  .cthulhuUiSelectorButtonDetail {
    min-width: 0;
    overflow: hidden;
  }

  .cthulhuUiSelectorButtonText {
    color: inherit;
    display: block;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiSelectorButtonDetail {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 12px;
    gap: 6px;
  }

  .cthulhuUiSelectorButtonDetailText {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiSelectorButton :global(.cthulhuUiSelectorButtonChevronWrap) {
    color: var(--ui-normal-text);
  }

</style>
