<script module lang="ts">
  export const PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX = 140
</script>

<script lang="ts">
  import { Folder, Pencil, Plus } from 'lucide-svelte'
  import Button from '@renderer/common/cthulhu-ui/Button.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import { PromptFolderScreenMode } from './promptFolderScreenMode'

  let {
    folderDisplayName,
    activePromptCount,
    completedPromptCount,
    screenMode,
    isCreatingPrompt,
    onAddPrompt,
    onRenamePromptFolder,
    onScreenModeChange
  } = $props<{
    folderDisplayName: string
    activePromptCount: number
    completedPromptCount: number
    screenMode: PromptFolderScreenMode
    isCreatingPrompt: boolean
    onAddPrompt: () => void
    onRenamePromptFolder: () => void
    onScreenModeChange: (screenMode: PromptFolderScreenMode) => void
  }>()

  const isCompletedMode = $derived(screenMode === PromptFolderScreenMode.Completed)
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
        <Folder size={14} aria-hidden="true" />
        <span>Prompt folder</span>
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
          label="Rename prompt folder"
          title="Rename prompt folder"
          size="tiny"
          baseVariant="muted"
          hoverVariant="glyph"
          testId="prompt-folder-root-title-edit"
          onclick={onRenamePromptFolder}
        />
      </div>
    </div>

    <Button
      icon={Plus}
      text="New Prompt"
      variant="accent"
      state={isCompletedMode || isCreatingPrompt ? 'disabled' : 'enabled'}
      testId="prompt-folder-new-prompt-button"
      onclick={onAddPrompt}
    />
  </div>

  <div class="prompt-folder-root-filter-bar" role="group" aria-label="Filter prompts">
    <button
      class:active={!isCompletedMode}
      type="button"
      aria-pressed={!isCompletedMode}
      data-testid="prompt-folder-active-filter"
      onclick={() => onScreenModeChange(PromptFolderScreenMode.Active)}
    >
      Todo/In Progress <span>{activePromptCount}</span>
    </button>
    <button
      class:active={isCompletedMode}
      type="button"
      aria-pressed={isCompletedMode}
      data-testid="prompt-folder-completed-filter"
      onclick={() => onScreenModeChange(PromptFolderScreenMode.Completed)}
    >
      Completed <span>{completedPromptCount}</span>
    </button>
  </div>
</div>

<style>
  .prompt-folder-root-header-row {
    box-sizing: border-box;
    display: grid;
    gap: 18px;
    grid-template-rows: 60px 44px;
    min-width: 0;
    padding: 12px 24px 6px;
  }

  .prompt-folder-root-screen-header {
    align-items: end;
    display: flex;
    gap: 16px;
    height: 60px;
    justify-content: space-between;
    min-width: 0;
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
    align-items: center;
    display: flex;
    gap: 7px;
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

  .prompt-folder-root-filter-bar {
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    box-sizing: border-box;
    display: flex;
    gap: 6px;
    height: 44px;
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
    background: var(--ui-neutral-normal-surface);
    border-radius: 999px;
    font-size: 11px;
    margin-left: 4px;
    padding: 2px 6px;
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
