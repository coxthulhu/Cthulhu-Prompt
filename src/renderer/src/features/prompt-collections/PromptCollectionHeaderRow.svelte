<script module lang="ts">
  /** Shared rendered height and virtualizer estimate for the collection header. */
  export const PROMPT_COLLECTION_HEADER_ROW_HEIGHT_PX = 144
</script>

<script lang="ts">
  import PageHeader from '@renderer/common/cthulhu-ui/layout/PageHeader.svelte'
  import { FileText, FolderCog, Layers, Pencil, Trash2 } from 'lucide-svelte'
  import ButtonBar from '@renderer/common/cthulhu-ui/buttons/ButtonBar.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import ToolbarButton from '@renderer/common/cthulhu-ui/buttons/ToolbarButton.svelte'
  import ButtonBarSelector from '@renderer/common/cthulhu-ui/selectors/ButtonBarSelector.svelte'
  import { promptStatusGroups } from './promptStatusGroups'
  import type { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
  import { PromptCollectionScreenMode } from './promptCollectionScreenMode'

  let {
    collectionDisplayName,
    statusGroupCounts,
    contentKind,
    screenMode,
    onDeletePromptCollection,
    onManageCategories,
    onRenamePromptCollection,
    onScreenModeChange
  } = $props<{
    collectionDisplayName: string
    orderedPromptCount: number
    /** Counts displayed beside registered group filters. */
    statusGroupCounts: Record<PromptStatusFolderId, number>
    contentKind: import('@shared/domain/prompt-collection/PromptCollection').PromptCollectionContentKind
    screenMode: PromptCollectionScreenMode
    onDeletePromptCollection: () => void
    onManageCategories: () => void
    onRenamePromptCollection: () => void
    onScreenModeChange: (screenMode: PromptCollectionScreenMode) => void
  }>()

  /** Template collections expose only the shared Active and Archived filters. */
  const isTemplateCollection = $derived(contentKind === 'template')

  /** Keep displayed filter counts synchronized with the collection's current contents. */
  const statusFilterItems = $derived(
    promptStatusGroups.filter((group) => !isTemplateCollection || group.id === 'active' || group.id === 'archived').map((group) => ({
      id: group.id,
      label: group.label,
      count: statusGroupCounts[group.id],
      testId: `prompt-collection-${group.id}-filter`
    }))
  )
</script>

<div
  class="prompt-collection-header-row"
  style={`height:${PROMPT_COLLECTION_HEADER_ROW_HEIGHT_PX}px;`}
  data-testid="prompt-collection-header"
  data-virtual-window-row
>
  <div class="prompt-collection-screen-header">
    <PageHeader
      icon={isTemplateCollection ? Layers : FileText}
      title={collectionDisplayName}
      titleTooltip={collectionDisplayName}
      titleTestId="prompt-collection-title"
      subtitle={isTemplateCollection ? 'Prompt Templates' : 'Task Prompts'}
      subtitleTestId="prompt-collection-subtitle"
    >
      {#snippet titleAction()}
        <IconButton
          icon={Pencil}
          label="Rename collection"
          title="Rename collection"
          size="compact-large-icon"
          baseVariant="muted"
          hoverVariant="glyph"
          testId="prompt-collection-title-edit"
          onclick={onRenamePromptCollection}
        />
      {/snippet}
    </PageHeader>
  </div>

  <!-- Keep filters and collection actions aligned within the existing virtual row height. -->
  <div class="prompt-collection-toolbar">
      <ButtonBarSelector
        label="Filter prompts"
        items={statusFilterItems}
        selectedId={screenMode}
        onselect={onScreenModeChange}
      />

    <ButtonBar class="prompt-collection-actions">
      <ToolbarButton
        class="prompt-collection-categories-button"
        icon={FolderCog}
        iconSize={18}
        text="Categories"
        aria-label="Manage categories"
        title="Manage categories"
        borderless
        testId="prompt-collection-manage-categories-button"
        onclick={onManageCategories}
      />
      <span class="prompt-collection-action-divider" aria-hidden="true"></span>
      <IconButton
        class="prompt-collection-delete-button"
        icon={Trash2}
        label="Delete collection"
        title="Delete collection"
        borderless
        hoverVariant="danger"
        testId="prompt-collection-delete-button"
        onclick={onDeletePromptCollection}
      />
    </ButtonBar>
  </div>
</div>

<style>
  .prompt-collection-header-row {
    display: grid;
    gap: 18px;
    grid-template-rows: 60px 44px;
    min-width: 0;
    padding: 16px 0 6px;
  }

  .prompt-collection-screen-header {
    align-items: end;
    display: flex;
    gap: 16px;
    height: 60px;
    justify-content: space-between;
    min-width: 0;
    padding-inline: 24px;
  }

  .prompt-collection-toolbar {
    align-items: center;
    display: flex;
    gap: 16px;
    justify-content: space-between;
    min-width: 0;
    padding-inline: 24px;
  }

  .prompt-collection-toolbar :global(.prompt-collection-categories-button) {
    gap: 8px;
    height: 34px;
    padding-inline: 12px;
  }

  .prompt-collection-toolbar :global(.prompt-collection-delete-button) {
    height: 34px;
    width: 34px;
  }

  .prompt-collection-action-divider {
    background: var(--ui-neutral-normal-border);
    height: 20px;
    margin-inline: 3px;
    width: 1px;
  }
</style>
