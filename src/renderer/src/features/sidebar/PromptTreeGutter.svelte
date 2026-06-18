<script lang="ts">
  let { indentCount = 1 } = $props<{
    indentCount?: number
  }>()

  const indentIndexes = $derived(Array.from({ length: indentCount }, (_, index) => index))
  const gutterStyle = $derived(`--prompt-tree-indent-count:${indentCount};`)
</script>

<div class="sidebarPromptTreeGutter" style={gutterStyle} aria-hidden="true">
  <!-- Prompt-row guide lines stay inside gutter columns so button alignment remains predictable. -->
  {#each indentIndexes as indentIndex (indentIndex)}
    <span class="sidebarPromptTreeGutterLine" style={`--prompt-tree-indent-index:${indentIndex};`}
    ></span>
  {/each}
</div>
