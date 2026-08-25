<script module lang="ts">
  export const PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX = 140
</script>

<script lang="ts">
  import { Folder, FolderPlus, Layers, Pencil, Trash2 } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'

  let {
    folderDisplayName,
    activePromptCount,
    completedPromptCount,
    contentKind,
    screenMode,
    onDeletePromptFolder,
    onAddCategory,
    onRenamePromptFolder,
    onScreenModeChange
  } = $props<{
    folderDisplayName: string
    activePromptCount: number
    completedPromptCount: number
    contentKind: import('@shared/PromptFolder').PromptFolderContentKind
    screenMode: PromptFolderScreenMode
    onDeletePromptFolder: () => void
    onAddCategory: () => void
    onRenamePromptFolder: () => void
    onScreenModeChange: (screenMode: PromptFolderScreenMode) => void
  }>()

  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)
  const isTemplateFolder = $derived(contentKind === 'template')
  const folderLabel = $derived(isTemplateFolder ? 'prompt template folder' : 'prompt folder')
</script>

<div
  class="prompt-folder-root-header-row"
  style={`height:${PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX}px;`}
  data-testid="prompt-folder-root-header"
  data-virtual-window-row
>
  <div class="prompt-folder-root-screen-header">
    <div class="prompt-folder-root-title-block">
      <div class="prompt-folder-root-eyebrow">
        {#if isTemplateFolder}
          <Layers size={14} aria-hidden="true" />
          <span>Prompt Template Folder</span>
        {:else}
          <Folder size={14} aria-hidden="true" />
          <span>Prompt Folder</span>
        {/if}
      </div>
      <div class="prompt-folder-root-title-line">
        <div
          class="prompt-folder-root-title"
          data-testid="prompt-folder-root-title"
          title={folderDisplayName}
        >
          {folderDisplayName}
        </div>
        <IconButton
          icon={Pencil}
          label={`Rename ${folderLabel}`}
          title={`Rename ${folderLabel}`}
          size="tiny"
          baseVariant="muted"
          hoverVariant="glyph"
          testId="prompt-folder-root-title-edit"
          onclick={onRenamePromptFolder}
        />
      </div>
    </div>

    <div class="prompt-folder-root-actions">
      <IconButton
        icon={FolderPlus}
        label="Add category"
        title="Add category"
        hoverVariant="accent"
        testId="prompt-folder-add-category-button"
        onclick={onAddCategory}
      />
      <IconButton
        icon={Trash2}
        label={`Delete ${folderLabel}`}
        title={`Delete ${folderLabel}`}
        hoverVariant="danger"
        testId="prompt-folder-delete-button"
        onclick={onDeletePromptFolder}
      />
    </div>
  </div>

  <div
    class="prompt-folder-root-filter-bar"
    role="group"
    aria-label={isTemplateFolder ? 'Templates' : 'Filter prompts'}
  >
    <button
      class:active={isTemplateFolder || !isCompletedMode}
      type="button"
      aria-pressed={isTemplateFolder || !isCompletedMode}
      data-testid="prompt-folder-active-filter"
      onclick={isTemplateFolder
        ? undefined
        : () => onScreenModeChange(PromptFolderScreenMode.Active)}
    >
      {isTemplateFolder ? 'Templates' : 'Active Prompts'} <span>{activePromptCount}</span>
    </button>
    {#if !isTemplateFolder}
      <button
        class:active={isCompletedMode}
        type="button"
        aria-pressed={isCompletedMode}
        data-testid="prompt-folder-completed-filter"
        onclick={() => onScreenModeChange(PromptFolderScreenMode.Completed)}
      >
        Completed <span>{completedPromptCount}</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .prompt-folder-root-header-row {
    box-sizing: border-box;
    display: grid;
    gap: 18px;
    grid-template-rows: 60px 44px;
    min-width: 0;
    padding: 12px 0 6px;
  }

  .prompt-folder-root-screen-header {
    align-items: end;
    display: flex;
    gap: 16px;
    height: 60px;
    justify-content: space-between;
    min-width: 0;
    padding-inline: 24px;
  }

  .prompt-folder-root-title-block {
    height: 60px;
    min-width: 0;
  }

  .prompt-folder-root-eyebrow {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 12px;
    gap: 6px;
    height: 17px;
    line-height: 17px;
  }

  .prompt-folder-root-title-line {
    align-items: baseline;
    display: flex;
    gap: 11px;
    height: 36px;
    margin-top: 7px;
    min-width: 0;
  }

  .prompt-folder-root-title {
    color: var(--ui-normal-text);
    font-size: 27px;
    font-weight: 700;
    height: 36px;
    letter-spacing: -0.03em;
    line-height: 32px;
    min-width: 0;
    overflow: hidden;
    padding-block: 2px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-folder-root-actions {
    align-items: center;
    display: flex;
    gap: 8px;
  }

  .prompt-folder-root-filter-bar {
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    box-sizing: border-box;
    display: flex;
    gap: 6px;
    height: 44px;
    padding-inline: 24px;
  }

  .prompt-folder-root-filter-bar button {
    background: var(--ui-ghost-surface);
    border: 0;
    border-bottom: 2px solid transparent;
    color: var(--ui-muted-text);
    cursor: pointer;
    font-family: inherit;
    height: 44px;
    margin-bottom: -1px;
    padding: 8px 10px 10px;
  }

  .prompt-folder-root-filter-bar button span {
    font-size: 11px;
    margin-left: 4px;
    padding: 2px 6px;
    position: relative;
    top: -1px;
  }

  .prompt-folder-root-filter-bar button.active {
    border-bottom-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
  }

  .prompt-folder-root-filter-bar button:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }
</style>
