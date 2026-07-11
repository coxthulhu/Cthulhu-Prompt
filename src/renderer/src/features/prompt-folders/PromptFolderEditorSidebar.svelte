<script lang="ts">
  import { ChevronDown, ChevronUp, GripVertical } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'

  let {
    isFirstSibling,
    isLastSibling
  }: {
    isFirstSibling: boolean
    isLastSibling: boolean
  } = $props()

  const preventSidebarButtonMouseFocus = (event: MouseEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
  }
</script>

<div class="prompt-folder-editor-sidebar" data-testid="prompt-folder-editor-sidebar">
  <IconButton
    icon={ChevronUp}
    label="Move prompt folder up"
    size="sidebar-rail"
    baseVariant="dim"
    class="prompt-folder-editor-sidebar-move-button"
    testId="prompt-folder-move-up"
    disabled={isFirstSibling}
    onclick={() => {}}
    onmousedown={preventSidebarButtonMouseFocus}
  />

  <IconButton
    icon={GripVertical}
    label="Drag prompt folder"
    size="sidebar-rail"
    baseVariant="dim"
    class="prompt-folder-editor-sidebar-drag-button"
    testId="prompt-folder-drag-handle"
    disabled={true}
    tabindex={-1}
    onmousedown={preventSidebarButtonMouseFocus}
  />

  <IconButton
    icon={ChevronDown}
    label="Move prompt folder down"
    size="sidebar-rail"
    baseVariant="dim"
    class="prompt-folder-editor-sidebar-move-button"
    testId="prompt-folder-move-down"
    disabled={isLastSibling}
    onclick={() => {}}
    onmousedown={preventSidebarButtonMouseFocus}
  />
</div>

<style>
  .prompt-folder-editor-sidebar {
    background: var(--ui-card-overlay-surface);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    width: 36px;
  }

  .prompt-folder-editor-sidebar :global(.cthulhuUiIconButton[data-size='sidebar-rail']) {
    border-bottom-color: transparent;
  }

  .prompt-folder-editor-sidebar :global(.prompt-folder-editor-sidebar-move-button) {
    flex: 0 4 40px;
  }

  .prompt-folder-editor-sidebar :global(.prompt-folder-editor-sidebar-drag-button) {
    flex: 1 1 52px;
  }
</style>
