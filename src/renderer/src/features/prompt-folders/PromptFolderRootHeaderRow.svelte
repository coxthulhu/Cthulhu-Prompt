<script module lang="ts">
  export const PROMPT_FOLDER_ROOT_HEADER_ROW_HEIGHT_PX = 158
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
  <header class="prompt-folder-root-screen-header">
    <div class="prompt-folder-root-title-block">
      <div class="prompt-folder-root-eyebrow">
        <Folder size={14} aria-hidden="true" />
        <span>Prompt folder</span>
      </div>
      <div class="prompt-folder-root-title-line">
        <h1 title={folderDisplayName}>{folderDisplayName}</h1>
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
  </header>

  <nav class="prompt-folder-root-filter-bar" aria-label="Filter prompts">
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
  </nav>
</div>

<style>
  .prompt-folder-root-header-row {
    box-sizing: border-box;
    min-width: 0;
    padding: 24px 24px 18px;
  }

  .prompt-folder-root-screen-header {
    align-items: end;
    display: flex;
    gap: 16px;
    justify-content: space-between;
    margin-bottom: 18px;
    min-width: 0;
  }

  .prompt-folder-root-title-block {
    min-width: 0;
  }

  .prompt-folder-root-eyebrow {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 12px;
    gap: 6px;
    line-height: 17px;
  }

  .prompt-folder-root-title-line {
    align-items: center;
    display: flex;
    gap: 7px;
    margin-top: 7px;
    min-width: 0;
  }

  .prompt-folder-root-title-line h1 {
    font-size: 27px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 32px;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-folder-root-filter-bar {
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    display: flex;
    gap: 6px;
  }

  .prompt-folder-root-filter-bar button {
    background: var(--ui-ghost-surface);
    border: 0;
    border-bottom: 2px solid transparent;
    color: var(--ui-muted-text);
    cursor: pointer;
    font-family: inherit;
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
