<script lang="ts">
  let { title }: { title: string } = $props()
</script>

<div class="promptDragGhost">
  <div
    class="sidebarPromptTreeSettingsButton promptDragGhostButton"
    data-active="false"
    data-dragging="false"
  >
    <span class="sidebarPromptTreeSettingsLabel">{title}</span>
  </div>
</div>
