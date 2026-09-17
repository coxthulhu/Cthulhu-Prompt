<script lang="ts" generics="T extends string">
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Item = {
    id: T
    label: string
    count?: number
    testId?: string
  }

  type Props = {
    label: string
    items: readonly Item[]
    selectedId: T
    class?: string
    testId?: string
    onselect?: (id: T) => void
  }

  let { label, items, selectedId, class: className, testId, onselect }: Props = $props()
</script>

<div
  class={mergeClasses('cthulhuUiButtonBarSelector', className)}
  role="group"
  aria-label={label}
  data-testid={testId}
>
  {#each items as item (item.id)}
    <button
      class="cthulhuUiButtonBarSelectorButton text-sm leading-5"
      type="button"
      aria-pressed={selectedId === item.id}
      data-testid={item.testId}
      onclick={() => onselect?.(item.id)}
    >
      <span class="cthulhuUiButtonBarSelectorLabel">
        {item.label}
        {#if item.count !== undefined}
          <span class="cthulhuUiButtonBarSelectorCount text-xs leading-4.5">{item.count}</span>
        {/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .cthulhuUiButtonBarSelector {
    align-items: center;
    background: var(--ui-card-solid-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 10px;
    box-sizing: border-box;
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    height: 44px;
    padding: 4px;
  }

  .cthulhuUiButtonBarSelectorButton {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 1px solid var(--ui-ghost-surface);
    border-radius: 6px;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: flex;
    font-family: inherit;
    height: 34px;
    padding: 0 11px;
  }

  .cthulhuUiButtonBarSelectorLabel {
    align-items: baseline;
    display: flex;
    gap: 8px;
  }

  .cthulhuUiButtonBarSelectorCount {
    margin-left: 4px;
    padding: 2px 6px;
  }

  .cthulhuUiButtonBarSelectorButton:hover,
  .cthulhuUiButtonBarSelectorButton:focus-visible {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiButtonBarSelectorButton[aria-pressed='true'] {
    background: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-muted-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiButtonBarSelectorButton[aria-pressed='true']:hover,
  .cthulhuUiButtonBarSelectorButton[aria-pressed='true']:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
  }

  .cthulhuUiButtonBarSelectorButton:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }
</style>
