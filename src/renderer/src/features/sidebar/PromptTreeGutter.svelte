<script lang="ts">
  let { indentCount = 1 } = $props<{
    indentCount?: number
  }>()

  const indentIndexes = $derived(Array.from({ length: indentCount }, (_, index) => index))
  const indentBasePx = $derived(indentCount > 0 ? 20 : 0)
  const gutterStyle = $derived(
    `--prompt-tree-indent-count:${indentCount}; --prompt-tree-indent-base:${indentBasePx}px;`
  )
</script>

<div class="sidebarPromptTreeGutter" style={gutterStyle} aria-hidden="true">
  <!-- Prompt-row guide lines stay inside gutter columns so button alignment remains predictable. -->
  {#each indentIndexes as indentIndex (indentIndex)}
    <span class="sidebarPromptTreeGutterLine" style={`--prompt-tree-indent-index:${indentIndex};`}
    ></span>
  {/each}
</div>
