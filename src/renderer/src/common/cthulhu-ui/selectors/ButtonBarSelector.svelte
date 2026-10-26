<script lang="ts" generics="T extends string">
  import '@renderer/common/cthulhu-ui/buttons/button.css'
  import ButtonBar from '@renderer/common/cthulhu-ui/buttons/ButtonBar.svelte'
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
    /** Disables every choice in this segmented selector. */
    disabled?: boolean
    class?: string
    testId?: string
    onselect?: (id: T) => void
  }

  let { label, items, selectedId, disabled = false, class: className, testId, onselect }: Props = $props()
</script>

<ButtonBar
  class={mergeClasses('cthulhuUiButtonBarSelector', className)}
  role="group"
  aria-label={label}
  data-testid={testId}
>
  {#each items as item (item.id)}
    <button
      class="cthulhuUiButtonBase cthulhuUiButtonSurface cthulhuUiButtonToggle cthulhuUiButtonBarSelectorButton text-sm leading-5"
      type="button"
      {disabled}
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
</ButtonBar>

<style>
  .cthulhuUiButtonBarSelectorButton {
    display: flex;
    flex: 0 1 auto;
    height: 34px;
    padding: 0 11px;
    transition: none;
  }

  .cthulhuUiButtonBarSelectorButton[aria-pressed='false'] {
    /* Unselected segments reserve a border without displaying it. */
    --cthulhu-ui-button-border: var(--ui-ghost-surface);
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
</style>
