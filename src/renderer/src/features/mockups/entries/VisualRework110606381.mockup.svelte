<script lang="ts">
  import {
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Circle,
    Clock3,
    Copy,
    Ellipsis,
    FileText,
    Folder,
    FolderPlus,
    GripVertical,
    Pencil,
    Plus,
    Search,
    Sparkles,
    Trash2
  } from 'lucide-svelte'

  type PromptStatus = 'todo' | 'in-progress' | 'completed'

  type Prompt = {
    id: string
    title: string
    body: string
    updated: string
    words: number
    status: PromptStatus
  }

  type PromptFolder = {
    id: string
    name: string
    description: string
    prefix: string
    suffix: string
    expanded: boolean
    prompts: Prompt[]
  }

  let loosePrompts = $state<Prompt[]>([
    {
      id: 'triage-imports',
      title: 'Triage imported prompts',
      body: 'Review the imported workspace prompts and group them by project area, risk, and expected follow-up owner.\n\nReturn a concise list of prompts that should move into subfolders and note duplicated instructions.',
      updated: '2 min ago',
      words: 31,
      status: 'in-progress'
    },
    {
      id: 'clean-front-matter',
      title: 'Clean workspace front matter',
      body: 'Normalize prompt front matter for the current workspace. Keep titles stable, preserve folder assignments, and report fields that cannot be mapped safely.',
      updated: '18 min ago',
      words: 23,
      status: 'completed'
    }
  ])

  let folders = $state<PromptFolder[]>([
    {
      id: 'architecture',
      name: 'Architecture Reviews',
      description: 'Reusable review prompts for larger renderer and main-process changes.',
      prefix: 'Review data flow, IPC boundaries, persistence behavior, and renderer state ownership.',
      suffix: 'Group findings by severity and include the smallest verification path.',
      expanded: true,
      prompts: [
        {
          id: 'workspace-import',
          title: 'Outline workspace import edge cases',
          body: 'Review the workspace import flow and identify edge cases around missing folders, duplicate prompt titles, malformed front matter, and partially written workspace files.',
          updated: '24 min ago',
          words: 26,
          status: 'todo'
        },
        {
          id: 'editor-sizing',
          title: 'Refactor editor sizing controller',
          body: 'Refactor prompt editor sizing so height estimation, measured-height caching, and Monaco relayout are easier to follow. Keep behavior unchanged and add regression coverage for wrapped lines.',
          updated: '41 min ago',
          words: 29,
          status: 'completed'
        },
        {
          id: 'drag-persistence',
          title: 'Review drag and drop persistence',
          body: 'Review cross-folder moves, optimistic ordering, cancelled drags, and recovery when a drop target disappears. List only issues that can cause user-visible regressions.',
          updated: '1 hr ago',
          words: 25,
          status: 'todo'
        }
      ]
    },
    {
      id: 'testing',
      name: 'Testing Workflows',
      description: 'Prompts for durable Vitest and Playwright regression coverage.',
      prefix: 'Use existing test helpers and prefer stable data-testid selectors.',
      suffix: 'End with the exact commands to run and mention remaining coverage gaps.',
      expanded: true,
      prompts: [
        {
          id: 'playwright-coverage',
          title: 'Write Playwright coverage',
          body: 'Add coverage for creating a prompt, typing in the editor, navigating away, and returning to verify content and focus state.',
          updated: 'Yesterday',
          words: 22,
          status: 'in-progress'
        },
        {
          id: 'memfs-test',
          title: 'Add memfs persistence test',
          body: 'Write a nested prompt, reload the workspace, and verify prompt order and folder metadata are preserved. Keep assertions focused on serialized workspace data.',
          updated: 'Jun 20',
          words: 24,
          status: 'todo'
        }
      ]
    },
    {
      id: 'release',
      name: 'Release Notes',
      description: 'Turn recent changes into concise, user-facing release notes.',
      prefix: 'Focus on visible behavior, workflow improvements, and changed settings.',
      suffix: 'Leave out implementation details unless they affect an upgrade.',
      expanded: false,
      prompts: [
        {
          id: 'draft-release',
          title: 'Draft release notes',
          body: 'Summarize recent prompt folder changes with an emphasis on user-facing behavior and workflow improvements.',
          updated: 'Jun 12',
          words: 15,
          status: 'completed'
        },
        {
          id: 'settings-polish',
          title: 'Polish settings controls',
          body: 'Align numeric inputs, toggles, and labels consistently at desktop and narrow widths.',
          updated: 'Jun 8',
          words: 13,
          status: 'todo'
        }
      ]
    }
  ])

  let filter = $state('')

  const statusLabel = (status: PromptStatus) => {
    if (status === 'completed') return 'Completed'
    if (status === 'in-progress') return 'In progress'
    return 'Todo'
  }

  const nextStatus = (status: PromptStatus): PromptStatus => {
    if (status === 'todo') return 'in-progress'
    if (status === 'in-progress') return 'completed'
    return 'todo'
  }

  const toggleFolder = (folderId: string) => {
    folders = folders.map((folder) =>
      folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder
    )
  }

  const togglePromptStatus = (promptId: string) => {
    loosePrompts = loosePrompts.map((prompt) =>
      prompt.id === promptId ? { ...prompt, status: nextStatus(prompt.status) } : prompt
    )
    folders = folders.map((folder) => ({
      ...folder,
      prompts: folder.prompts.map((prompt) =>
        prompt.id === promptId ? { ...prompt, status: nextStatus(prompt.status) } : prompt
      )
    }))
  }

  const matchesFilter = (prompt: Prompt) =>
    filter.trim().length === 0 ||
    `${prompt.title} ${prompt.body}`.toLowerCase().includes(filter.trim().toLowerCase())

  const filteredLoosePrompts = $derived(loosePrompts.filter(matchesFilter))
  const visiblePromptCount = $derived(
    filteredLoosePrompts.length +
      folders.reduce(
        (count, folder) => count + folder.prompts.filter(matchesFilter).length,
        0
      )
  )
