<script lang="ts">
  import {
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    Circle,
    ExternalLink,
    Folder,
    GripHorizontal,
    MoreHorizontal,
    Plus,
    Settings
  } from 'lucide-svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'

  type MockPrompt = { title: string; completed?: boolean; selected?: boolean }

  const recentlyCompleted: MockPrompt[] = [
    { title: 'Audit existing sidebar behavior', completed: true },
    { title: 'Confirm accordion requirements', completed: true },
    { title: 'Review keyboard navigation', completed: true }
  ]
  const releasePrompts: MockPrompt[] = [
    { title: 'Update regression checklist', completed: true },
    { title: 'Prepare release notes', completed: true }
  ]
  const activePrompts: MockPrompt[] = [
    { title: 'Build split prompt tree', selected: true },
    { title: 'Add section resize behavior' },
    { title: 'Persist panel proportions' }
  ]
  const verificationPrompts: MockPrompt[] = [
    { title: 'Test collapsed section states' },
    { title: 'Validate focus order' },
    { title: 'Check narrow sidebar layout' },
    { title: 'Verify prompt selection' }
  ]
</script>

{#snippet IconAction(Icon: typeof Plus, label: string)}
  <button class="icon-action" type="button" aria-label={label} title={label}>
    <Icon size={19} aria-hidden="true" />
  </button>
{/snippet}

{#snippet PromptRow(prompt: MockPrompt, nested = false)}
  <button
    class="prompt-row"
    class:nested
    data-selected={prompt.selected ? 'true' : undefined}
    data-completed={prompt.completed ? 'true' : undefined}
    type="button"
  >
    {#if prompt.completed}
      <Check size={14} strokeWidth={2.4} aria-hidden="true" />
    {:else}
      <Circle size={12} strokeWidth={1.8} aria-hidden="true" />
    {/if}
    <span>{prompt.title}</span>
  </button>
{/snippet}

{#snippet Category(title: string, prompts: MockPrompt[], completed = false)}
  <div class="category-block">
    <button class="category-row" type="button" aria-expanded="true">
      <ChevronDown size={17} aria-hidden="true" />
      <Folder size={15} aria-hidden="true" />
      <span>{title}</span>
      <span class="category-count">{prompts.length}</span>
    </button>
    {#each prompts as prompt (prompt.title)}
      {@render PromptRow({ ...prompt, completed: completed || prompt.completed }, true)}
    {/each}
  </div>
{/snippet}

<main class="sidebar-base-stage" data-testid="accordion-prompt-tree-mockup">
  <aside class="mock-sidebar" aria-label="Cthulhu Prompt sidebar">
    <header class="workspace-header">
      <div class="workspace-icon-cell">
        <img
          src={appIcon}
          alt="Cthulhu Prompt icon"
          title="Made in R'lyeh"
          draggable="false"
          ondragstart={(event) => event.preventDefault()}
        />
      </div>
      <div class="workspace-copy">
        <div class="workspace-title-row">
          <h1>CthulhuPromptPublic</h1>
          <button
            class="workspace-open-button"
            type="button"
            aria-label="Open Workspace Folder"
            title="Open Workspace Folder"
          >
            <ExternalLink size={14} aria-hidden="true" />
          </button>
        </div>
        <p title="C:\Source\PromptApps\CthulhuPromptPublic">
          C:\Source\PromptApps\CthulhuPromptPublic
        </p>
      </div>
    </header>

    <div class="separator"></div>

    <div class="folder-selector-wrap">
      <button class="folder-selector" type="button" aria-label="Folder selector">
        <span class="selector-icon-cell"><Folder size={20} aria-hidden="true" /></span>
        <span class="selector-copy">
          <span class="selector-title">Product Work</span>
          <span class="selector-detail">
            <span>32 prompts</span>
            <span class="separator-dot" aria-hidden="true"></span>
            <span>Updated today</span>
          </span>
        </span>
        <span class="selector-chevron"><ChevronDown size={20} aria-hidden="true" /></span>
      </button>
    </div>

    <div class="separator"></div>

    <div class="prompts-header">
      {@render IconAction(Settings, 'Show Folder Overview')}
      {@render IconAction(ChevronsDownUp, 'Collapse All Categories')}
      {@render IconAction(Plus, 'Add Prompt')}
      {@render IconAction(MoreHorizontal, 'Selected Prompt Folder Actions')}
    </div>

    <div class="accordion-stack">
      <section class="accordion-section completed-section" aria-label="Completed prompts">
        <button class="accordion-header" type="button" aria-expanded="true">
          <span class="accordion-chevron"><ChevronDown size={18} aria-hidden="true" /></span>
          <span class="accordion-icon"><CheckCircle2 size={17} aria-hidden="true" /></span>
          <span class="accordion-title">Completed</span>
          <span class="accordion-count">9</span>
        </button>
        <div class="section-tree completed-tree">
          <div class="section-subheading">Recently completed</div>
          {#each recentlyCompleted as prompt (prompt.title)}
            {@render PromptRow(prompt)}
          {/each}
          {@render Category('Release prep', releasePrompts, true)}
          <div class="tree-bottom-space"></div>
        </div>
      </section>

      <div class="panel-resizer" role="separator" aria-label="Resize prompt sections">
        <span class="resize-grip">
          <GripHorizontal size={18} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>

      <section class="accordion-section active-section" aria-label="Active prompts">
        <button class="accordion-header" type="button" aria-expanded="true">
          <span class="accordion-chevron"><ChevronDown size={18} aria-hidden="true" /></span>
          <span class="accordion-icon"><Circle size={16} strokeWidth={2.2} aria-hidden="true" /></span>
          <span class="accordion-title">Active</span>
          <span class="accordion-count">23</span>
        </button>
        <div class="section-tree active-tree">
          <div class="section-subheading">Uncategorized</div>
          {#each activePrompts as prompt (prompt.title)}
            {@render PromptRow(prompt)}
          {/each}
          {@render Category('Verification', verificationPrompts)}
          <div class="collapsed-category-preview">
            <ChevronRight size={17} aria-hidden="true" />
            <Folder size={15} aria-hidden="true" />
            <span>Follow-up</span>
            <span class="category-count">5</span>
          </div>
          <div class="tree-bottom-space"></div>
        </div>
      </section>
    </div>

    <div class="resize-handle" aria-hidden="true"></div>
  </aside>
</main>

<style>
  .sidebar-base-stage {
    box-sizing: border-box;
    display: flex;
    height: 100%;
    min-height: 640px;
    min-width: 0;
    width: 100%;
  }

  .mock-sidebar {
    background: var(--app-chrome-surface);
    border-right: 1px solid var(--ui-neutral-hover-border);
    border-top: 1px solid var(--ui-neutral-hover-border);
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    display: flex;
    flex: 0 0 275px;
    flex-direction: column;
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
    height: 100%;
    max-width: 100%;
    min-height: 0;
    position: relative;
    user-select: none;
    width: 275px;
  }

  button {
    font: inherit;
  }

  .workspace-header {
    align-items: flex-start;
    display: flex;
    flex: 0 0 auto;
    gap: 8px;
    padding: 16px 8px 12px;
  }

  .workspace-icon-cell {
    align-items: center;
    display: flex;
    flex: 0 0 40px;
    height: 40px;
    justify-content: center;
    width: 40px;
  }

  .workspace-icon-cell img {
    height: 32px;
    object-fit: contain;
    width: 32px;
  }

  .workspace-copy {
    flex: 1 1 auto;
    min-width: 0;
  }

  .workspace-title-row {
    align-items: center;
    display: flex;
    gap: 4px;
    min-width: 0;
  }

  .workspace-title-row h1 {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.025em;
    line-height: 20px;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-copy p {
    color: var(--ui-muted-text);
    font-size: 12px;
    line-height: 16px;
    margin: 0;
    overflow: hidden;
    padding-top: 2px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-open-button {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-muted-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 18px;
    height: 18px;
    justify-content: center;
    margin-left: 2px;
    padding: 0;
    width: 18px;
  }

  .workspace-open-button:hover,
  .workspace-open-button:focus-visible {
    color: var(--ui-hoverable-icon-glyph);
  }

  .separator {
    border-top: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    flex: 0 0 1px;
    height: 1px;
    width: 100%;
  }

  .folder-selector-wrap {
    flex: 0 0 auto;
    padding: 4px 8px;
  }

  .folder-selector {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-normal-text);
    cursor: pointer;
    display: grid;
    grid-template-columns: 34px 8px minmax(0, 1fr) 22px;
    min-width: 0;
    padding: 8px;
    text-align: left;
    width: 100%;
  }

  .folder-selector:hover,
  .folder-selector:focus-visible {
    background: var(--ui-neutral-action-fill);
  }

  .selector-icon-cell {
    align-items: center;
    display: flex;
    grid-column: 1;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .selector-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    grid-column: 3;
    min-width: 0;
  }

  .selector-title {
    font-size: 14px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selector-detail {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 12px;
    gap: 6px;
    min-width: 0;
    white-space: nowrap;
  }

  .separator-dot {
    background: var(--ui-muted-icon-glyph);
    border-radius: 50%;
    display: inline-block;
    height: 3px;
    opacity: 0.7;
    width: 3px;
  }

  .selector-chevron {
    align-items: center;
    display: flex;
    grid-column: 4;
    justify-content: center;
  }

  .prompts-header {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    gap: 4px;
    justify-content: center;
    min-height: 40px;
    padding: 8px;
  }

  .icon-action {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 36px;
    height: 36px;
    justify-content: center;
    padding: 0;
    width: 36px;
  }

  .icon-action:hover,
  .icon-action:focus-visible {
    background: var(--ui-neutral-action-fill);
    color: var(--ui-hoverable-icon-glyph);
  }

  .accordion-stack {
    border-top: 1px solid var(--ui-neutral-muted-border);
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  .accordion-section {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .completed-section {
    flex: 0 0 36%;
  }

  .active-section {
    flex: 1 1 auto;
  }

  .accordion-header {
    align-items: center;
    border: 0;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    color: var(--ui-normal-text);
    cursor: pointer;
    display: grid;
    flex: 0 0 38px;
    grid-template-columns: 25px 22px minmax(0, 1fr) auto;
    height: 38px;
    padding: 0 12px 0 8px;
    text-align: left;
    width: 100%;
  }

  .completed-section .accordion-header {
    background: linear-gradient(90deg, var(--ui-success-muted-border), transparent 76%);
    box-shadow: inset 3px 0 0 var(--ui-success-normal-border);
  }

  .active-section .accordion-header {
    background: linear-gradient(90deg, var(--ui-accent-action-fill), transparent 76%);
    box-shadow: inset 3px 0 0 var(--ui-accent-strong-border);
  }

  .accordion-header:hover,
  .accordion-header:focus-visible {
    filter: brightness(1.12);
  }

  .accordion-chevron,
  .accordion-icon {
    align-items: center;
    display: flex;
    justify-content: center;
  }

  .accordion-chevron {
    color: var(--ui-secondary-icon-glyph);
  }

  .completed-section .accordion-icon {
    color: var(--ui-success-normal-text);
  }

  .active-section .accordion-icon {
    color: var(--ui-accent-normal-text);
  }

  .accordion-title {
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.01em;
  }

  .accordion-count,
  .category-count {
    align-items: center;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 999px;
    color: var(--ui-secondary-text);
    display: inline-flex;
    font-size: 11px;
    height: 19px;
    justify-content: center;
    line-height: 1;
    min-width: 20px;
    padding: 0 5px;
  }

  .completed-section .accordion-count {
    background: var(--ui-success-muted-border);
    border-color: var(--ui-success-normal-border);
    color: var(--ui-success-normal-text);
  }

  .active-section .accordion-count {
    background: var(--ui-accent-action-fill);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-accent-normal-text);
  }

  .section-tree {
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-color: var(--ui-neutral-focus-border) transparent;
    scrollbar-width: thin;
  }

  .completed-tree {
    background: linear-gradient(180deg, var(--ui-success-muted-border), transparent 70px);
  }

  .active-tree {
    background: linear-gradient(180deg, var(--ui-accent-muted-border), transparent 76px);
  }

  .section-subheading {
    color: var(--ui-muted-text);
    font-size: 10px;
    font-weight: 650;
    letter-spacing: 0.075em;
    line-height: 25px;
    padding: 3px 14px 0;
    text-transform: uppercase;
  }

  .prompt-row,
  .category-row,
  .collapsed-category-preview {
    align-items: center;
    background: transparent;
    border: 0;
    box-sizing: border-box;
    color: var(--ui-hoverable-text);
    display: grid;
    font-size: 13px;
    height: 30px;
    min-width: 0;
    text-align: left;
    width: 100%;
  }

  .prompt-row {
    cursor: pointer;
    gap: 9px;
    grid-template-columns: 17px minmax(0, 1fr);
    padding: 0 14px 0 15px;
  }

  .prompt-row.nested {
    padding-left: 41px;
  }

  .prompt-row > span,
  .category-row > span:nth-child(3),
  .collapsed-category-preview > span:nth-child(3) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-row > :global(svg) {
    color: var(--ui-muted-icon-glyph);
    justify-self: center;
  }

  .prompt-row[data-completed='true'] {
    color: var(--ui-secondary-text);
  }

  .prompt-row[data-completed='true'] > :global(svg) {
    color: var(--ui-success-normal-text);
  }

  .prompt-row[data-selected='true'] {
    background: var(--ui-accent-action-fill);
    box-shadow: inset 3px 0 0 var(--ui-accent-strong-border);
    color: var(--ui-normal-text);
  }

  .prompt-row[data-selected='true'] > :global(svg) {
    color: var(--ui-accent-normal-text);
  }

  .prompt-row:hover,
  .prompt-row:focus-visible,
  .category-row:hover,
  .category-row:focus-visible,
  .collapsed-category-preview:hover {
    background: var(--ui-neutral-normal-surface);
    color: var(--ui-normal-text);
  }

  .category-block {
    margin-top: 3px;
  }

  .category-row,
  .collapsed-category-preview {
    gap: 7px;
    grid-template-columns: 18px 17px minmax(0, 1fr) auto;
    padding: 0 14px 0 11px;
  }

  .category-row {
    cursor: pointer;
  }

  .category-row > :global(svg),
  .collapsed-category-preview > :global(svg) {
    color: var(--ui-secondary-icon-glyph);
    justify-self: center;
  }

  .category-count {
    border: 0;
    color: var(--ui-muted-text);
    min-width: 17px;
    padding: 0 3px;
  }

  .collapsed-category-preview {
    cursor: pointer;
    margin-top: 3px;
  }

  .panel-resizer {
    align-items: center;
    cursor: ns-resize;
    display: flex;
    flex: 0 0 9px;
    justify-content: center;
    position: relative;
    z-index: 2;
  }

  .panel-resizer::before {
    background: var(--ui-neutral-emphasis-border);
    content: '';
    height: 1px;
    left: 0;
    position: absolute;
    right: 0;
  }

  .resize-grip {
    align-items: center;
    background: var(--ui-card-solid-surface);
    border: 1px solid var(--ui-neutral-emphasis-border);
    border-radius: 999px;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    height: 11px;
    justify-content: center;
    position: relative;
    width: 34px;
  }

  .panel-resizer:hover .resize-grip {
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-hoverable-icon-glyph);
  }

  .tree-bottom-space {
    height: 20px;
  }

  .resize-handle {
    bottom: 0;
    cursor: ew-resize;
    position: absolute;
    right: -3px;
    top: 0;
    width: 6px;
    z-index: 4;
  }
</style>
