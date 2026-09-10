<script module lang="ts">
  export const PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX = 140
</script>

<script lang="ts">
  import { FileText, FolderPlus, Layers, Pencil, Trash2 } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/Subtitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/TitleSubtitleStack.svelte'
  import { promptStatusGroups } from './promptStatusGroups'
  import type { PromptStatusFolderId } from '@shared/Prompt'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'

  let {
    folderDisplayName,
    orderedPromptCount,
    statusGroupCounts,
    contentKind,
    screenMode,
    onDeletePromptFolder,
    onAddCategory,
    onRenamePromptFolder,
    onScreenModeChange
  } = $props<{
    folderDisplayName: string
    orderedPromptCount: number
    /** Counts displayed beside registered group filters. */
    statusGroupCounts: Record<PromptStatusFolderId, number>
    contentKind: import('@shared/PromptFolder').PromptFolderContentKind
    screenMode: PromptFolderScreenMode
    onDeletePromptFolder: () => void
    onAddCategory: () => void
    onRenamePromptFolder: () => void
    onScreenModeChange: (screenMode: PromptFolderScreenMode) => void
  }>()

  const isTemplateFolder = $derived(contentKind === 'template')
</script>

<div
  class="prompt-folder-root-header-row"
  style={`height:${PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX}px;`}
  data-testid="prompt-folder-root-header"
  data-virtual-window-row
>
  <div class="prompt-folder-root-screen-header">
    <div class="prompt-folder-root-title-block">
      <IconCell icon={isTemplateFolder ? Layers : FileText} size="title" />
      <TitleSubtitleStack class="prompt-folder-root-title-stack">
        <div class="prompt-folder-root-title-line">
          <Title
            class="prompt-folder-root-title text-3xl leading-9"
            data-testid="prompt-folder-root-title"
            title={folderDisplayName}
            tooltip={folderDisplayName}
            variant="row"
          />
          <IconButton
            icon={Pencil}
            label="Rename folder"
            title="Rename folder"
            size="tiny"
            baseVariant="muted"
            hoverVariant="glyph"
            testId="prompt-folder-root-title-edit"
            onclick={onRenamePromptFolder}
          />
        </div>
        <Subtitle
          class="prompt-folder-root-subtitle leading-5"
          text={isTemplateFolder ? 'Prompt Templates' : 'Task Prompts'}
          wrap={false}
        />
      </TitleSubtitleStack>
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
        label="Delete folder"
        title="Delete folder"
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
    {#if isTemplateFolder}
      <button class="active text-base leading-6" type="button" aria-pressed="true" data-testid="prompt-folder-template-filter">
        Templates <span class="text-xs leading-4.5">{orderedPromptCount}</span>
      </button>
    {:else}
      {#each promptStatusGroups as group (group.id)}
        <button
          class="text-base leading-6"
          class:active={screenMode === group.id}
          type="button"
          aria-pressed={screenMode === group.id}
          data-testid={`prompt-folder-${group.id}-filter`}
          onclick={() => onScreenModeChange(group.id)}
        >
          {group.label} <span class="text-xs leading-4.5">{statusGroupCounts[group.id]}</span>
        </button>
      {/each}
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
    align-items: flex-start;
    display: flex;
    gap: 12px;
    height: 60px;
    min-width: 0;
  }

  .prompt-folder-root-title-block :global(.prompt-folder-root-title-stack) {
    gap: 4px;
  }

  .prompt-folder-root-title-line {
    align-items: baseline;
    display: flex;
    gap: 11px;
    height: 36px;
    min-width: 0;
  }

  .prompt-folder-root-title-line :global(.prompt-folder-root-title) {
    color: var(--ui-normal-text);
    font-weight: var(--font-weight-semibold);
    /* Give Windows font glyphs room beyond the 36px line without enlarging the title row. */
    height: 40px;
    margin-block: -2px;
    padding-block: 2px;
    letter-spacing: -0.03em;
    min-width: 0;
    overflow: hidden;
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

  /* Filter button counts are explicitly excluded from default line heights. */
  .prompt-folder-root-filter-bar button span {
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
