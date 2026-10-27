<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { ChevronDown } from 'lucide-svelte'
  import DropdownPopupMoreOptions from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupMoreOptions.svelte'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupDetailed.svelte'
  import type { DropdownPopupMenuAlignment } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupCore.svelte'
  import IconButton, {
    type IconButtonBaseVariant,
    type IconButtonHoverVariant
  } from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import '@renderer/common/cthulhu-ui/layout/segmentedControl.css'

  /** Optional Svelte action attached to the main native button. */
  type IconButtonAction = Action<HTMLButtonElement, unknown>

  /** Main icon action paired with a separately triggered options menu. */
  type Props = {
    icon: ComponentType
    label: string
    moreOptions: DropdownPopupDetailedItem[]
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
    moreOptionsDisabled?: boolean
    active?: boolean
    /** Pressed state exposed by the main action when it toggles something. */
    ariaPressed?: boolean | 'mixed'
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
    moreOptionsDisabled = false,
    active,
    ariaPressed,
    buttonAction,
    buttonActionParameter,
    menuWidth,
    menuAlignment = 'right',
    onclick,
    onselect
  }: Props = $props()

  /** Keeps the options trigger accessible name aligned with the main action. */
  const moreOptionsLabel = $derived(`${label} More Options`)
  /** Disabling the whole split button also disables its options trigger. */
  const isMoreOptionsDisabled = $derived(disabled || moreOptionsDisabled)
</script>

<!-- Both actions share the divider while retaining their own outer hover borders. -->
<span
  class={mergeClasses('cthulhuUiSplitIconButton cthulhuUiSegmentedControl', className)}
  data-base-variant={baseVariant}
>
  <IconButton
    {icon}
    {label}
    {baseVariant}
    hoverVariant={mainHoverVariant}
    {iconClass}
    {iconTestId}
    {testId}
    {title}
    {disabled}
    {active}
    {ariaPressed}
    {buttonAction}
    {buttonActionParameter}
    {onclick}
    class="cthulhuUiSplitIconButtonMain"
  />

  <Separator orientation="vertical" class="cthulhuUiSegmentedControlDivider" />

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
        {baseVariant}
        hoverVariant={moreOptionsHoverVariant}
        disabled={isMoreOptionsDisabled}
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
  .cthulhuUiSplitIconButton
    :global(.cthulhuUiSplitIconButtonChevron.cthulhuUiIconButton) {
    width: 23px;
  }
</style>
