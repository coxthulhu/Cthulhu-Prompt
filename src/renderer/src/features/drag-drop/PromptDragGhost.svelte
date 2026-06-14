<script lang="ts">
  let { title }: { title: string } = $props()
</script>

<div class="promptDragGhost">
  <div
    class="sidebarPromptTreeSettingsButton promptDragGhostButton"
    data-row-state="idle"
  >
    <span class="sidebarPromptTreeSettingsLabel">{title}</span>
  </div>
</div>
