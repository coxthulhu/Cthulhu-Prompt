<script lang="ts">
  import type { ComponentType, Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'
  import RotatingChevron from './RotatingChevron.svelte'
  import SeparatorDot from './SeparatorDot.svelte'

  type SelectorButtonState = 'enabled' | 'disabled'
  export type SelectorButtonRowState =
    | 'idle'
    | 'active'
    | 'drag-idle'
    | 'drag-active'
    | 'dragging'
    | 'over'
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
    rowState = 'idle',
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
  const resolvedDetailParts = $derived(
    (detailParts?.length ? detailParts : detail ? [detail] : []).map((detailPart) =>
      typeof detailPart === 'string' ? { text: detailPart } : detailPart
    )
  )
  const detailTitle = $derived(resolvedDetailParts.map((detailPart) => detailPart.text).join(' \u00b7 '))
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  type="button"
  class={mergeClasses('cthulhuUiSelectorButton', className)}
  data-open={open ? 'true' : 'false'}
  data-selected={selected ? 'true' : 'false'}
  data-row-state={rowState}
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
          <span
            class="cthulhuUiSelectorButtonDetailText"
            data-testid={detailPart.testId}
          >
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
    column-gap: 0;
    grid-template-columns: 34px 8px minmax(0, 1fr) 22px;
    min-width: 0;
    padding: 8px;
    text-align: left;
    transition:
      background-color 120ms ease,
      color 120ms ease;
    width: 100%;
  }

  .cthulhuUiSelectorButton[data-chevron='false'] {
    grid-template-columns: 34px 8px minmax(0, 1fr);
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true'] {
    grid-template-columns: 22px 8px 34px 8px minmax(0, 1fr) 22px;
  }

  .cthulhuUiSelectorButton[data-leading-accessory='true'][data-chevron='false'] {
    grid-template-columns: 22px 8px 34px 8px minmax(0, 1fr);
  }

  .cthulhuUiSelectorButton:not(:disabled)[data-row-state='idle']:hover,
  .cthulhuUiSelectorButton:not(:disabled)[data-row-state='active']:hover,
  .cthulhuUiSelectorButton:not(:disabled):focus-visible,
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
    grid-column: 1;
    height: 34px;
    justify-content: center;
    transition: color 120ms ease;
    width: 34px;
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

  .cthulhuUiSelectorButton[data-leading-accessory='true'] .cthulhuUiSelectorButtonIconCell {
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
</style>
