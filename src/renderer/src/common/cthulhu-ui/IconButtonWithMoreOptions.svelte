<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { ChevronDown } from 'lucide-svelte'
  import DropdownPopupMoreOptions from './DropdownPopupMoreOptions.svelte'
  import type { DropdownPopupDetailedItem } from './DropdownPopupDetailed.svelte'
  import type { DropdownPopupMenuAlignment } from './DropdownPopupCore.svelte'
  import IconButton, {
    type IconButtonBaseVariant,
    type IconButtonHoverVariant,
    type IconButtonSize
  } from './IconButton.svelte'
  import { mergeClasses } from './mergeClasses'

  type IconButtonAction = Action<HTMLButtonElement, unknown>

  type Props = {
    icon: ComponentType
    label: string
    moreOptions: DropdownPopupDetailedItem[]
    size?: IconButtonSize
    baseVariant?: IconButtonBaseVariant
    hoverVariant?: IconButtonHoverVariant
    class?: string
    iconClass?: string
    iconTestId?: string
    testId?: string
    moreOptionsTestId?: string
    menuTestId?: string
    title?: string
    disabled?: boolean
    active?: boolean
    buttonAction?: IconButtonAction | null
    buttonActionParameter?: unknown
    menuWidth?: string
    menuAlignment?: DropdownPopupMenuAlignment
    onclick?: (event: MouseEvent) => void
    onselect?: (item: DropdownPopupDetailedItem, event: MouseEvent) => void
  }

  let {
    icon,
    label,
    moreOptions,
    size = 'default',
    baseVariant = 'normal',
    hoverVariant = 'neutral',
    class: className,
    iconClass,
    iconTestId,
    testId,
    moreOptionsTestId,
    menuTestId,
    title,
    disabled,
    active,
    buttonAction,
    buttonActionParameter,
    menuWidth,
    menuAlignment = 'right',
    onclick,
    onselect
  }: Props = $props()

  const isDisabled = $derived(disabled === true)
  const moreOptionsLabel = $derived(`${label} More Options`)
</script>

<span
  class={mergeClasses('cthulhuUiIconButtonWithMoreOptions', className)}
  data-size={size}
  data-base-variant={baseVariant}
  data-hover-variant={hoverVariant}
  data-disabled={isDisabled ? 'true' : 'false'}
>
  <IconButton
    {icon}
    {label}
    {size}
    {baseVariant}
    {hoverVariant}
    {iconClass}
    {iconTestId}
    {testId}
    {title}
    {disabled}
    {active}
    {buttonAction}
    {buttonActionParameter}
    {onclick}
    class="cthulhuUiIconButtonWithMoreOptionsMain"
  />

  <DropdownPopupMoreOptions
    label={moreOptionsLabel}
    items={moreOptions}
    {menuWidth}
    {menuAlignment}
    testId={menuTestId}
    {onselect}
  >
    {#snippet trigger(dropdown)}
      <IconButton
        icon={ChevronDown}
        label={moreOptionsLabel}
        title="More Options"
        {size}
        {baseVariant}
        {hoverVariant}
        disabled={isDisabled}
        active={dropdown.open}
        ariaHaspopup={dropdown.ariaHaspopup}
        ariaExpanded={dropdown.ariaExpanded}
        buttonAction={dropdown.triggerAction}
        onclick={dropdown.toggle}
        testId={moreOptionsTestId}
        class="cthulhuUiIconButtonWithMoreOptionsChevron"
      />
    {/snippet}
  </DropdownPopupMoreOptions>
</span>

<style>
  .cthulhuUiIconButtonWithMoreOptions {
    align-items: center;
    background: var(--ui-ghost-surface);
    border-radius: var(--cthulhu-ui-radius-control);
    display: inline-flex;
    gap: 0;
    min-width: 0;
    outline: 1px solid var(--ui-neutral-normal-border);
    overflow: hidden;
  }

  .cthulhuUiIconButtonWithMoreOptions :global(.cthulhuUiIconButton) {
    /* The compound control owns the outer border and internal divider. */
    background: var(--ui-ghost-surface);
    border: 0;
    border-radius: 0;
    box-sizing: content-box;
  }

  .cthulhuUiIconButtonWithMoreOptions :global(.cthulhuUiIconButton:hover),
  .cthulhuUiIconButtonWithMoreOptions :global(.cthulhuUiIconButton:focus-visible) {
    border-color: var(--ui-neutral-normal-border);
  }

  :global(.cthulhuUiIconButtonWithMoreOptionsMain.cthulhuUiIconButton) {
    border-bottom-left-radius: var(--cthulhu-ui-radius-control);
    border-top-left-radius: var(--cthulhu-ui-radius-control);
  }

  .cthulhuUiIconButtonWithMoreOptions
    :global(.cthulhuUiIconButtonWithMoreOptionsChevron.cthulhuUiIconButton) {
    border-left: 1px solid var(--ui-neutral-normal-border);
    border-bottom-right-radius: var(--cthulhu-ui-radius-control);
    border-top-right-radius: var(--cthulhu-ui-radius-control);
    width: 23px;
  }

  .cthulhuUiIconButtonWithMoreOptions[data-size='compact']
    :global(.cthulhuUiIconButtonWithMoreOptionsChevron.cthulhuUiIconButton) {
    width: 21px;
  }

  .cthulhuUiIconButtonWithMoreOptions[data-size='tiny']
    :global(.cthulhuUiIconButtonWithMoreOptionsChevron.cthulhuUiIconButton) {
    width: 17px;
  }
</style>
