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
    --cthulhu-ui-icon-button-more-options-hover-fill: var(--ui-neutral-action-hover-fill);

    align-items: center;
    background: var(--ui-ghost-surface);
    border-radius: var(--cthulhu-ui-radius-control);
    display: inline-flex;
    gap: 0;
    min-width: 0;
    outline: 1px solid var(--ui-neutral-normal-border);
    transition: background-color 120ms ease;
  }

  .cthulhuUiIconButtonWithMoreOptions[data-hover-variant='accent'] {
    --cthulhu-ui-icon-button-more-options-hover-fill: var(--ui-accent-action-hover-fill);
  }

  .cthulhuUiIconButtonWithMoreOptions[data-hover-variant='success'] {
    --cthulhu-ui-icon-button-more-options-hover-fill: var(--ui-success-action-hover-fill);
  }

  .cthulhuUiIconButtonWithMoreOptions[data-hover-variant='danger'] {
    --cthulhu-ui-icon-button-more-options-hover-fill: var(--ui-danger-action-hover-fill);
  }

  .cthulhuUiIconButtonWithMoreOptions[data-hover-variant='glyph'] {
    --cthulhu-ui-icon-button-more-options-hover-fill: var(--ui-ghost-surface);
  }

  .cthulhuUiIconButtonWithMoreOptions:hover,
  .cthulhuUiIconButtonWithMoreOptions:has(:global(.cthulhuUiIconButton:focus-visible)),
  .cthulhuUiIconButtonWithMoreOptions:has(
      :global(.cthulhuUiIconButtonWithMoreOptionsMain[data-active='true'])
    ),
  .cthulhuUiIconButtonWithMoreOptions:has(
      :global(.cthulhuUiIconButtonWithMoreOptionsChevron[data-active='true'])
    ) {
    background: var(--cthulhu-ui-icon-button-more-options-hover-fill);
  }

  .cthulhuUiIconButtonWithMoreOptions :global(.cthulhuUiIconButton) {
    background: var(--ui-ghost-surface);
    border-radius: 0;
  }

  .cthulhuUiIconButtonWithMoreOptions :global(.cthulhuUiIconButton:hover),
  .cthulhuUiIconButtonWithMoreOptions :global(.cthulhuUiIconButton:focus-visible),
  .cthulhuUiIconButtonWithMoreOptions :global(.cthulhuUiIconButton[data-active='true']) {
    background: var(--ui-ghost-surface);
  }

  :global(.cthulhuUiIconButtonWithMoreOptionsChevron.cthulhuUiIconButton) {
    border-left: 1px solid var(--ui-neutral-normal-border);
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

  .cthulhuUiIconButtonWithMoreOptions[data-base-variant='dim']:hover
    :global(.cthulhuUiIconButton:not([data-disabled='true'])),
  .cthulhuUiIconButtonWithMoreOptions[data-base-variant='dim']:has(
      :global(.cthulhuUiIconButton:focus-visible)
    )
    :global(.cthulhuUiIconButton:not([data-disabled='true'])) {
    color: var(--ui-hoverable-icon-glyph);
  }
</style>
