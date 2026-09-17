<script module lang="ts">
  /** Shared rendered height and virtualizer estimate for the folder header. */
  export const PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX = 144
</script>

<script lang="ts">
  import { FileText, FolderCog, Layers, Pencil, Trash2 } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/buttons/IconTextButton.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'
  import { promptStatusGroups } from './promptStatusGroups'
  import type { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'

  let {
    folderDisplayName,
    orderedPromptCount,
    statusGroupCounts,
    contentKind,
    screenMode,
    onDeletePromptFolder,
    onManageCategories,
    onRenamePromptFolder,
    onScreenModeChange
  } = $props<{
    folderDisplayName: string
    orderedPromptCount: number
    /** Counts displayed beside registered group filters. */
    statusGroupCounts: Record<PromptStatusFolderId, number>
    contentKind: import('@shared/domain/prompt-folder/PromptFolder').PromptFolderContentKind
    screenMode: PromptFolderScreenMode
    onDeletePromptFolder: () => void
    onManageCategories: () => void
    onRenamePromptFolder: () => void
    onScreenModeChange: (screenMode: PromptFolderScreenMode) => void
  }>()

  /** Template folders show a single Templates entry instead of status filters. */
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
      <IconCell icon={isTemplateFolder ? Layers : FileText} variant="title" />
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
            size="compact-large-icon"
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
  </div>

  <!-- Keep filters and folder actions aligned within the existing virtual row height. -->
  <div class="prompt-folder-root-toolbar">
    <div
      class="prompt-folder-root-filter-bar"
      role="group"
      aria-label={isTemplateFolder ? 'Templates' : 'Filter prompts'}
    >
      {#if isTemplateFolder}
        <button class="text-sm leading-5" type="button" aria-pressed="true" data-testid="prompt-folder-template-filter">
          Templates <span class="text-xs leading-4.5">{orderedPromptCount}</span>
        </button>
      {:else}
        {#each promptStatusGroups as group (group.id)}
          <button
            class="text-sm leading-5"
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
    <div class="prompt-folder-root-actions">
      <IconTextButton
        class="prompt-folder-root-categories-button"
        icon={FolderCog}
        iconSize={18}
        text="Categories"
        aria-label="Manage categories"
        title="Manage categories"
        borderless
        testId="prompt-folder-manage-categories-button"
        onclick={onManageCategories}
      />
      <span class="prompt-folder-root-action-divider" aria-hidden="true"></span>
      <IconButton
        class="prompt-folder-root-delete-button"
        icon={Trash2}
        label="Delete folder"
        title="Delete folder"
        borderless
        hoverVariant="danger"
        testId="prompt-folder-delete-button"
        onclick={onDeletePromptFolder}
      />
    </div>
  </div>
</div>

<style>
  .prompt-folder-root-header-row {
    box-sizing: border-box;
    display: grid;
    gap: 18px;
    grid-template-rows: 60px 44px;
    min-width: 0;
    padding: 16px 0 6px;
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

  .prompt-folder-root-toolbar {
    align-items: center;
    display: flex;
    gap: 16px;
    justify-content: space-between;
    min-width: 0;
    padding-inline: 24px;
  }

  .prompt-folder-root-filter-bar,
  .prompt-folder-root-actions {
    align-items: center;
    background: var(--ui-card-solid-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 10px;
    box-sizing: border-box;
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    height: 44px;
    padding: 4px;
  }

  .prompt-folder-root-actions :global(.prompt-folder-root-categories-button) {
    gap: 8px;
    height: 34px;
    padding-inline: 12px;
  }

  .prompt-folder-root-actions :global(.prompt-folder-root-delete-button) {
    height: 34px;
    width: 34px;
  }

  .prompt-folder-root-action-divider {
    background: var(--ui-neutral-normal-border);
    height: 20px;
    margin-inline: 3px;
    width: 1px;
  }

  .prompt-folder-root-filter-bar button {
    align-items: center;
    background: var(--ui-ghost-surface);
    border: 1px solid var(--ui-ghost-surface);
    border-radius: 6px;
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: flex;
    font-family: inherit;
    gap: 8px;
    height: 34px;
    padding: 0 11px;
  }

  /* Filter button counts are explicitly excluded from default line heights. */
  .prompt-folder-root-filter-bar button span {
    margin-left: 4px;
    padding: 2px 6px;
  }

  .prompt-folder-root-filter-bar button:hover,
  .prompt-folder-root-filter-bar button:focus-visible {
    background: var(--ui-neutral-action-fill);
    border-color: var(--ui-neutral-hover-border);
    color: var(--ui-normal-text);
  }

  .prompt-folder-root-filter-bar button[aria-pressed='true'] {
    background: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-muted-border);
    color: var(--ui-normal-text);
  }

  .prompt-folder-root-filter-bar button[aria-pressed='true']:hover,
  .prompt-folder-root-filter-bar button[aria-pressed='true']:focus-visible {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-muted-hover-border);
  }

  .prompt-folder-root-filter-bar button:focus-visible {
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }
</style>
