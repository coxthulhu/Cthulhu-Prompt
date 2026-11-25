<script module lang="ts">
  import type { LucideIcon } from '@lucide/svelte'

  /** One choice: a header with an icon and label above a short bullet list. */
  export type OptionCardSelectorItem<Id extends string = string> = {
    id: Id
    label: string
    bullets: readonly string[]
    icon: LucideIcon
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

<!-- Equal-width single-choice cards side by side; each card button carries its pressed state and the radio mark is
     decorative. -->
<div
  class={mergeClasses('cthulhuUiOptionCardSelector grid grid-flow-col auto-cols-fr gap-3', className)}
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
      <span class="cthulhuUiOptionCardSelectorHeader">
        <ItemIcon class="cthulhuUiOptionCardSelectorIcon" size={20} aria-hidden="true" />
        <span class="cthulhuUiOptionCardSelectorLabel text-sm leading-5">{item.label}</span>
        <SelectionIndicator control="radio" checked={selectedId === item.id} />
      </span>
      <span class="cthulhuUiOptionCardSelectorBullets">
        {#each item.bullets as bullet (bullet)}
          <span class="cthulhuUiOptionCardSelectorBullet text-sm leading-5">{bullet}</span>
        {/each}
      </span>
    </button>
  {/each}
</div>

<style>
  /* Grid rows stretch the cards to equal heights: a header row with the icon, label, and radio mark sits above a
     divider and the bullet list. Hover, focus, and selection color only the card border and the header row and leave
     the bullet body clear: gray while hovered or focused, accent while selected. */
  .cthulhuUiOptionCardSelectorOption {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-text);
    display: flex;
    flex-direction: column;
    min-width: 0;
    text-align: left;
    transition:
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .cthulhuUiOptionCardSelectorOption:where(:hover, :focus-visible) {
    border-color: var(--ui-neutral-emphasis-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiOptionCardSelectorOption:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  /* Choosing the selected option again does nothing, so it keeps its accent colors while hovered. */
  .cthulhuUiOptionCardSelectorOption[aria-pressed='true'] {
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
  }

  /* The header's top corners follow the card's inner radius so its tint stays inside the rounded border. */
  .cthulhuUiOptionCardSelectorHeader {
    align-items: center;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    border-radius: calc(var(--cthulhu-ui-radius-control) - 1px) calc(var(--cthulhu-ui-radius-control) - 1px) 0 0;
    display: flex;
    gap: 10px;
    min-width: 0;
    padding: 12px 12px 11px 14px;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      border-color var(--ui-animation-duration-fast) ease-out;
  }

  /* The divider takes the card's border color in each state. */
  .cthulhuUiOptionCardSelectorOption:where(:hover, :focus-visible) .cthulhuUiOptionCardSelectorHeader {
    background: var(--ui-neutral-subtle-action-hover-fill);
    border-bottom-color: var(--ui-neutral-emphasis-border);
  }

  .cthulhuUiOptionCardSelectorOption[aria-pressed='true'] .cthulhuUiOptionCardSelectorHeader {
    background: var(--ui-accent-action-fill);
    border-bottom-color: var(--ui-accent-normal-border);
  }

  .cthulhuUiOptionCardSelectorOption :global(.cthulhuUiOptionCardSelectorIcon) {
    color: var(--ui-hoverable-icon-glyph);
    flex: none;
  }

  .cthulhuUiOptionCardSelectorOption:where(:hover, :focus-visible, [aria-pressed='true'])
    :global(.cthulhuUiOptionCardSelectorIcon) {
    color: var(--ui-normal-text);
  }

  .cthulhuUiOptionCardSelectorLabel {
    flex: 1 1 auto;
    font-weight: var(--font-weight-semibold);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cthulhuUiOptionCardSelectorBullets {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 11px 14px 13px;
  }

  /* Each bullet hangs its wrapped lines past a 4px dot centered on the first line. Bullets and dots keep these colors
     in every state, so only the header brightens. */
  .cthulhuUiOptionCardSelectorBullet {
    color: var(--ui-secondary-text);
    padding-left: 14px;
    position: relative;
    text-wrap: pretty;
  }

  .cthulhuUiOptionCardSelectorBullet::before {
    background: var(--ui-muted-icon-glyph);
    border-radius: 50%;
    content: '';
    height: 4px;
    left: 1px;
    position: absolute;
    top: 8px;
    width: 4px;
  }
</style>
