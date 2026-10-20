<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { ChevronDown } from 'lucide-svelte'
  import DropdownPopupMoreOptions from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupMoreOptions.svelte'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupDetailed.svelte'
  import type { DropdownPopupMenuAlignment } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupCore.svelte'
  import IconButton, {
    type IconButtonBaseVariant,
    type IconButtonHoverVariant,
    type IconButtonSize
  } from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'

  /** Optional Svelte action attached to the main native button. */
  type IconButtonAction = Action<HTMLButtonElement, unknown>

  /** Main icon action paired with a separately triggered options menu. */
  type Props = {
    icon: ComponentType
    label: string
    moreOptions: DropdownPopupDetailedItem[]
    size?: IconButtonSize
    baseVariant?: IconButtonBaseVariant
    mainHoverVariant?: IconButtonHoverVariant
    moreOptionsHoverVariant?: IconButtonHoverVariant
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

  /** Shared presentation and callbacks for the two split-button actions. */
  let {
    icon,
    label,
    moreOptions,
    size = 'default',
    baseVariant = 'normal',
    mainHoverVariant = 'neutral',
    moreOptionsHoverVariant = 'neutral',
    class: className,
    iconClass,
    iconTestId,
    testId,
    moreOptionsTestId,
    menuTestId,
    title,
    disabled = false,
    active,
    buttonAction,
    buttonActionParameter,
    menuWidth,
    menuAlignment = 'right',
    onclick,
    onselect
  }: Props = $props()

  /** Keeps the options trigger accessible name aligned with the main action. */
  const moreOptionsLabel = $derived(`${label} More Options`)
</script>

<!-- Split action keeps one outer border around two independently operable buttons. -->
<span
  class={mergeClasses('cthulhuUiSplitIconButton', className)}
  data-size={size}
  data-base-variant={baseVariant}
>
  <IconButton
    {icon}
    {label}
    {size}
    {baseVariant}
    hoverVariant={mainHoverVariant}
    {iconClass}
    {iconTestId}
    {testId}
    {title}
    {disabled}
    {active}
    {buttonAction}
    {buttonActionParameter}
    {onclick}
    class="cthulhuUiSplitIconButtonMain"
  />

  <Separator orientation="vertical" class="cthulhuUiSplitIconButtonSeparator" />

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
        hoverVariant={moreOptionsHoverVariant}
        {disabled}
        active={dropdown.open}
        ariaHaspopup={dropdown.ariaHaspopup}
        ariaExpanded={dropdown.ariaExpanded}
        buttonAction={dropdown.triggerAction}
        onclick={dropdown.toggle}
        testId={moreOptionsTestId}
        class="cthulhuUiSplitIconButtonChevron"
      />
    {/snippet}
  </DropdownPopupMoreOptions>
</span>

<style>
  .cthulhuUiSplitIconButton {
    align-items: center;
    background: var(--ui-ghost-surface);
    border-radius: var(--cthulhu-ui-radius-control);
    display: inline-flex;
    min-width: 0;
    outline: 1px solid var(--ui-neutral-normal-border);
    overflow: hidden;
  }

  .cthulhuUiSplitIconButton :global(.cthulhuUiIconButton) {
    /* The compound control owns the outer border. */
    border: 0;
    border-radius: 0;
    box-sizing: content-box;
  }

  :global(.cthulhuUiSplitIconButtonMain.cthulhuUiIconButton) {
    border-bottom-left-radius: var(--cthulhu-ui-radius-control);
    border-top-left-radius: var(--cthulhu-ui-radius-control);
  }

  :global(.cthulhuUiSplitIconButtonSeparator.cthulhuUiSeparator) {
    --cthulhu-ui-separator-color: var(--ui-neutral-normal-border);
    align-self: stretch;
    flex: 0 0 1px;
    height: auto;
  }

  .cthulhuUiSplitIconButton
    :global(.cthulhuUiSplitIconButtonChevron.cthulhuUiIconButton) {
    border-bottom-right-radius: var(--cthulhu-ui-radius-control);
    border-top-right-radius: var(--cthulhu-ui-radius-control);
    width: 23px;
  }

  .cthulhuUiSplitIconButton[data-size='compact']
    :global(.cthulhuUiSplitIconButtonChevron.cthulhuUiIconButton) {
    width: 21px;
  }

  .cthulhuUiSplitIconButton[data-size='tiny']
    :global(.cthulhuUiSplitIconButtonChevron.cthulhuUiIconButton) {
    width: 17px;
  }
</style>
