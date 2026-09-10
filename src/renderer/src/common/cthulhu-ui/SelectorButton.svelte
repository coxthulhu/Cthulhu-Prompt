<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import { ChevronDown, ChevronUp } from 'lucide-svelte'
  import IconCell from './IconCell.svelte'
  import { mergeClasses } from './mergeClasses'
  import SeparatorDot from './SeparatorDot.svelte'

  type SelectorButtonState = 'enabled' | 'disabled'
  export type SelectorButtonSelectionVariant = 'neutral' | 'accent'
  export type SelectorButtonRowState =
    | 'idle'
    | 'active'
    | 'drag-idle'
    | 'drag-active'
    | 'dragging'
    | 'over'
    | 'blocked-over'
  export type SelectorButtonDetailPart =
    | string
    | {
        text: string
        icon?: ComponentType
        testId?: string
      }
  type SelectorButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    text: string
    detail?: string
    detailParts?: SelectorButtonDetailPart[]
    open?: boolean
    selected?: boolean
    rowState?: SelectorButtonRowState
    selectionVariant?: SelectorButtonSelectionVariant
    showChevron?: boolean
    state?: SelectorButtonState
    class?: string
    iconClass?: string
    leadingAccessory?: Snippet
    leadingAccessoryTestId?: string
    trailingAccessory?: Snippet
    testId?: string
    role?: string
    ariaHaspopup?: 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
    ariaExpanded?: boolean
    ariaPressed?: boolean
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
    rowState = 'idle',
    selectionVariant = 'neutral',
    showChevron = true,
    state = 'enabled',
    class: className,
    iconClass,
    leadingAccessory,
    leadingAccessoryTestId,
    trailingAccessory,
    testId,
    role,
    ariaHaspopup,
    ariaExpanded,
    ariaPressed,
    ariaSelected,
    buttonAction = null,
    buttonActionParameter,
    onclick
  }: Props = $props()

  const isDisabled = $derived(state === 'disabled')
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
  const resolvedDetailParts = $derived(
    (detailParts?.length ? detailParts : detail ? [detail] : []).map((detailPart) =>
      typeof detailPart === 'string' ? { text: detailPart } : detailPart
    )
  )
  const detailTitle = $derived(
    resolvedDetailParts.map((detailPart) => detailPart.text).join(' \u00b7 ')
  )
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  type="button"
  class={mergeClasses('cthulhuUiSelectorButton', className)}
  data-open={open ? 'true' : 'false'}
  data-selected={selected ? 'true' : 'false'}
  data-row-state={rowState}
  data-selection-variant={selectionVariant}
  data-chevron={showChevron ? 'true' : 'false'}
  data-leading-accessory={leadingAccessory ? 'true' : 'false'}
  data-trailing-accessory={trailingAccessory ? 'true' : 'false'}
  data-disabled={isDisabled ? 'true' : 'false'}
  data-testid={testId}
  disabled={isDisabled}
  {role}
  aria-haspopup={ariaHaspopup}
  aria-expanded={ariaExpanded ?? (showChevron ? open : undefined)}
  aria-pressed={ariaPressed}
  aria-selected={ariaSelected}
  {onclick}
