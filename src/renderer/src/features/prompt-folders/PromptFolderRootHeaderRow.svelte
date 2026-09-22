<script module lang="ts">
  /** Shared rendered height and virtualizer estimate for the folder header. */
  export const PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX = 144
</script>

<script lang="ts">
  import { FileText, FolderCog, Layers, Pencil, Trash2 } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/buttons/IconTextButton.svelte'
  import ButtonBarSelector from '@renderer/common/cthulhu-ui/selectors/ButtonBarSelector.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'
  import { promptStatusGroups } from './promptStatusGroups'
  import type { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'

  let {
    folderDisplayName,
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

  /** Template folders expose only the shared Active and Archived filters. */
  const isTemplateFolder = $derived(contentKind === 'template')

  /** Keep displayed filter counts synchronized with the folder's current contents. */
  const statusFilterItems = $derived(
    promptStatusGroups.filter((group) => !isTemplateFolder || group.id === 'active' || group.id === 'archived').map((group) => ({
      id: group.id,
      label: group.label,
      count: statusGroupCounts[group.id],
      testId: `prompt-folder-${group.id}-filter`
    }))
  )
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
      <ButtonBarSelector
        label="Filter prompts"
        items={statusFilterItems}
        selectedId={screenMode}
        onselect={onScreenModeChange}
      />

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
</style>
