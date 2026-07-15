<script lang="ts">
  import {
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Circle,
    Clock3,
    Copy,
    FileText,
    Folder,
    GripVertical,
    MoreHorizontal,
    Pencil,
    Plus,
    Sparkles,
    Trash2
  } from 'lucide-svelte'

  type Status = 'todo' | 'in-progress' | 'completed'
  type Prompt = {
    id: string
    title: string
    folder: string
    updated: string
    status: Status
    content: string
  }
  type FolderGroup = {
    id: string
    title: string
    description: string
    prefix: string
    suffix: string
    expanded: boolean
    tone: 'violet' | 'blue' | 'amber'
    prompts: Prompt[]
  }

  let filter = $state<'all' | Status>('all')
  let loosePrompts = $state<Prompt[]>([
    {
      id: 'triage',
      title: 'Triage imported prompts',
      folder: 'Prompts',
      updated: '2 min ago',
      status: 'in-progress',
      content:
        'Review the imported workspace prompts and group them by project area, risk, and expected follow-up owner.\n\nReturn a short list of prompts that should move into subfolders and note any duplicated instructions.'
    },
    {
      id: 'front-matter',
      title: 'Clean workspace front matter',
      folder: 'Prompts',
      updated: '18 min ago',
      status: 'completed',
      content:
        'Normalize prompt front matter for the current workspace.\n\nKeep titles stable, preserve folder assignments, and report any fields that cannot be mapped safely.'
    }
  ])

  let folders = $state<FolderGroup[]>([
    {
      id: 'architecture',
      title: 'Architecture Reviews',
      description: 'Reusable review prompts for large renderer and main-process changes.',
      prefix:
        'Review data flow, IPC boundaries, persistence behavior, and renderer state ownership.',
      suffix: 'Group findings by severity and include the smallest verification path.',
      expanded: true,
      tone: 'violet',
      prompts: [
        {
          id: 'edge-cases',
          title: 'Outline workspace import edge cases',
          folder: 'Architecture Reviews',
          updated: '24 min ago',
          status: 'todo',
          content:
            'Review the workspace import flow and identify edge cases around missing folders, duplicate prompt titles, and malformed front matter.\n\nReturn findings as concrete bugs with file references and suggested tests.'
        },
        {
          id: 'sizing',
          title: 'Refactor editor sizing controller',
          folder: 'Architecture Reviews',
          updated: '41 min ago',
          status: 'completed',
          content:
            'Refactor the prompt editor sizing logic so height estimation, measured height caching, and Monaco relayout are easier to reason about.\n\nKeep behavior unchanged and add focused regression coverage for wrapped lines.'
        },
        {
          id: 'drag-drop',
          title: 'Review drag and drop persistence',
          folder: 'Architecture Reviews',
          updated: '1 hr ago',
          status: 'todo',
          content:
            'Code review the prompt tree drag and drop implementation. Focus on persistence order, optimistic UI state, and recovery when a drop target disappears.'
        }
      ]
    },
    {
      id: 'testing',
      title: 'Testing Workflows',
      description: 'Prompts for durable Vitest and Playwright regression coverage.',
      prefix: 'Use existing test helpers, stable selectors, and visible user flows.',
      suffix: 'End with exact commands and mention any remaining coverage gap.',
      expanded: true,
      tone: 'blue',
      prompts: [
        {
          id: 'playwright',
          title: 'Write Playwright coverage',
          folder: 'Testing Workflows',
          updated: 'Yesterday',
          status: 'in-progress',
          content:
            'Add Playwright coverage for adding a prompt, typing in the editor, navigating away, and returning to verify content and focus state.'
        },
        {
          id: 'memfs',
          title: 'Add memfs persistence test',
          folder: 'Testing Workflows',
          updated: 'Jun 20',
          status: 'todo',
          content:
            'Add a Vitest case that writes a prompt into a nested folder, reloads the workspace, and verifies prompt order and folder metadata are preserved.'
        }
      ]
    },
    {
      id: 'release',
      title: 'Release Notes',
      description: 'Prompts for concise, user-facing summaries of recent changes.',
      prefix: 'Focus on visible behavior, workflow improvements, and settings.',
      suffix: 'Keep implementation details out unless they affect upgrades.',
      expanded: false,
      tone: 'amber',
      prompts: [
        {
          id: 'release-notes',
          title: 'Draft release notes',
          folder: 'Release Notes',
          updated: 'Jun 12',
          status: 'completed',
          content: 'Summarize recent prompt folder changes for a release note.'
        },
        {
          id: 'settings',
          title: 'Polish settings controls',
          folder: 'Release Notes',
          updated: 'Jun 8',
          status: 'todo',
          content: 'Tighten settings controls so inputs, toggles, and labels align consistently.'
        }
      ]
    }
  ])

  const nextStatus = (status: Status): Status =>
    status === 'todo' ? 'in-progress' : status === 'in-progress' ? 'completed' : 'todo'
  const statusLabel = (status: Status) =>
    status === 'in-progress' ? 'In progress' : status === 'completed' ? 'Completed' : 'Todo'
  const matchesFilter = (prompt: Prompt) => filter === 'all' || prompt.status === filter
  const countStatus = (status: Status) =>
    [...loosePrompts, ...folders.flatMap((folder) => folder.prompts)].filter(
      (prompt) => prompt.status === status
    ).length

  const addPrompt = (folder: FolderGroup | null) => {
    const prompt: Prompt = {
      id: `new-${Date.now()}`,
      title: 'Untitled prompt',
      folder: folder?.title ?? 'Prompts',
      updated: 'Just now',
      status: 'todo',
      content: ''
    }
    if (folder) {
      folder.prompts.push(prompt)
      folder.expanded = true
    } else {
      loosePrompts.push(prompt)
    }
  }