</script>

{#snippet StatusIcon(status: PromptStatus)}
  {#if status === 'completed'}
    <CheckCircle2 size={15} aria-hidden="true" />
  {:else if status === 'in-progress'}
    <Clock3 size={15} aria-hidden="true" />
  {:else}
    <Circle size={15} aria-hidden="true" />
  {/if}
{/snippet}

{#snippet AddRow(label: string)}
  <button class="vr-add-row" type="button">
    <span></span>
    <span class="vr-add-row-label"><Plus size={13} aria-hidden="true" />{label}</span>
    <span></span>
  </button>
{/snippet}

{#snippet PromptCard(prompt: Prompt, folderName: string)}
  <article class="vr-prompt" data-status={prompt.status}>
    <button class="vr-drag" type="button" aria-label={`Move ${prompt.title}`}>
      <GripVertical size={16} aria-hidden="true" />
    </button>

    <div class="vr-prompt-main">
      <header class="vr-prompt-header">
        <div class="vr-prompt-identity">
          <span class="vr-file-icon"><FileText size={17} aria-hidden="true" /></span>
          <div class="vr-prompt-heading">
            <input value={prompt.title} aria-label="Prompt title" />
            <div class="vr-meta">
              <span>{folderName}</span><i></i><span>{prompt.words} words</span><i></i><span>{prompt.updated}</span>
            </div>
          </div>
        </div>

        <div class="vr-prompt-actions">
          <button type="button" title="Improve prompt" aria-label="Improve prompt">
            <Sparkles size={15} aria-hidden="true" />
          </button>
          <button type="button" title="Copy prompt" aria-label="Copy prompt">
            <Copy size={15} aria-hidden="true" />
          </button>
          <button type="button" title="Delete prompt" aria-label="Delete prompt">
            <Trash2 size={15} aria-hidden="true" />
          </button>
          <span class="vr-action-rule"></span>
          <button
            class="vr-status"
            data-status={prompt.status}
            type="button"
            aria-label={`Change status from ${statusLabel(prompt.status)}`}
            onclick={() => togglePromptStatus(prompt.id)}
          >
            {@render StatusIcon(prompt.status)}
            {statusLabel(prompt.status)}
          </button>
        </div>
      </header>

      <textarea aria-label={`${prompt.title} body`} value={prompt.body}></textarea>
    </div>
  </article>
{/snippet}

<section class="visual-rework" data-testid="visual-rework-110606381">
  <header class="vr-page-header">
    <div>
      <div class="vr-eyebrow"><Folder size={14} aria-hidden="true" /> Workspace</div>
      <h1>Prompts</h1>
      <p>{visiblePromptCount} prompts in {folders.length} folders</p>
    </div>

    <div class="vr-page-actions">
      <label class="vr-search">
        <Search size={15} aria-hidden="true" />
        <input bind:value={filter} placeholder="Filter prompts" aria-label="Filter prompts" />
      </label>
      <button class="vr-secondary-button" type="button"><FolderPlus size={16} aria-hidden="true" />New folder</button>
      <button class="vr-primary-button" type="button"><Plus size={16} aria-hidden="true" />New prompt</button>
    </div>
  </header>

  <div class="vr-content">
    <section class="vr-loose-section" aria-labelledby="loose-prompts-heading">
      <div class="vr-section-heading">
        <div>
          <h2 id="loose-prompts-heading">Unfiled prompts</h2>
          <span>{filteredLoosePrompts.length}</span>
        </div>
        <p>Prompts at the workspace root</p>
      </div>

      <div class="vr-prompt-stack">
        {@render AddRow('Add prompt')}
        {#each filteredLoosePrompts as prompt (prompt.id)}
          {@render PromptCard(prompt, 'Prompts')}
          {@render AddRow('Add prompt')}
        {/each}
      </div>
    </section>

    <div class="vr-folders-heading">
      <span>Folders</span>
      <div></div>
      <span>{folders.length}</span>
    </div>

    <div class="vr-folder-list">
      {#each folders as folder (folder.id)}
        {@const filteredPrompts = folder.prompts.filter(matchesFilter)}
        <section class="vr-folder" data-open={folder.expanded}>
          <header class="vr-folder-header">
            <button
              class="vr-folder-toggle"
              type="button"
              aria-label={folder.expanded ? 'Collapse folder' : 'Expand folder'}
              aria-expanded={folder.expanded}
              onclick={() => toggleFolder(folder.id)}
            >
              {#if folder.expanded}
                <ChevronDown size={18} aria-hidden="true" />
              {:else}
                <ChevronRight size={18} aria-hidden="true" />
              {/if}
            </button>

            <span class="vr-folder-icon"><Folder size={19} aria-hidden="true" /></span>
            <div class="vr-folder-title">
              <div><h2>{folder.name}</h2><button type="button" aria-label="Edit folder title"><Pencil size={12} aria-hidden="true" /></button></div>
              <p>{folder.prompts.length} prompts</p>
            </div>

            <button class="vr-folder-menu" type="button" aria-label="Folder actions">
              <Ellipsis size={18} aria-hidden="true" />
            </button>
          </header>

          {#if folder.expanded}
            <div class="vr-context-grid">
              <label>
                <span>Description</span>
                <textarea value={folder.description} aria-label={`${folder.name} description`}></textarea>
              </label>
              <label>
                <span>Prefix</span>
                <textarea value={folder.prefix} aria-label={`${folder.name} prefix`}></textarea>
              </label>
              <label>
                <span>Suffix</span>
                <textarea value={folder.suffix} aria-label={`${folder.name} suffix`}></textarea>
              </label>
            </div>

            <div class="vr-folder-prompts">
              <div class="vr-branch" aria-hidden="true"></div>
              <div class="vr-prompt-stack">
                {@render AddRow('Add prompt')}
                {#each filteredPrompts as prompt (prompt.id)}
                  {@render PromptCard(prompt, folder.name)}
                  {@render AddRow('Add prompt')}
                {/each}
              </div>
            </div>
          {/if}
        </section>
      {/each}
    </div>
  </div>
</section>

<style>
  .visual-rework {
    --vr-line: var(--ui-neutral-normal-border);
    --vr-soft-line: var(--ui-neutral-muted-border);
    --vr-surface: oklch(0.225 0.012 274);
    --vr-surface-raised: oklch(0.255 0.014 274);
    --vr-surface-editor: oklch(0.185 0.01 274);
    --vr-violet: oklch(0.76 0.13 297);
    --vr-blue: oklch(0.75 0.12 241);
    --vr-green: oklch(0.79 0.14 154);
    --vr-amber: oklch(0.83 0.14 84);
    box-sizing: border-box;
    color: var(--ui-normal-text);
    min-width: 0;
    padding: 28px 30px 54px;
    width: 100%;
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  button {
    color: inherit;
  }

  .vr-page-header {
    align-items: end;
    border-bottom: 1px solid var(--vr-line);
    display: flex;
    gap: 24px;
    justify-content: space-between;
    padding: 0 2px 22px;
  }

  .vr-eyebrow {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 12px;
    font-weight: 600;
    gap: 6px;
    letter-spacing: 0.06em;
    margin-bottom: 7px;
    text-transform: uppercase;
  }

  .vr-page-header h1,
  .vr-page-header p,
  .vr-section-heading h2,
  .vr-section-heading p,
  .vr-folder-title h2,
  .vr-folder-title p {
    margin: 0;
  }

  .vr-page-header h1 {
    font-size: 27px;
    letter-spacing: -0.025em;
    line-height: 1.15;
  }

  .vr-page-header p {
    color: var(--ui-muted-text);
    font-size: 13px;
    margin-top: 5px;
  }

  .vr-page-actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .vr-search {
    align-items: center;
    background: var(--ui-neutral-field-surface);
    border: 1px solid var(--vr-line);
    border-radius: 7px;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    gap: 7px;
    height: 34px;
    padding: 0 10px;
    width: 190px;
  }

  .vr-search:focus-within {
    border-color: var(--ui-neutral-focus-border);
  }

  .vr-search input {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    min-width: 0;
    outline: 0;
    padding: 0;
    width: 100%;
  }

  .vr-search input::placeholder {
    color: var(--ui-muted-text);
  }

  .vr-primary-button,
  .vr-secondary-button {
    align-items: center;
    border-radius: 7px;
    cursor: pointer;
    display: inline-flex;
    font-size: 13px;
    font-weight: 600;
    gap: 7px;
    height: 34px;
    padding: 0 12px;
  }

  .vr-secondary-button {
    background: var(--ui-neutral-normal-surface);
    border: 1px solid var(--vr-line);
  }

  .vr-primary-button {
    background: oklch(0.58 0.19 292);
    border: 1px solid oklch(0.72 0.15 294 / 70%);
  }

  .vr-content {
    display: grid;
    gap: 24px;
    padding-top: 24px;
  }

  .vr-loose-section {
    display: grid;
    gap: 10px;
  }

  .vr-section-heading {
    align-items: end;
    display: flex;
    justify-content: space-between;
    padding: 0 2px;
  }

  .vr-section-heading > div {
    align-items: center;
    display: flex;
    gap: 8px;
  }

  .vr-section-heading h2 {
    font-size: 13px;
    font-weight: 650;
  }

  .vr-section-heading span,
  .vr-folders-heading > span:last-child {
    background: var(--ui-neutral-normal-surface);
    border: 1px solid var(--vr-soft-line);
    border-radius: 999px;
    color: var(--ui-secondary-text);
    font-size: 11px;
    line-height: 18px;
    min-width: 18px;
    padding: 0 5px;
    text-align: center;
  }

  .vr-section-heading p {
    color: var(--ui-muted-text);
    font-size: 12px;
  }

  .vr-prompt-stack {
    display: grid;
    min-width: 0;
  }

  .vr-add-row {
    align-items: center;
    background: transparent;
    border: 0;
    cursor: pointer;
    display: grid;
    grid-template-columns: minmax(20px, 1fr) auto minmax(20px, 1fr);
    height: 24px;
    margin: 0;
    opacity: 0;
    padding: 0;
    transition: opacity 120ms ease;
    width: 100%;
  }

  .vr-prompt-stack:hover > .vr-add-row,
  .vr-add-row:focus-visible {
    opacity: 1;
  }

  .vr-add-row > span:first-child,
  .vr-add-row > span:last-child {
    background: var(--ui-accent-normal-border);
    height: 1px;
  }

  .vr-add-row-label {
    align-items: center;
    color: var(--ui-accent-normal-text);
    display: flex;
    font-size: 11px;
    gap: 3px;
    padding: 0 8px;
  }

  .vr-prompt {
    background: var(--vr-surface);
    border: 1px solid var(--vr-line);
    border-radius: 9px;
    box-shadow: 0 9px 22px oklch(0 0 0 / 10%);
    display: grid;
    grid-template-columns: 27px minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
    position: relative;
  }

  .vr-prompt::before {
    background: var(--ui-secondary-icon-glyph);
    bottom: 0;
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 3px;
  }

  .vr-prompt[data-status='in-progress']::before {
    background: var(--vr-amber);
  }

  .vr-prompt[data-status='completed']::before {
    background: var(--vr-green);
  }

  .vr-drag {
    align-items: center;
    background: oklch(0.19 0.01 274 / 65%);
    border: 0;
    border-right: 1px solid var(--vr-soft-line);
    color: var(--ui-muted-icon-glyph);
    cursor: grab;
    display: flex;
    justify-content: center;
    padding: 0 0 0 2px;
  }

  .vr-prompt-main {
    min-width: 0;
  }

  .vr-prompt-header {
    align-items: center;
    display: grid;
    gap: 14px;
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 58px;
    padding: 7px 10px 7px 13px;
  }

  .vr-prompt-identity {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 31px minmax(0, 1fr);
    min-width: 0;
  }

  .vr-file-icon {
    align-items: center;
    background: oklch(0.7 0.1 293 / 12%);
    border: 1px solid oklch(0.75 0.12 293 / 18%);
    border-radius: 7px;
    color: var(--vr-violet);
    display: flex;
    height: 31px;
    justify-content: center;
    width: 31px;
  }

  .vr-prompt-heading {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .vr-prompt-heading input {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 650;
    line-height: 19px;
    min-width: 0;
    outline: 0;
    padding: 0;
    width: 100%;
  }

  .vr-meta {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    font-size: 11px;
    gap: 7px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .vr-meta i {
    background: var(--ui-muted-icon-glyph);
    border-radius: 50%;
    flex: 0 0 2px;
    height: 2px;
    width: 2px;
  }

  .vr-prompt-actions {
    align-items: center;
    display: flex;
    gap: 3px;
  }

  .vr-prompt-actions > button:not(.vr-status),
  .vr-folder-title button,
  .vr-folder-menu {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: var(--ui-secondary-icon-glyph);
    cursor: pointer;
    display: flex;
    height: 28px;
    justify-content: center;
    padding: 0;
    width: 28px;
  }

  .vr-prompt-actions > button:not(.vr-status):hover,
  .vr-folder-title button:hover,
  .vr-folder-menu:hover {
    background: var(--ui-neutral-action-hover-fill);
    color: var(--ui-hoverable-icon-glyph);
  }

  .vr-action-rule {
    background: var(--vr-line);
    height: 24px;
    margin: 0 5px;
    width: 1px;
  }

  .vr-status {
    align-items: center;
    background: transparent;
    border: 1px solid var(--vr-line);
    border-radius: 999px;
    color: var(--ui-secondary-text);
    cursor: pointer;
    display: flex;
    font-size: 11px;
    font-weight: 600;
    gap: 6px;
    height: 28px;
    justify-content: center;
    padding: 0 10px;
    width: 104px;
  }

  .vr-status[data-status='in-progress'] {
    background: var(--ui-warning-normal-surface);
    border-color: var(--ui-warning-normal-border);
    color: var(--vr-amber);
  }

  .vr-status[data-status='completed'] {
    background: oklch(0.6 0.16 154 / 10%);
    border-color: var(--ui-success-normal-border);
    color: var(--vr-green);
  }

  .vr-prompt-main > textarea {
    background: var(--vr-surface-editor);
    border: 0;
    border-top: 1px solid var(--vr-soft-line);
    box-sizing: border-box;
    color: var(--ui-secondary-text);
    display: block;
    font-family: 'Cascadia Code', Consolas, monospace;
    font-size: 12px;
    line-height: 1.65;
    min-height: 78px;
    outline: 0;
    padding: 12px 15px 13px;
    resize: vertical;
    width: 100%;
  }

  .vr-prompt-main > textarea:focus {
    box-shadow: inset 0 0 0 1px var(--ui-neutral-focus-border);
  }

  .vr-folders-heading {
    align-items: center;
    color: var(--ui-secondary-text);
    display: grid;
    font-size: 11px;
    font-weight: 650;
    gap: 10px;
    grid-template-columns: auto minmax(20px, 1fr) auto;
    letter-spacing: 0.07em;
    margin-top: 3px;
    text-transform: uppercase;
  }

  .vr-folders-heading > div {
    background: var(--vr-line);
    height: 1px;
  }

  .vr-folder-list {
    display: grid;
    gap: 16px;
  }

  .vr-folder {
    background: oklch(0.205 0.014 274 / 72%);
    border: 1px solid var(--vr-line);
    border-radius: 11px;
    min-width: 0;
    overflow: hidden;
  }

  .vr-folder[data-open='true'] {
    box-shadow: 0 16px 36px oklch(0 0 0 / 12%);
  }

  .vr-folder-header {
    align-items: center;
    background: linear-gradient(90deg, oklch(0.31 0.035 291 / 80%), var(--vr-surface-raised));
    display: grid;
    gap: 10px;
    grid-template-columns: 28px 36px minmax(0, 1fr) 30px;
    min-height: 64px;
    padding: 4px 12px;
  }

  .vr-folder-toggle {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: var(--ui-secondary-icon-glyph);
    cursor: pointer;
    display: flex;
    height: 30px;
    justify-content: center;
    padding: 0;
    width: 28px;
  }

  .vr-folder-toggle:hover {
    background: var(--ui-neutral-action-hover-fill);
  }

  .vr-folder-icon {
    align-items: center;
    background: oklch(0.72 0.12 293 / 14%);
    border: 1px solid oklch(0.76 0.12 293 / 22%);
    border-radius: 8px;
    color: var(--vr-violet);
    display: flex;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .vr-folder-title {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .vr-folder-title > div {
    align-items: center;
    display: flex;
    gap: 5px;
    min-width: 0;
  }

  .vr-folder-title h2 {
    font-size: 15px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vr-folder-title button {
    height: 22px;
    width: 22px;
  }

  .vr-folder-title p {
    color: var(--ui-muted-text);
    font-size: 11px;
  }

  .vr-context-grid {
    background: oklch(0.18 0.011 274 / 70%);
    border-top: 1px solid var(--vr-soft-line);
    display: grid;
    gap: 1px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .vr-context-grid label {
    background: var(--vr-surface);
    display: grid;
    grid-template-rows: 30px auto;
    min-width: 0;
  }

  .vr-context-grid label + label {
    border-left: 1px solid var(--vr-soft-line);
  }

  .vr-context-grid label > span {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0 12px;
    text-transform: uppercase;
  }

  .vr-context-grid textarea {
    background: var(--vr-surface-editor);
    border: 0;
    border-top: 1px solid var(--vr-soft-line);
    box-sizing: border-box;
    color: var(--ui-secondary-text);
    font-size: 11px;
    line-height: 1.5;
    min-height: 76px;
    outline: 0;
    padding: 10px 12px;
    resize: vertical;
    width: 100%;
  }

  .vr-folder-prompts {
    border-top: 1px solid var(--vr-line);
    display: grid;
    grid-template-columns: 35px minmax(0, 1fr);
    padding: 5px 12px 13px 0;
  }

  .vr-branch {
    border-bottom: 1px solid oklch(0.72 0.1 293 / 28%);
    border-left: 1px solid oklch(0.72 0.1 293 / 28%);
    border-radius: 0 0 0 8px;
    height: 34px;
    margin-left: 18px;
  }

  @media (max-width: 900px) {
    .visual-rework {
      padding-left: 18px;
      padding-right: 18px;
    }

    .vr-page-header {
      align-items: stretch;
      flex-direction: column;
    }

    .vr-page-actions {
      justify-content: flex-start;
    }

    .vr-prompt-header {
      align-items: stretch;
      grid-template-columns: minmax(0, 1fr);
    }

    .vr-prompt-actions {
      padding-left: 41px;
    }

    .vr-context-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .vr-context-grid label + label {
      border-left: 0;
      border-top: 1px solid var(--vr-soft-line);
    }
  }
</style>
