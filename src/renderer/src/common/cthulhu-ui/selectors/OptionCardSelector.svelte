<script module lang="ts">
  import type { ComponentType } from 'svelte'

  /** One full-width choice: an icon, a label, and a wrapping description. */
  export type OptionCardSelectorItem<Id extends string = string> = {
    id: Id
    label: string
    description: string
    icon: ComponentType
    testId?: string
  }
</script>

<script lang="ts" generics="T extends string">
  import SelectionIndicator from '@renderer/common/cthulhu-ui/forms/SelectionIndicator.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = {
    /** Accessible name of the choice group. */
    label: string
    items: readonly OptionCardSelectorItem<T>[]
    selectedId: T
    /** Id of help text that describes the choice group. */
    ariaDescribedby?: string
    class?: string
    testId?: string
    onselect?: (id: T) => void
  }

  let { label, items, selectedId, ariaDescribedby, class: className, testId, onselect }: Props = $props()
</script>

<!-- Stacked single-choice cards; each card button carries its pressed state and the radio mark is decorative. -->
<div
  class={mergeClasses('cthulhuUiOptionCardSelector grid gap-2', className)}
  role="group"
  aria-label={label}
  aria-describedby={ariaDescribedby}
  data-testid={testId}
>
  {#each items as item (item.id)}
    {@const ItemIcon = item.icon}
    <button
      type="button"
      class="cthulhuUiOptionCardSelectorOption"
      aria-pressed={selectedId === item.id}
      data-testid={item.testId}
      onclick={() => onselect?.(item.id)}
    >
      <ItemIcon class="cthulhuUiOptionCardSelectorIcon" size={18} aria-hidden="true" />
      <span class="cthulhuUiOptionCardSelectorText">
        <span class="cthulhuUiOptionCardSelectorLabel text-sm leading-5">{item.label}</span>
        <span class="cthulhuUiOptionCardSelectorDescription text-sm">{item.description}</span>
      </span>
      <SelectionIndicator class="cthulhuUiOptionCardSelectorIndicator" control="radio" checked={selectedId === item.id} />
    </button>
  {/each}
</div>

<style>
  /* Icon, text stack, and radio mark sit in one full-width row; the icon and mark align with the label's line. */
  .cthulhuUiOptionCardSelectorOption {
    align-items: start;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-text);
    column-gap: 12px;
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) 17px;
    min-width: 0;
    padding: 11px 14px 12px 12px;
    text-align: left;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .cthulhuUiOptionCardSelectorOption:where(:hover, :focus-visible) {
    background: var(--ui-neutral-subtle-action-hover-fill);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiOptionCardSelectorOption:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  /* Choosing the selected option again does nothing, so it keeps the brighter accent colors while hovered. */
  .cthulhuUiOptionCardSelectorOption[aria-pressed='true'] {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiOptionCardSelectorOption :global(.cthulhuUiOptionCardSelectorIcon) {
    color: var(--ui-hoverable-icon-glyph);
    margin-top: 1px;
  }

  .cthulhuUiOptionCardSelectorOption:where(:hover, :focus-visible, [aria-pressed='true'])
    :global(.cthulhuUiOptionCardSelectorIcon) {
    color: var(--ui-normal-text);
  }

  .cthulhuUiOptionCardSelectorOption :global(.cthulhuUiOptionCardSelectorIndicator) {
    margin-top: 2px;
  }

  .cthulhuUiOptionCardSelectorText {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cthulhuUiOptionCardSelectorLabel {
    font-weight: var(--font-weight-semibold);
  }

  .cthulhuUiOptionCardSelectorDescription {
    color: var(--ui-secondary-text);
    /* Avoids leaving a single word on a description's last line. */
    text-wrap: pretty;
    transition: color var(--ui-animation-duration-fast) ease-out;
  }

  .cthulhuUiOptionCardSelectorOption:where(:hover, :focus-visible, [aria-pressed='true'])
    .cthulhuUiOptionCardSelectorDescription {
    color: var(--ui-hoverable-text);
  }
</style>
