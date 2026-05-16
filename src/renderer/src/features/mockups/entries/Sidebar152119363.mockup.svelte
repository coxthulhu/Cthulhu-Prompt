<script lang="ts">
  import {
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Folder,
    Home,
    Plus,
    Search,
    Settings,
    Sparkles
  } from 'lucide-svelte'

  type PromptFolder = {
    name: string
    count: number
    accent: string
    prompts: string[]
    active?: boolean
  }

  const promptFolders: PromptFolder[] = [
    {
      name: 'Codex Workflows',
      count: 8,
      accent: 'var(--ui-accent-normal-border)',
      active: true,
      prompts: [
        'Plan a scoped refactor',
        'Review failing Playwright logs',
        'Draft compact PR summary'
      ]
    },
    {
      name: 'Renderer Patterns',
      count: 12,
      accent: 'var(--ui-info-normal-border)',
      prompts: ['Svelte rune state audit', 'Virtual window sizing', 'Component API cleanup']
    },
    {
      name: 'Release Checks',
      count: 5,
      accent: 'var(--ui-success-normal-border)',
      prompts: ['Build verification notes', 'Smoke test matrix']
    },
    {
      name: 'Experiments',
      count: 4,
      accent: 'var(--ui-warning-normal-border)',
      prompts: ['Prompt folder shading', 'Editor toolbar variants']
    }
  ]
</script>

