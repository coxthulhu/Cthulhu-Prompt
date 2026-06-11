<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'
  import FlatRotatingChevron from './FlatRotatingChevron.svelte'
  import FlatSeparatorDot from './FlatSeparatorDot.svelte'

  type FlatSelectorButtonSize = 'compact' | 'large'
  type FlatSelectorButtonState = 'enabled' | 'disabled'
  type FlatSelectorButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    text: string
    detail?: string
    detailParts?: string[]
    open?: boolean
    selected?: boolean
    showChevron?: boolean
    size?: FlatSelectorButtonSize
    state?: FlatSelectorButtonState
    class?: string
    iconClass?: string
    testId?: string
    role?: string
    ariaHaspopup?: 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
    ariaExpanded?: boolean
    ariaSelected?: boolean
    buttonAction?: FlatSelectorButtonAction | null
    buttonActionParameter?: unknown
    onclick?: (event: MouseEvent) => void
  }

  const noopButtonAction: FlatSelectorButtonAction = () => undefined

  let {
    icon: Icon,
    text,
    detail,
    detailParts,
    open = false,
    selected = false,
    showChevron = true,
    size = 'compact',
    state = 'enabled',
    class: className,
    iconClass,
    testId,
    role,
    ariaHaspopup,
    ariaExpanded,
    ariaSelected,
    buttonAction = null,
    buttonActionParameter,
    onclick
  }: Props = $props()

  const iconSize = $derived(size === 'large' ? 24 : 20)
  const chevronSize = $derived(size === 'large' ? 24 : 20)
  const isDisabled = $derived(state === 'disabled')
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
  const resolvedDetailParts = $derived(detailParts?.length ? detailParts : detail ? [detail] : [])
  const detailTitle = $derived(resolvedDetailParts.join(' \u00b7 '))
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  type="button"
  class={mergeClasses('cthulhuUiFlatSelectorButton', className)}
  data-size={size}
  data-open={open ? 'true' : 'false'}
  data-selected={selected ? 'true' : 'false'}
  data-chevron={showChevron ? 'true' : 'false'}
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
  <span class="cthulhuUiFlatSelectorButtonIconCell">
    <Icon
      class={mergeClasses('cthulhuUiFlatSelectorButtonIcon', iconClass)}
      size={iconSize}
      aria-hidden="true"
    />
  </span>

  <span class="cthulhuUiFlatSelectorButtonTextStack">
    <span class="cthulhuUiFlatSelectorButtonText">{text}</span>
    {#if resolvedDetailParts.length}
      <span class="cthulhuUiFlatSelectorButtonDetail" title={detailTitle}>
        {#each resolvedDetailParts as detailPart, index (`${index}-${detailPart}`)}
          {#if index > 0}
            <FlatSeparatorDot />
          {/if}
          <span class="cthulhuUiFlatSelectorButtonDetailText">{detailPart}</span>
        {/each}
      </span>
    {/if}
  </span>

  {#if showChevron}
    <FlatRotatingChevron
      expanded={open}
      size={22}
      iconSize={chevronSize}
      class="cthulhuUiFlatSelectorButtonChevronWrap"
    />
  {/if}
</button>

<style>
  .cthulhuUiFlatSelectorButton {
    align-items: center;
    background-color: var(--ui-flat-ghost-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-flat-normal-text);
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

  .cthulhuUiFlatSelectorButton[data-chevron='false'] {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .cthulhuUiFlatSelectorButton[data-size='large'] {
    gap: 12px;
  }

  .cthulhuUiFlatSelectorButton:not(:disabled):hover,
  .cthulhuUiFlatSelectorButton:not(:disabled):focus-visible,
  .cthulhuUiFlatSelectorButton[data-open='true'],
  .cthulhuUiFlatSelectorButton[data-selected='true'] {
    background-color: var(--ui-flat-neutral-action-hover-fill);
  }

  .cthulhuUiFlatSelectorButton[data-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
  }

  .cthulhuUiFlatSelectorButtonIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-flat-normal-text);
    display: flex;
    height: 34px;
    justify-content: center;
    transition: color 120ms ease;
    width: 34px;
  }

  .cthulhuUiFlatSelectorButtonTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiFlatSelectorButtonText,
  .cthulhuUiFlatSelectorButtonDetail {
    min-width: 0;
    overflow: hidden;
  }

  .cthulhuUiFlatSelectorButtonText {
    color: inherit;
    display: block;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiFlatSelectorButton[data-size='large'] .cthulhuUiFlatSelectorButtonText {
    font-size: var(--cthulhu-ui-font-size-flat-primary);
  }

  .cthulhuUiFlatSelectorButtonDetail {
    align-items: center;
    color: var(--ui-flat-normal-text);
    display: flex;
    font-size: 12px;
    gap: 6px;
  }

  .cthulhuUiFlatSelectorButton[data-size='large'] .cthulhuUiFlatSelectorButtonDetail {
    font-size: 13px;
  }

  .cthulhuUiFlatSelectorButtonDetailText {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiFlatSelectorButton :global(.cthulhuUiFlatSelectorButtonChevronWrap) {
    color: var(--ui-flat-normal-text);
  }

</style>
