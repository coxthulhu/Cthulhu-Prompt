<script lang="ts">
  import InlineTextButton from '@renderer/common/cthulhu-ui/buttons/InlineTextButton.svelte'
  import PromptTreeGutter from './PromptTreeGutter.svelte'

  /** Inputs for one compact prompt-tree text action with optional branch indentation. */
  type Props = {
    /** Visible action text. */
    text: string
    /** Number of prompt-tree guide levels before the action. */
    indentCount?: number
    /** Whether the rendered guide ends with this row. */
    isLastRow?: boolean
    /** Stable Playwright identity assigned to the action button. */
    testId: string
    /** Click behavior performed by the inline action. */
    onclick: (event: MouseEvent) => void
  }

  let {
    text,
    indentCount = 0,
    isLastRow = false,
    testId,
    onclick
  }: Props = $props()

  /** Shared indentation metrics consumed by the row grid and gutter. */
  const rowStyle = $derived(
    `--prompt-tree-indent-count:${indentCount}; --prompt-tree-indent-width:12px;`
  )
</script>

<!-- Compact action rows align root and nested ghost actions without changing their behavior. -->
<div class="sidebarPromptTreeInlineActionRow" style={rowStyle}>
  {#if indentCount > 0}
    <PromptTreeGutter {indentCount} {isLastRow} />
  {/if}
  <div class="sidebarPromptTreeInlineActionButtonWrap">
    <InlineTextButton
      {text}
      {testId}
      class="sidebarPromptTreeInlineActionButton"
      {onclick}
    />
  </div>
</div>

<style>
  .sidebarPromptTreeInlineActionRow {
    align-items: center;
    display: grid;
    grid-template-columns:
      calc(var(--prompt-tree-indent-width) * var(--prompt-tree-indent-count))
      minmax(0, 1fr);
    height: 24px;
    width: 100%;
  }

  .sidebarPromptTreeInlineActionButtonWrap {
    align-items: center;
    display: flex;
    grid-column: 2;
    height: 22px;
    min-width: 0;
    padding-left: 12px;
  }

  .sidebarPromptTreeInlineActionRow :global(.sidebarPromptTreeGutter) {
    min-height: 22px;
  }

  .sidebarPromptTreeInlineActionRow
    :global(.sidebarPromptTreeInlineActionButton.cthulhuUiInlineTextButton) {
    height: 100%;
    max-width: 100%;
  }
</style>
