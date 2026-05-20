<script lang="ts">
  import { FileText } from 'lucide-svelte'

  let { title }: { title: string } = $props()
</script>

<div class="promptDragGhost">
  <div
    class="sidebarPromptTreeSettingsButton promptDragGhostButton"
    data-active="false"
    data-dragging="false"
  >
    <FileText class="sidebarPromptTreeSettingsIcon" aria-hidden="true" />
    <span class="sidebarPromptTreeSettingsLabel">{title}</span>
  </div>
</div>
