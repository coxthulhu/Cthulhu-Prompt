<script lang="ts">
  import type { ComponentType } from 'svelte'

  // The leading icon matches the one shown beside the dragged item.
  let { title, icon: Icon }: { title: string; icon: ComponentType } = $props()
</script>

<div class="promptDragGhost">
  <div class="promptDragGhostButton">
    <Icon
      class="promptDragGhostIcon"
      size={16}
      data-testid="drag-ghost-icon"
      aria-hidden="true"
    />
    <span class="sidebarPromptTreeSettingsLabel min-w-0 truncate text-sm">{title}</span>
  </div>
</div>
