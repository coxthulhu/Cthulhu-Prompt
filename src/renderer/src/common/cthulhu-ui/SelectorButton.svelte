<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { mergeClasses } from './mergeClasses'
  import RotatingChevron from './RotatingChevron.svelte'

  type SelectorButtonSize = 'compact' | 'large'
  type SelectorButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    text: string
    detail?: string
    open?: boolean
    selected?: boolean
    showChevron?: boolean
    size?: SelectorButtonSize
    class?: string
    iconClass?: string
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
    open = false,
    selected = false,
    showChevron = true,
    size = 'compact',
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
  const resolvedButtonAction = $derived(buttonAction ?? noopButtonAction)
</script>

<button
  use:resolvedButtonAction={buttonActionParameter}
  type="button"
  class={mergeClasses('cthulhuUiSelectorButton', className)}
  data-size={size}
  data-open={open ? 'true' : 'false'}
  data-selected={selected ? 'true' : 'false'}
  data-chevron={showChevron ? 'true' : 'false'}
  data-testid={testId}
  {role}
  aria-haspopup={ariaHaspopup}
  aria-expanded={ariaExpanded ?? (showChevron ? open : undefined)}
  aria-selected={ariaSelected}
  {onclick}
>
  <!-- Compact dropdown trigger matching the sidebar selector layout. -->
  <span class="cthulhuUiSelectorButtonIconCell">
    <Icon
      class={mergeClasses('cthulhuUiSelectorButtonIcon', iconClass)}
      size={iconSize}
      aria-hidden="true"
    />
  </span>

  <span class="cthulhuUiSelectorButtonTextStack">
    <span class="cthulhuUiSelectorButtonText">{text}</span>
    {#if detail}
      <span class="cthulhuUiSelectorButtonDetail">{detail}</span>
    {/if}
  </span>

  {#if showChevron}
    <RotatingChevron
      expanded={open}
      size={22}
      iconSize={chevronSize}
      class="cthulhuUiSelectorButtonChevronWrap"
    />
  {/if}
</button>

<style>
  .cthulhuUiSelectorButton {
    align-items: center;
    background-color: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-text);
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

  .cthulhuUiSelectorButton:hover,
  .cthulhuUiSelectorButton[data-open='true'],
  .cthulhuUiSelectorButton[data-selected='true'] {
    background-color: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiSelectorButtonIconCell {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 34px;
    justify-content: center;
    transition: color 120ms ease;
    width: 34px;
  }

  .cthulhuUiSelectorButton:hover .cthulhuUiSelectorButtonIconCell,
  .cthulhuUiSelectorButton[data-open='true'] .cthulhuUiSelectorButtonIconCell,
  .cthulhuUiSelectorButton[data-selected='true'] .cthulhuUiSelectorButtonIconCell {
    color: var(--ui-normal-text);
  }

  .cthulhuUiSelectorButtonTextStack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiSelectorButtonText,
  .cthulhuUiSelectorButtonDetail {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiSelectorButtonText {
    color: inherit;
    font-size: 14px;
    font-weight: 600;
  }

  .cthulhuUiSelectorButton[data-size='large'] .cthulhuUiSelectorButtonText {
    font-size: 15px;
  }

  .cthulhuUiSelectorButtonDetail {
    color: var(--ui-muted-text);
    font-size: 12px;
  }

  .cthulhuUiSelectorButton[data-size='large'] .cthulhuUiSelectorButtonDetail {
    font-size: 13px;
  }

  .cthulhuUiSelectorButton :global(.cthulhuUiSelectorButtonChevronWrap) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .cthulhuUiSelectorButton:hover :global(.cthulhuUiSelectorButtonChevronWrap),
  .cthulhuUiSelectorButton[data-open='true'] :global(.cthulhuUiSelectorButtonChevronWrap),
  .cthulhuUiSelectorButton[data-selected='true'] :global(.cthulhuUiSelectorButtonChevronWrap) {
    color: var(--ui-normal-text);
  }

</style>
