<script lang="ts">
  import { FileText, Folder } from 'lucide-svelte'
  import type { PromptDragGhostKind } from './promptDragGhost'

  // The ghost kind selects the same leading icon shown by the corresponding editor.
  let { title, kind }: { title: string; kind: PromptDragGhostKind } = $props()
</script>

<div class="promptDragGhost">
  <div class="sidebarPromptTreeSettingsButton promptDragGhostButton" data-row-state="idle">
    {#if kind === 'category'}
      <Folder
        class="promptDragGhostIcon"
        size={16}
        data-testid="drag-ghost-icon"
        aria-hidden="true"
      />
    {:else}
      <FileText
        class="promptDragGhostIcon"
        size={16}
        data-testid="drag-ghost-icon"
        aria-hidden="true"
      />
    {/if}
    <span class="sidebarPromptTreeSettingsLabel">{title}</span>
  </div>
</div>
