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
  data-disabled={isDisabled ? 'true' : 'false'}
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
    class="cthulhuUiIconButtonWithMoreOptionsMain"
  />

  <span class="cthulhuUiIconButtonWithMoreOptionsSeparator" aria-hidden="true"></span>

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
    /* The compound control owns the outer border. */
    border: 0;
    border-radius: 0;
    box-sizing: content-box;
  }

  :global(.cthulhuUiIconButtonWithMoreOptionsMain.cthulhuUiIconButton) {
    border-bottom-left-radius: var(--cthulhu-ui-radius-control);
    border-top-left-radius: var(--cthulhu-ui-radius-control);
  }

  .cthulhuUiIconButtonWithMoreOptionsSeparator {
    align-self: stretch;
    background: var(--ui-neutral-normal-border);
    flex: 0 0 1px;
    width: 1px;
  }

  .cthulhuUiIconButtonWithMoreOptions
    :global(.cthulhuUiIconButtonWithMoreOptionsChevron.cthulhuUiIconButton) {
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