>
  <!-- Compact dropdown trigger matching the sidebar selector layout. -->
  {#if leadingAccessory}
    <span class="cthulhuUiSelectorButtonLeadingCell" data-testid={leadingAccessoryTestId}>
      {@render leadingAccessory()}
    </span>
  {/if}

  <IconCell
    icon={Icon}
    {iconClass}
    variant="compact"
    class="cthulhuUiSelectorButtonIconCell"
  />

  <span class="cthulhuUiSelectorButtonTextStack">
    <span class="cthulhuUiSelectorButtonText text-sm leading-5">{text}</span>
    {#if resolvedDetailParts.length}
      <!-- Button details are explicitly excluded from default line heights to retain their spacing. -->
      <span class="cthulhuUiSelectorButtonDetail text-xs leading-4.5" title={detailTitle}>
        {#each resolvedDetailParts as detailPart, index (`${index}-${detailPart}`)}
          {#if index > 0}
            <SeparatorDot />
          {/if}
          <span class="cthulhuUiSelectorButtonDetailText" data-testid={detailPart.testId}>
            {#if detailPart.icon}
              {@const DetailIcon = detailPart.icon}
              <DetailIcon class="cthulhuUiSelectorButtonDetailIcon" size={10} aria-hidden="true" />
            {/if}
            {detailPart.text}
          </span>
        {/each}
      </span>
    {/if}
  </span>

  {#if trailingAccessory}
    <span class="cthulhuUiSelectorButtonTrailingAccessory">
      {@render trailingAccessory()}
    </span>
  {:else if showChevron}
    <span class="cthulhuUiSelectorButtonChevronWrap cthulhuUiSelectorButtonChevron">
      {#if open}
        <ChevronUp size={20} aria-hidden="true" />
      {:else}
        <ChevronDown size={20} aria-hidden="true" />
      {/if}
    </span>
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
    column-gap: 0;
    grid-template-columns: 34px 8px minmax(0, 1fr) 22px;
    min-width: 0;
    padding: 8px;
    text-align: left;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-standard) ease,
      color var(--ui-animation-duration-standard) ease;
    width: 100%;
  }

  .cthulhuUiSelectorButton[data-chevron='false'][data-trailing-accessory='false'] {
    grid-template-columns: 34px 8px minmax(0, 1fr);
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true'] {
    grid-template-columns: 22px 8px 34px 8px minmax(0, 1fr) 22px;
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true'][data-chevron='false'][data-trailing-accessory='false'] {
    grid-template-columns: 22px 8px 34px 8px minmax(0, 1fr);
  }

  .cthulhuUiSelectorButton:where(:not(:disabled)[data-row-state='idle']:hover),
  .cthulhuUiSelectorButton:where(:not(:disabled)[data-row-state='active']:hover),
  .cthulhuUiSelectorButton:where(:not(:disabled):focus-visible) {
    background-color: var(--ui-neutral-action-fill);
  }

  .cthulhuUiSelectorButton[data-open='true'],
  .cthulhuUiSelectorButton[data-selected='true'] {
    background-color: var(--ui-neutral-action-hover-fill);
  }

  .cthulhuUiSelectorButton[data-row-state='active'],
  .cthulhuUiSelectorButton[data-row-state='drag-active'] {
    background-color: var(--ui-neutral-action-hover-fill);
  }

  .cthulhuUiSelectorButton[data-row-state='dragging'],
  .cthulhuUiSelectorButton[data-row-state='over'] {
    background-color: var(--ui-info-normal-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiSelectorButton[data-row-state='blocked-over'] {
    background-color: var(--ui-neutral-emphasis-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiSelectorButton[data-selection-variant='accent'] {
    border: 1px solid var(--ui-ghost-surface);
  }

  .cthulhuUiSelectorButton[data-selection-variant='accent'][data-chevron='true'] {
    padding: 7px;
  }

  .cthulhuUiSelectorButton[data-selection-variant='accent'][data-open='true'] {
    border-color: var(--ui-neutral-hover-border);
  }

  .cthulhuUiSelectorButton[data-selection-variant='accent']:where(
      [data-open='false'][data-row-state='idle']:hover,
      [data-open='false'][data-row-state='idle']:focus-visible
    ) {
    background-color: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
  }

  .cthulhuUiSelectorButton[data-selection-variant='accent']:where(
      [data-row-state='active'],
      [data-row-state='drag-active']
    ) {
    background-color: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-muted-border);
  }

  .cthulhuUiSelectorButton[data-selection-variant='accent']:where(
      [data-row-state='active']:hover,
      [data-row-state='active']:focus-visible
    ) {
    background-color: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
  }

  .cthulhuUiSelectorButton[data-selection-variant='accent'][data-row-state='dragging'] {
    background-color: var(--ui-info-normal-surface);
    border-color: var(--ui-info-muted-border);
  }

  .cthulhuUiSelectorButton[data-selection-variant='accent'][data-row-state='over'] {
    background-color: var(--ui-info-hover-surface);
    border-color: var(--ui-info-muted-hover-border);
  }

  .cthulhuUiSelectorButton[data-selection-variant='accent'][data-row-state='blocked-over'] {
    background-color: var(--ui-neutral-emphasis-surface);
    border-color: var(--ui-neutral-emphasis-border);
  }

  .cthulhuUiSelectorButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiSelectorButton :global(.cthulhuUiSelectorButtonIconCell) {
    grid-column: 1;
  }

  .cthulhuUiSelectorButtonLeadingCell {
    align-items: center;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    grid-column: 1;
    height: 34px;
    justify-content: center;
    width: 22px;
  }

  .cthulhuUiSelectorButtonTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    grid-column: 3;
    min-width: 0;
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true']
    :global(.cthulhuUiSelectorButtonIconCell) {
    grid-column: 3;
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true'] .cthulhuUiSelectorButtonTextStack {
    grid-column: 5;
  }

  .cthulhuUiSelectorButtonText,
  .cthulhuUiSelectorButtonDetail {
    min-width: 0;
    overflow: hidden;
  }

  .cthulhuUiSelectorButtonText {
    color: inherit;
    display: block;
    font-weight: var(--font-weight-semibold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiSelectorButtonDetail {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    gap: 6px;
  }

  .cthulhuUiSelectorButtonDetailText {
    align-items: center;
    display: inline-flex;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiSelectorButtonDetailText :global(.cthulhuUiSelectorButtonDetailIcon) {
    flex: 0 0 auto;
  }

  .cthulhuUiSelectorButton :global(.cthulhuUiSelectorButtonChevronWrap) {
    color: var(--ui-normal-text);
    grid-column: 4;
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true']
    :global(.cthulhuUiSelectorButtonChevronWrap) {
    grid-column: 6;
  }

  .cthulhuUiSelectorButtonChevron {
    align-items: center;
    display: flex;
    height: 22px;
    justify-content: center;
    width: 22px;
  }

  .cthulhuUiSelectorButtonTrailingAccessory {
    align-items: center;
    display: flex;
    grid-column: 4;
    height: 22px;
    justify-content: center;
    width: 22px;
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true']
    .cthulhuUiSelectorButtonTrailingAccessory {
    grid-column: 6;
  }
</style>