<aside class="sidebar-mockup" aria-label="Application sidebar">
  <nav class="sidebar-rail" aria-label="Primary">
    <div class="rail-mark" aria-hidden="true">
      <Sparkles class="rail-mark-icon" />
    </div>

    <button type="button" class="rail-button rail-button-active" aria-label="Home" title="Home">
      <Home class="rail-icon" />
    </button>
    <button type="button" class="rail-button" aria-label="Search" title="Search">
      <Search class="rail-icon" />
    </button>
    <button type="button" class="rail-button" aria-label="Settings" title="Settings">
      <Settings class="rail-icon" />
    </button>
  </nav>

  <section class="sidebar-pane" aria-label="Prompts">
    <header class="workspace-header">
      <div class="workspace-title-row">
        <div class="workspace-chip" aria-hidden="true">CP</div>
        <div class="workspace-copy">
          <h1>Cthulhu Prompt</h1>
          <p>C:\Source\PromptApps</p>
        </div>
      </div>
    </header>

    <div class="quick-actions" aria-label="Sidebar actions">
      <button type="button" class="quick-action quick-action-active">
        <Home class="quick-action-icon" />
        <span>Home</span>
      </button>
      <button type="button" class="quick-action">
        <Settings class="quick-action-icon" />
        <span>Settings</span>
      </button>
    </div>

    <div class="section-heading">
      <div>
        <p class="section-kicker">Prompts</p>
        <p class="section-count">4 folders</p>
      </div>
      <div class="heading-tools">
        <button type="button" class="icon-button" aria-label="Expand All Prompt Folders">
          <ChevronsUpDown class="icon-button-glyph" />
        </button>
        <button type="button" class="icon-button" aria-label="Collapse All Prompt Folders">
          <ChevronsDownUp class="icon-button-glyph" />
        </button>
        <button type="button" class="icon-button icon-button-accent" aria-label="Create Prompt Folder">
          <Plus class="icon-button-glyph" />
        </button>
      </div>
    </div>

    <div class="folder-list" aria-label="Prompt folders">
      {#each promptFolders as folder (folder.name)}
        <article class="folder-card" data-active={folder.active ? 'true' : 'false'}>
          <button type="button" class="folder-row">
            <span class="folder-accent" style={`background: ${folder.accent}`}></span>
            <ChevronDown class="folder-chevron" />
            <Folder class="folder-icon" />
            <span class="folder-name">{folder.name}</span>
            <span class="folder-count">{folder.count}</span>
          </button>

          <div class="prompt-list">
            {#each folder.prompts as prompt, index (prompt)}
              <button
                type="button"
                class="prompt-row"
                data-active={folder.active && index === 1 ? 'true' : 'false'}
              >
                <FileText class="prompt-icon" />
                <span>{prompt}</span>
              </button>
            {/each}
          </div>
        </article>
      {/each}
    </div>
  </section>
</aside>

<style>
  .sidebar-mockup {
    display: flex;
    width: min(25rem, 100%);
    height: min(45rem, calc(100vh - 8rem));
    min-height: 36rem;
    overflow: hidden;
    color: var(--ui-normal-text);
    font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;
    border: 1px solid var(--ui-card-normal-border);
    border-radius: var(--cthulhu-ui-radius-card);
    background:
      linear-gradient(180deg, oklch(0.2 0.018 268 / 92%) 0%, oklch(0.126 0.012 268 / 96%) 100%),
      linear-gradient(90deg, var(--ui-card-normal-surface-gradient-start), transparent);
    box-shadow: var(--cthulhu-ui-shadow-card);
  }

  .sidebar-rail {
    display: flex;
    width: 3.75rem;
    flex: 0 0 3.75rem;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.5rem;
    border-right: 1px solid var(--ui-neutral-muted-border);
    background: oklch(0 0 0 / 16%);
  }

  .rail-mark {
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    margin-bottom: 0.25rem;
    border: 1px solid var(--ui-accent-normal-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-accent-normal-surface);
    color: var(--ui-accent-normal-text);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
  }

  :global(.rail-mark-icon),
  :global(.rail-icon),
  :global(.quick-action-icon),
  :global(.icon-button-glyph),
  :global(.folder-chevron),
  :global(.folder-icon),
  :global(.prompt-icon) {
    width: 1rem;
    height: 1rem;
  }

  .rail-button,
  .icon-button {
    display: grid;
    place-items: center;
    border: 1px solid transparent;
    border-radius: var(--cthulhu-ui-radius-icon-button);
    background: transparent;
    color: var(--ui-secondary-text);
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease,
      transform 120ms ease;
  }

  .rail-button {
    width: 2.25rem;
    height: 2.25rem;
  }

  .rail-button:hover,
  .rail-button:focus-visible,
  .icon-button:hover,
  .icon-button:focus-visible {
    border-color: var(--ui-neutral-hover-border);
    background: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
    outline: none;
  }

  .rail-button:hover,
  .icon-button:hover {
    transform: translateY(-1px);
  }

  .rail-button-active {
    border-color: var(--ui-neutral-emphasis-border);
    background: var(--ui-neutral-emphasis-surface);
    color: var(--ui-normal-text);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);
  }

  .sidebar-pane {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    padding: 0.75rem;
  }

  .workspace-header {
    padding: 0.125rem 0 0.75rem;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
  }

  .workspace-title-row {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.65rem;
  }

  .workspace-chip {
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid var(--ui-neutral-hover-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-card-solid-surface);
    color: var(--ui-hoverable-text);
    font-size: 0.72rem;
    font-weight: 750;
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
  }

  .workspace-copy {
    min-width: 0;
  }

  .workspace-copy h1,
  .workspace-copy p,
  .section-kicker,
  .section-count {
    margin: 0;
  }

  .workspace-copy h1 {
    overflow: hidden;
    color: var(--ui-normal-text);
    font-size: 0.92rem;
    font-weight: 700;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workspace-copy p {
    overflow: hidden;
    padding-top: 0.125rem;
    color: var(--ui-muted-text);
    font-size: 0.76rem;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quick-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding: 0.75rem 0;
  }

  .quick-action {
    display: inline-flex;
    min-width: 0;
    height: 2.25rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background: var(--ui-neutral-muted-surface);
    color: var(--ui-hoverable-text);
    font: inherit;
    font-size: 0.84rem;
    font-weight: 650;
    cursor: pointer;
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight);
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .quick-action:hover,
  .quick-action:focus-visible {
    border-color: var(--ui-neutral-hover-border);
    background: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
    outline: none;
  }

  .quick-action-active {
    border-color: var(--ui-neutral-emphasis-border);
    background: var(--ui-neutral-emphasis-surface);
    color: var(--ui-normal-text);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.25rem 0 0.625rem;
  }

  .section-kicker {
    color: var(--ui-secondary-text);
    font-size: 0.68rem;
    font-weight: 750;
    letter-spacing: 0.14em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .section-count {
    padding-top: 0.125rem;
    color: var(--ui-muted-text);
    font-size: 0.76rem;
    line-height: 1.25;
  }

  .heading-tools {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.125rem;
  }

  .icon-button {
    width: 1.75rem;
    height: 1.75rem;
  }

  .icon-button-accent {
    border-color: var(--ui-accent-normal-border);
    background: var(--ui-accent-normal-surface);
    color: var(--ui-accent-normal-text);
  }

  .icon-button-accent:hover,
  .icon-button-accent:focus-visible {
    border-color: var(--ui-accent-hover-border);
    background: var(--ui-accent-hover-surface);
  }

  .folder-list {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: 0.5rem;
    overflow: hidden;
  }

  .folder-card {
    border: 1px solid transparent;
    border-radius: var(--cthulhu-ui-radius-card);
    background: var(--ui-neutral-muted-surface);
    box-shadow: inset 0 1px 0 var(--ui-neutral-muted-surface);
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .folder-card:hover,
  .folder-card:focus-within {
    border-color: var(--ui-neutral-hover-border);
    background: var(--ui-neutral-normal-surface);
  }

  .folder-card[data-active='true'] {
    border-color: var(--ui-neutral-emphasis-border);
    background:
      linear-gradient(180deg, var(--ui-neutral-emphasis-surface), var(--ui-neutral-normal-surface)),
      var(--ui-neutral-normal-surface);
    box-shadow: var(--cthulhu-ui-shadow-surface-highlight-active);
  }

  .folder-row,
  .prompt-row {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .folder-row {
    height: 2.35rem;
    gap: 0.45rem;
    padding: 0 0.5rem;
    color: var(--ui-hoverable-text);
  }

  .folder-accent {
    width: 0.2rem;
    height: 1.25rem;
    flex: 0 0 auto;
    border-radius: 999px;
  }

  :global(.folder-chevron) {
    flex: 0 0 auto;
    color: var(--ui-muted-text);
    transition: color 120ms ease;
  }

  :global(.folder-icon) {
    flex: 0 0 auto;
    color: var(--ui-secondary-text);
  }

  .folder-name {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    font-size: 0.86rem;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-count {
    display: inline-flex;
    min-width: 1.5rem;
    height: 1.2rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    background: oklch(0 0 0 / 12%);
    color: var(--ui-secondary-text);
    font-size: 0.68rem;
    font-weight: 750;
  }

  .folder-row:hover :global(.folder-chevron),
  .folder-row:hover :global(.folder-icon),
  .folder-row:focus-visible :global(.folder-chevron),
  .folder-row:focus-visible :global(.folder-icon) {
    color: var(--ui-normal-text);
  }

  .folder-row:focus-visible,
  .prompt-row:focus-visible {
    outline: 1px solid var(--ui-neutral-focus-border);
    outline-offset: -2px;
  }

  .prompt-list {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0 0.4rem 0.45rem 1.65rem;
  }

  .prompt-row {
    height: 1.82rem;
    gap: 0.45rem;
    padding: 0 0.5rem;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-text);
    transition:
      background-color 120ms ease,
      color 120ms ease,
      box-shadow 120ms ease;
  }

  .prompt-row:hover {
    background: var(--ui-neutral-hover-surface);
    color: var(--ui-normal-text);
  }

  .prompt-row[data-active='true'] {
    background: var(--ui-accent-normal-surface);
    color: var(--ui-accent-normal-text);
    box-shadow: inset 0 0 0 1px var(--ui-accent-normal-border);
  }

  :global(.prompt-icon) {
    flex: 0 0 auto;
  }

  .prompt-row span {
    min-width: 0;
    overflow: hidden;
    font-size: 0.8rem;
    font-weight: 520;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