</script>

{#snippet StatusIcon(status: Status)}
  {#if status === 'completed'}
    <CheckCircle2 size={15} aria-hidden="true" />
  {:else if status === 'in-progress'}
    <Clock3 size={15} aria-hidden="true" />
  {:else}
    <Circle size={15} aria-hidden="true" />
  {/if}
{/snippet}

{#snippet IconAction(label: string, icon: typeof Copy)}
  {@const ActionIcon = icon}
  <button class="icon-action" type="button" aria-label={label} title={label}>
    <ActionIcon size={16} aria-hidden="true" />
  </button>
{/snippet}

{#snippet PromptCard(prompt: Prompt)}
  <article class="prompt-card" data-status={prompt.status}>
    <div class="drag-handle" aria-hidden="true"><GripVertical size={16} /></div>
    <div class="prompt-main">
      <header class="prompt-header">
        <div class="document-mark"><FileText size={18} aria-hidden="true" /></div>
        <div class="title-stack">
          <input class="prompt-title" aria-label="Prompt title" bind:value={prompt.title} />
          <div class="prompt-meta">
            <span>{prompt.folder}</span><span class="meta-line"></span>
            <span>{prompt.content.split('\n').length} lines</span><span class="meta-line"></span>
            <span>{prompt.updated}</span>
          </div>
        </div>
        <div class="prompt-actions">
          {@render IconAction('Improve prompt', Sparkles)}
          {@render IconAction('Copy prompt', Copy)}
          {@render IconAction('Delete prompt', Trash2)}
          <button
            class="status-chip"
            data-status={prompt.status}
            type="button"
            aria-label={`Change status: ${statusLabel(prompt.status)}`}
            onclick={() => (prompt.status = nextStatus(prompt.status))}
          >
            {@render StatusIcon(prompt.status)}
            {statusLabel(prompt.status)}
          </button>
        </div>
      </header>
      <textarea
        class="prompt-content"
        aria-label={`${prompt.title} body`}
        bind:value={prompt.content}
        placeholder="Write your prompt…"
      ></textarea>
    </div>
  </article>
{/snippet}

<section class="visual-rework" data-testid="visual-rework-110724343">
  <header class="screen-header">
    <div>
      <div class="eyebrow"><Folder size={14} aria-hidden="true" /> Prompt folder</div>
      <h1>Prompts</h1>
    </div>
    <button class="primary-action" type="button" onclick={() => addPrompt(null)}>
      <Plus size={17} aria-hidden="true" /> New prompt
    </button>
  </header>

  <nav class="filter-bar" aria-label="Filter prompts">
    <button class:active={filter === 'all'} type="button" onclick={() => (filter = 'all')}
      >All <span>9</span></button
    >
    <button class:active={filter === 'todo'} type="button" onclick={() => (filter = 'todo')}
      >Todo <span>{countStatus('todo')}</span></button
    >
    <button
      class:active={filter === 'in-progress'}
      type="button"
      onclick={() => (filter = 'in-progress')}
      >In progress <span>{countStatus('in-progress')}</span></button
    >
    <button
      class:active={filter === 'completed'}
      type="button"
      onclick={() => (filter = 'completed')}
      >Completed <span>{countStatus('completed')}</span></button
    >
  </nav>

  <div class="content-flow">
    <section class="loose-section">
      <div class="section-heading">
        <div class="heading-label">
          <FileText size={16} aria-hidden="true" /><span>Unfiled</span><b>{loosePrompts.length}</b>
        </div>
        <button class="text-action" type="button" onclick={() => addPrompt(null)}
          ><Plus size={15} aria-hidden="true" /> Add prompt</button
        >
      </div>
      <div class="prompt-list">
        {#each loosePrompts.filter(matchesFilter) as prompt (prompt.id)}
          {@render PromptCard(prompt)}
        {/each}
      </div>
    </section>

    {#each folders as folder (folder.id)}
      <section class="folder-group" data-tone={folder.tone}>
        <header class="folder-header">
          <button
            class="folder-toggle"
            type="button"
            aria-expanded={folder.expanded}
            onclick={() => (folder.expanded = !folder.expanded)}
          >
            <span class="folder-chevron">
              {#if folder.expanded}<ChevronDown size={18} aria-hidden="true" />{:else}<ChevronRight
                  size={18}
                  aria-hidden="true"
                />{/if}
            </span>
            <span class="folder-icon"><Folder size={19} aria-hidden="true" /></span>
            <span class="folder-title-copy">
              <span class="folder-title-row"
                ><strong>{folder.title}</strong><span>{folder.prompts.length} prompts</span></span
              >
              <span>{folder.description}</span>
            </span>
          </button>
          <div class="folder-actions">
            {@render IconAction('Rename folder', Pencil)}
            {@render IconAction('More folder actions', MoreHorizontal)}
            <button class="folder-add" type="button" onclick={() => addPrompt(folder)}
              ><Plus size={15} aria-hidden="true" /> Prompt</button
            >
          </div>
        </header>

        {#if folder.expanded}
          <div class="folder-context">
            <label><span>Description</span><input bind:value={folder.description} /></label>
            <label><span>Prefix</span><input bind:value={folder.prefix} /></label>
            <label><span>Suffix</span><input bind:value={folder.suffix} /></label>
          </div>
          <div class="folder-prompts">
            {#each folder.prompts.filter(matchesFilter) as prompt (prompt.id)}
              {@render PromptCard(prompt)}
            {/each}
            <button class="add-row" type="button" onclick={() => addPrompt(folder)}
              ><Plus size={15} aria-hidden="true" /> Add prompt to {folder.title}</button
            >
          </div>
        {/if}
      </section>
    {/each}

    <button class="new-folder" type="button"
      ><Plus size={16} aria-hidden="true" /> New subfolder</button
    >
  </div>
</section>

<style>
  .visual-rework {
    --violet: oklch(0.76 0.12 300);
    --blue: oklch(0.75 0.1 245);
    --amber: oklch(0.82 0.12 78);
    box-sizing: border-box;
    color: var(--ui-normal-text);
    padding: 24px 26px 48px;
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
  .screen-header {
    align-items: end;
    display: flex;
    justify-content: space-between;
    margin-bottom: 18px;
  }
  .screen-header h1 {
    font-size: 27px;
    letter-spacing: -0.03em;
    line-height: 1;
    margin: 7px 0 0;
  }
  .eyebrow {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 12px;
    gap: 6px;
  }
  .primary-action,
  .folder-add {
    align-items: center;
    background: var(--ui-accent-action-fill);
    border: 1px solid var(--ui-accent-normal-border);
    border-radius: 8px;
    cursor: pointer;
    display: inline-flex;
    font-size: 13px;
    font-weight: 650;
    gap: 6px;
    padding: 8px 12px;
  }
  .primary-action:hover,
  .folder-add:hover {
    background: var(--ui-accent-action-hover-fill);
  }
  .filter-bar {
    border-bottom: 1px solid var(--ui-neutral-normal-border);
    display: flex;
    gap: 6px;
    margin-bottom: 22px;
  }
  .filter-bar button {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: var(--ui-muted-text);
    cursor: pointer;
    margin-bottom: -1px;
    padding: 8px 10px 10px;
  }
  .filter-bar button span {
    background: var(--ui-neutral-normal-surface);
    border-radius: 999px;
    font-size: 11px;
    margin-left: 4px;
    padding: 2px 6px;
  }
  .filter-bar button.active {
    border-bottom-color: var(--violet);
    color: var(--ui-normal-text);
  }
  .content-flow {
    display: grid;
    gap: 18px;
  }
  .loose-section {
    display: grid;
    gap: 9px;
  }
  .section-heading {
    align-items: center;
    display: flex;
    justify-content: space-between;
    padding: 0 5px;
  }
  .heading-label {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    font-size: 13px;
    font-weight: 650;
    gap: 7px;
  }
  .heading-label b {
    background: var(--ui-neutral-normal-surface);
    border-radius: 999px;
    font-size: 11px;
    padding: 2px 7px;
  }
  .text-action {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-secondary-text);
    cursor: pointer;
    display: flex;
    font-size: 12px;
    gap: 5px;
  }
  .text-action:hover {
    color: var(--ui-normal-text);
  }
  .prompt-list,
  .folder-prompts {
    display: grid;
    gap: 9px;
  }
  .prompt-card {
    background: linear-gradient(
      105deg,
      var(--ui-card-normal-surface-gradient-start),
      var(--ui-card-normal-surface-gradient-end)
    );
    border: 1px solid var(--ui-card-normal-border);
    border-left: 3px solid var(--ui-neutral-focus-border);
    border-radius: 10px;
    box-shadow: 0 5px 18px var(--ui-card-normal-shadow);
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
  }
  .prompt-card[data-status='in-progress'] {
    border-left-color: var(--amber);
  }
  .prompt-card[data-status='completed'] {
    border-left-color: var(--ui-success-normal-text);
  }
  .drag-handle {
    align-items: center;
    border-right: 1px solid var(--ui-neutral-muted-border);
    color: var(--ui-muted-icon-glyph);
    cursor: grab;
    display: flex;
    justify-content: center;
  }
  .prompt-main {
    min-width: 0;
  }
  .prompt-header {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 34px minmax(180px, 1fr) auto;
    min-width: 0;
    padding: 9px 10px 9px 12px;
  }
  .document-mark {
    align-items: center;
    background: var(--ui-neutral-normal-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 8px;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
    height: 32px;
    justify-content: center;
    width: 32px;
  }
  .title-stack {
    display: grid;
    gap: 3px;
    min-width: 0;
  }
  .prompt-title {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 650;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }
  .prompt-meta {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    font-size: 11px;
    gap: 7px;
    overflow: hidden;
    white-space: nowrap;
  }
  .meta-line {
    background: var(--ui-neutral-normal-border);
    height: 10px;
    width: 1px;
  }
  .prompt-actions {
    align-items: center;
    display: flex;
    gap: 4px;
  }
  .icon-action {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: var(--ui-secondary-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    height: 30px;
    justify-content: center;
    padding: 0;
    width: 30px;
  }
  .icon-action:hover {
    background: var(--ui-neutral-action-hover-fill);
    color: var(--ui-hoverable-icon-glyph);
  }
  .status-chip {
    align-items: center;
    background: transparent;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 999px;
    color: var(--ui-secondary-text);
    cursor: pointer;
    display: flex;
    font-size: 12px;
    gap: 6px;
    justify-content: center;
    margin-left: 4px;
    min-width: 104px;
    padding: 5px 10px;
  }
  .status-chip[data-status='in-progress'] {
    border-color: var(--ui-warning-normal-border);
    color: var(--ui-warning-icon-glyph);
  }
  .status-chip[data-status='completed'] {
    border-color: var(--ui-success-normal-border);
    color: var(--ui-success-normal-text);
  }
  .prompt-content {
    background: var(--ui-editor-normal-surface);
    border: 0;
    border-top: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    color: var(--ui-normal-text);
    display: block;
    font-family: 'Cascadia Code', Consolas, monospace;
    font-size: 13px;
    line-height: 1.55;
    min-height: 88px;
    outline: none;
    padding: 13px 16px 15px;
    resize: vertical;
    width: 100%;
  }
  .folder-group {
    --folder-accent: var(--violet);
    --folder-wash: oklch(0.62 0.16 300 / 9%);
    background: linear-gradient(145deg, var(--folder-wash), transparent 60%);
    border: 1px solid color-mix(in oklch, var(--folder-accent) 25%, transparent);
    border-radius: 13px;
    overflow: hidden;
  }
  .folder-group[data-tone='blue'] {
    --folder-accent: var(--blue);
    --folder-wash: oklch(0.62 0.14 245 / 9%);
  }
  .folder-group[data-tone='amber'] {
    --folder-accent: var(--amber);
    --folder-wash: oklch(0.7 0.13 78 / 8%);
  }
  .folder-header {
    align-items: center;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    display: flex;
    min-width: 0;
    padding: 9px 11px 9px 9px;
  }
  .folder-toggle {
    align-items: center;
    background: transparent;
    border: 0;
    cursor: pointer;
    display: grid;
    flex: 1;
    gap: 9px;
    grid-template-columns: 24px 34px minmax(0, 1fr);
    min-width: 0;
    padding: 0;
    text-align: left;
  }
  .folder-chevron {
    color: var(--ui-secondary-icon-glyph);
    display: flex;
  }
  .folder-icon {
    align-items: center;
    background: color-mix(in oklch, var(--folder-accent) 14%, transparent);
    border: 1px solid color-mix(in oklch, var(--folder-accent) 30%, transparent);
    border-radius: 8px;
    color: var(--folder-accent);
    display: flex;
    height: 32px;
    justify-content: center;
    width: 32px;
  }
  .folder-title-copy {
    color: var(--ui-muted-text);
    display: grid;
    font-size: 11px;
    gap: 3px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .folder-title-row {
    align-items: baseline;
    display: flex;
    gap: 9px;
  }
  .folder-title-row strong {
    color: var(--ui-normal-text);
    font-size: 14px;
  }
  .folder-title-row span {
    color: var(--folder-accent);
    font-size: 11px;
    font-weight: 650;
  }
  .folder-actions {
    align-items: center;
    display: flex;
    gap: 4px;
    margin-left: 10px;
  }
  .folder-add {
    background: color-mix(in oklch, var(--folder-accent) 12%, transparent);
    border-color: color-mix(in oklch, var(--folder-accent) 28%, transparent);
    font-size: 12px;
    margin-left: 3px;
    padding: 6px 9px;
  }
  .folder-context {
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    display: grid;
    grid-template-columns: 1.15fr 1fr 1fr;
  }
  .folder-context label {
    display: grid;
    gap: 5px;
    min-width: 0;
    padding: 9px 12px 11px;
  }
  .folder-context label + label {
    border-left: 1px solid var(--ui-neutral-muted-border);
  }
  .folder-context label span {
    color: var(--folder-accent);
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .folder-context input {
    background: transparent;
    border: 0;
    color: var(--ui-secondary-text);
    font-size: 11px;
    min-width: 0;
    outline: none;
    overflow: hidden;
    padding: 0;
    text-overflow: ellipsis;
    width: 100%;
  }
  .folder-prompts {
    padding: 11px 11px 10px 34px;
    position: relative;
  }
  .folder-prompts::before {
    background: color-mix(in oklch, var(--folder-accent) 38%, transparent);
    bottom: 23px;
    content: '';
    left: 18px;
    position: absolute;
    top: 0;
    width: 1px;
  }
  .folder-prompts .prompt-card {
    box-shadow: 0 4px 14px var(--ui-card-normal-shadow);
  }
  .add-row {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-muted-text);
    cursor: pointer;
    display: flex;
    font-size: 11px;
    gap: 6px;
    justify-content: center;
    padding: 2px 8px;
  }
  .add-row:hover {
    color: var(--ui-normal-text);
  }
  .new-folder {
    align-items: center;
    align-self: start;
    background: transparent;
    border: 1px dashed var(--ui-neutral-focus-border);
    border-radius: 9px;
    color: var(--ui-secondary-text);
    cursor: pointer;
    display: flex;
    font-size: 12px;
    gap: 6px;
    padding: 8px 12px;
  }
  .new-folder:hover {
    background: var(--ui-neutral-subtle-action-hover-fill);
    color: var(--ui-normal-text);
  }
  @media (max-width: 900px) {
    .prompt-header {
      grid-template-columns: 32px minmax(0, 1fr);
    }
    .prompt-actions {
      grid-column: 2;
    }
    .folder-context {
      grid-template-columns: 1fr;
    }
    .folder-context label + label {
      border-left: 0;
      border-top: 1px solid var(--ui-neutral-muted-border);
    }
  }
</style>
