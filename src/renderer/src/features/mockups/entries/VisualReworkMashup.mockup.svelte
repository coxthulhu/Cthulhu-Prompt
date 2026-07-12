<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    Check,
    ChevronDown,
    ChevronRight,
    Circle,
    Clock3,
    Copy,
    Ellipsis,
    FileText,
    Folder,
    GripVertical,
    Pencil,
    Plus,
    Sparkles,
    Trash2
  } from 'lucide-svelte'
  import { monaco, PROMPT_EDITOR_THEME } from '@renderer/common/Monaco'
  import {
    getLineHeightPx,
    PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX,
    PROMPT_EDITOR_BODY_PADDING_LEFT_PX,
    PROMPT_EDITOR_BODY_PADDING_RIGHT_PX,
    PROMPT_EDITOR_BODY_PADDING_TOP_PX
  } from '@renderer/features/prompt-editor/promptEditorSizing'

  type PromptStatus = 'todo' | 'in-progress' | 'completed'

  type Prompt = {
    id: string
    title: string
    folder: string
    updated: string
    status: PromptStatus
    body: string
  }

  type FolderGroup = {
    id: string
    title: string
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
      folder: 'Prompts',
      updated: '2 min ago',
      status: 'in-progress',
      body: 'Review the imported workspace prompts and group them by project area, risk, and expected follow-up owner.\n\nReturn a short list of prompts that should move into subfolders and note any duplicated instructions.'
    },
    {
      id: 'front-matter',
      title: 'Clean workspace front matter',
      folder: 'Prompts',
      updated: '18 min ago',
      status: 'completed',
      body: 'Normalize prompt front matter for the current workspace.\n\nKeep titles stable, preserve folder assignments, and report any fields that cannot be mapped safely.'
    }
  ])

  let folders = $state<FolderGroup[]>([
    {
      id: 'architecture',
      title: 'Architecture Reviews',
      description: 'Reusable review prompts for large renderer and main-process changes.',
      prefix: 'You are reviewing Cthulhu Prompt architecture changes. Prioritize data flow, IPC boundaries, persistence behavior, and renderer state ownership.',
      suffix: 'Group findings by severity. Include file references and the smallest verification path for each issue.',
      expanded: true,
      prompts: [
        {
          id: 'import-edges',
          title: 'Outline workspace import edge cases',
          folder: 'Architecture Reviews',
          updated: '24 min ago',
          status: 'todo',
          body: 'Review the workspace import flow and identify edge cases around missing folders, duplicate prompt titles, and malformed front matter.\n\nReturn the findings as concrete bugs with file references and suggested tests.'
        },
        {
          id: 'sizing-controller',
          title: 'Refactor editor sizing controller',
          folder: 'Architecture Reviews',
          updated: '41 min ago',
          status: 'completed',
          body: 'Refactor the prompt editor sizing logic so height estimation, measured height caching, and Monaco relayout are easier to reason about.\n\nKeep the behavior unchanged and add focused regression coverage for wrapped lines.'
        },
        {
          id: 'drag-persistence',
          title: 'Review drag and drop persistence',
          folder: 'Architecture Reviews',
          updated: '1 hr ago',
          status: 'todo',
          body: 'Code review the prompt tree drag/drop implementation. Focus on persistence order, optimistic UI state, and recovery when a drop target disappears.'
        }
      ]
    },
    {
      id: 'testing',
      title: 'Testing Workflows',
      description: 'Prompts for Vitest and Playwright coverage work.',
      prefix: 'Use the existing test helpers. Prefer stable selectors and assert the visible user flow before checking implementation details.',
      suffix: 'End with the exact commands that should be run. Mention any coverage gap that remains.',
      expanded: true,
      prompts: [
        {
          id: 'playwright-coverage',
          title: 'Write Playwright coverage',
          folder: 'Testing Workflows',
          updated: 'Yesterday',
          status: 'completed',
          body: 'Add Playwright coverage for adding a prompt, typing in the editor, navigating away, and returning to verify content and focus state.'
        },
        {
          id: 'memfs-test',
          title: 'Add memfs persistence test',
          folder: 'Testing Workflows',
          updated: 'Jun 20',
          status: 'in-progress',
          body: 'Add a Vitest case that writes a prompt into a nested folder, reloads the workspace, and verifies the prompt order and folder metadata are preserved.'
        }
      ]
    },
    {
      id: 'release',
      title: 'Release Notes',
      description: 'Prompts for converting recent changes into concise user-facing release notes.',
      prefix: 'Focus on visible behavior, workflow improvements, and settings that users need to revisit.',
      suffix: 'Keep implementation details out unless they affect upgrade behavior.',
      expanded: false,
      prompts: [
        {
          id: 'release-notes',
          title: 'Draft release notes',
          folder: 'Release Notes',
          updated: 'Jun 12',
          status: 'todo',
          body: 'Summarize the recent prompt folder changes for a release note.'
        }
      ]
    }
  ])

  const statusLabel = (status: PromptStatus) => {
    if (status === 'completed') return 'Completed'
    if (status === 'in-progress') return 'In progress'
    return 'Todo'
  }

  const lineCount = (body: string) => body.split('\n').length
  const wordCount = (body: string) => body.trim().split(/\s+/).filter(Boolean).length

  const sizingConfig = {
    fontSize: 15,
    minLines: 3,
    maxLines: 10
  }
  const lineHeightPx = getLineHeightPx(sizingConfig.fontSize)
  const minEditorHeightPx = lineHeightPx * sizingConfig.minLines
  const maxEditorHeightPx = lineHeightPx * sizingConfig.maxLines
  const clampEditorHeight = (heightPx: number): number =>
    Math.min(Math.max(heightPx, minEditorHeightPx), maxEditorHeightPx)

  const getEditorUri = (promptId: string) =>
    monaco.Uri.file(`/cthulhu-prompt/mockups/visual-rework-mashup/${promptId}.md`)

  const toggleFolder = (folderId: string) => {
    folders = folders.map((folder) =>
      folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder
    )
  }

  const cycleStatus = (promptId: string) => {
    const nextStatus = (status: PromptStatus): PromptStatus =>
      status === 'todo' ? 'in-progress' : status === 'in-progress' ? 'completed' : 'todo'
    const update = (prompt: Prompt) =>
      prompt.id === promptId ? { ...prompt, status: nextStatus(prompt.status) } : prompt
    loosePrompts = loosePrompts.map(update)
    folders = folders.map((folder) => ({ ...folder, prompts: folder.prompts.map(update) }))
  }

  const editorCleanupCallbacks = new SvelteSet<() => void>()

  const createEditor = (host: HTMLElement, prompt: Prompt) => {
    const uri = getEditorUri(prompt.id)
    const existingModel = monaco.editor.getModel(uri)
    const model = existingModel ?? monaco.editor.createModel(prompt.body, 'markdown', uri)
    model.setValue(prompt.body)

    const editor = monaco.editor.create(host, {
      model,
      theme: PROMPT_EDITOR_THEME,
      automaticLayout: true,
      fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: sizingConfig.fontSize,
      lineHeight: lineHeightPx,
      minimap: { enabled: false },
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      scrollbar: {
        alwaysConsumeMouseWheel: false
      },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      wordWrapColumn: 80,
      revealHorizontalRightPadding: 0,
      cursorSmoothCaretAnimation: 'off',
      smoothScrolling: false,
      renderLineHighlightOnlyWhenFocus: true,
      renderValidationDecorations: 'off',
      dimension: {
        width: Math.max(1, host.clientWidth),
        height: clampEditorHeight(lineHeightPx * lineCount(prompt.body))
      }
    })

    const syncHeight = () => {
      const heightPx = clampEditorHeight(Math.ceil(editor.getContentHeight()))
      host.style.height = `${heightPx}px`
      editor.layout({ width: Math.max(1, host.clientWidth), height: heightPx })
    }

    syncHeight()
    const contentSizeDisposable = editor.onDidContentSizeChange(syncHeight)
    const contentDisposable = editor.onDidChangeModelContent(() => {
      prompt.body = editor.getValue()
    })

    let isDisposed = false
    const cleanup = () => {
      if (isDisposed) return
      isDisposed = true
      contentSizeDisposable.dispose()
      contentDisposable.dispose()
      editor.dispose()
      if (!existingModel) {
        model.dispose()
      }
    }

    editorCleanupCallbacks.add(cleanup)

    return () => {
      cleanup()
      editorCleanupCallbacks.delete(cleanup)
    }
  }

  const mountMockupMonaco = (node: HTMLElement, prompt: Prompt) => {
    // Side effect: create a Monaco editor for this mock prompt and dispose it on teardown.
    const destroy = createEditor(node, prompt)

    return { destroy }
  }

  // Side effect: dispose any Monaco instances whose host action has not already cleaned up.
  onDestroy(() => {
    for (const cleanup of editorCleanupCallbacks) {
      cleanup()
    }
    editorCleanupCallbacks.clear()
  })
</script>

{#snippet StatusIcon(status: PromptStatus)}
  {#if status === 'completed'}
    <Check size={14} strokeWidth={2.6} aria-hidden="true" />
  {:else if status === 'in-progress'}
    <Clock3 size={14} strokeWidth={2.2} aria-hidden="true" />
  {:else}
    <Circle size={13} strokeWidth={2.2} aria-hidden="true" />
  {/if}
{/snippet}

{#snippet AddRow(label: string)}
  <button class="add-row" type="button">
    <span></span>
    <span class="add-row-action"><Plus size={13} aria-hidden="true" />{label}</span>
    <span></span>
  </button>
{/snippet}

{#snippet PromptCard(prompt: Prompt)}
  <article class="prompt-card">
    <button class="drag-handle" type="button" aria-label={`Move ${prompt.title}`}>
      <GripVertical size={16} aria-hidden="true" />
    </button>

    <div class="prompt-content">
      <header class="prompt-header">
        <div class="title-status-bar" data-status={prompt.status} aria-hidden="true"></div>
        <div class="prompt-heading">
          <span class="document-icon"><FileText size={18} aria-hidden="true" /></span>
          <div class="prompt-title-block">
            <input value={prompt.title} aria-label="Prompt title" />
            <div class="prompt-meta">
              <span>{prompt.folder}</span>
              <i></i>
              <span>{lineCount(prompt.body)} lines</span>
              <i></i>
              <span>{wordCount(prompt.body)} words</span>
              <i></i>
              <span>{prompt.updated}</span>
            </div>
          </div>
        </div>

        <div class="prompt-actions">
          <button class="icon-button" type="button" aria-label="Improve prompt" title="Improve prompt">
            <Sparkles size={15} aria-hidden="true" />
          </button>
          <button class="icon-button" type="button" aria-label="Copy prompt" title="Copy prompt">
            <Copy size={15} aria-hidden="true" />
          </button>
          <button class="icon-button danger" type="button" aria-label="Delete prompt" title="Delete prompt">
            <Trash2 size={15} aria-hidden="true" />
          </button>
          <span class="action-divider"></span>
          <button
            class="status-button"
            data-status={prompt.status}
            type="button"
            aria-label={`Change status: ${statusLabel(prompt.status)}`}
            onclick={() => cycleStatus(prompt.id)}
          >
            {@render StatusIcon(prompt.status)}
            {statusLabel(prompt.status)}
          </button>
        </div>
      </header>

      <div
        class="prompt-monaco-shell"
        style={`padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
      >
        <div
          class="prompt-monaco-host"
          aria-label={`${prompt.title} body`}
          use:mountMockupMonaco={prompt}
        ></div>
      </div>
    </div>
  </article>
{/snippet}

{#snippet FolderContext(folder: FolderGroup)}
  <div class="folder-context">
    <section>
      <span>Folder description</span>
      <p>{folder.description}</p>
    </section>
    <section>
      <span>Prefix</span>
      <p>{folder.prefix}</p>
    </section>
    <section>
      <span>Suffix</span>
      <p>{folder.suffix}</p>
    </section>
  </div>
{/snippet}

<section class="visual-rework" data-testid="visual-rework-110510351">
  <div class="prompt-stream">
    {@render AddRow('Add prompt')}
    {#each loosePrompts as prompt (prompt.id)}
      {@render PromptCard(prompt)}
      {@render AddRow('Add prompt')}
    {/each}

    {#each folders as folder (folder.id)}
      <article class="folder-group" data-expanded={folder.expanded}>
        <header class="folder-header">
          <button
            class="folder-toggle"
            type="button"
            aria-label={folder.expanded ? 'Collapse folder' : 'Expand folder'}
            aria-expanded={folder.expanded}
            onclick={() => toggleFolder(folder.id)}
          >
            {#if folder.expanded}
              <ChevronDown size={17} aria-hidden="true" />
            {:else}
              <ChevronRight size={17} aria-hidden="true" />
            {/if}
          </button>
          <span class="folder-icon"><Folder size={19} aria-hidden="true" /></span>
          <button class="folder-name" type="button" onclick={() => toggleFolder(folder.id)}>
            {folder.title}
          </button>
          <span class="folder-count">{folder.prompts.length} prompts</span>
          <button class="icon-button" type="button" aria-label="Rename folder" title="Rename folder">
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button class="icon-button" type="button" aria-label="Folder options" title="Folder options">
            <Ellipsis size={17} aria-hidden="true" />
          </button>
        </header>

        {#if folder.expanded}
          {@render FolderContext(folder)}
          <div class="folder-prompts">
            {@render AddRow('Add prompt')}
            {#each folder.prompts as prompt (prompt.id)}
              {@render PromptCard(prompt)}
              {@render AddRow('Add prompt')}
            {/each}
          </div>
        {/if}
      </article>
      {@render AddRow('Add folder')}
    {/each}
  </div>
</section>

<style>
  .visual-rework {
    box-sizing: border-box;
    color: var(--ui-normal-text);
    min-width: 0;
    padding: 2px 0 12px;
    width: 100%;
  }

  .visual-rework button,
  .visual-rework input {
    font-family: inherit;
  }

  .prompt-stream,
  .folder-prompts {
    display: grid;
    min-width: 0;
  }

  .add-row {
    align-items: center;
    background: transparent;
    border: 0;
    color: var(--ui-muted-text);
    cursor: pointer;
    display: grid;
    grid-template-columns: minmax(14px, 1fr) auto minmax(14px, 1fr);
    height: 28px;
    padding: 0;
    width: 100%;
  }

  .add-row > span:not(.add-row-action) {
    background: var(--ui-neutral-muted-border);
    height: 1px;
    transition: background 120ms ease;
  }

  .add-row-action {
    align-items: center;
    display: flex;
    font-size: 12px;
    gap: 4px;
    line-height: 16px;
    opacity: 0;
    padding: 0 9px;
    transition: opacity 120ms ease, color 120ms ease;
  }

  .add-row-action :global(svg) {
    display: block;
    flex: 0 0 auto;
  }

  .add-row:hover > span:not(.add-row-action) {
    background: var(--ui-accent-normal-border);
  }

  .add-row:hover .add-row-action,
  .add-row:focus-visible .add-row-action {
    color: var(--ui-accent-normal-text);
    opacity: 1;
  }

  .prompt-card {
    align-items: stretch;
    background: linear-gradient(115deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end));
    border: 1px solid var(--ui-card-normal-border);
    border-radius: 9px;
    box-shadow: 0 8px 20px var(--ui-card-normal-shadow);
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
  }

  .drag-handle {
    align-items: center;
    background: oklch(0.22 0.008 275);
    border: 0;
    border-right: 1px solid var(--ui-neutral-muted-border);
    color: var(--ui-muted-icon-glyph);
    cursor: grab;
    display: flex;
    justify-content: center;
    padding: 0;
  }

  .drag-handle:hover {
    color: var(--ui-hoverable-icon-glyph);
  }

  .prompt-content {
    background: oklch(0.22 0.008 275);
    min-width: 0;
  }

  .prompt-header {
    align-items: center;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    display: grid;
    gap: 12px;
    grid-template-columns: 2px minmax(0, 1fr) auto;
    min-height: 58px;
    padding: 7px 9px 7px 0;
  }

  .title-status-bar {
    align-self: stretch;
    margin-block: -7px;
  }

  .title-status-bar[data-status='todo'] {
    visibility: hidden;
  }

  .title-status-bar[data-status='completed'] {
    background: var(--ui-success-normal-text);
  }

  .title-status-bar[data-status='in-progress'] {
    background: var(--ui-warning-icon-glyph);
  }

  .prompt-heading {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 32px minmax(0, 1fr);
    min-width: 0;
  }

  .document-icon,
  .folder-icon {
    align-items: center;
    background: var(--ui-neutral-normal-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: 7px;
    color: var(--ui-secondary-icon-glyph);
    display: inline-flex;
    height: 30px;
    justify-content: center;
    width: 30px;
  }

  .prompt-title-block {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .prompt-title-block input {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .prompt-meta {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    font-size: 12px;
    gap: 7px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .prompt-meta i {
    background: var(--ui-muted-icon-glyph);
    border-radius: 50%;
    flex: 0 0 2px;
    height: 2px;
    width: 2px;
  }

  .prompt-actions {
    align-items: center;
    display: flex;
    gap: 3px;
  }

  .icon-button {
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

  .icon-button:hover {
    background: var(--ui-neutral-action-hover-fill);
    color: var(--ui-hoverable-icon-glyph);
  }

  .icon-button.danger:hover {
    background: var(--ui-danger-normal-surface);
    color: var(--ui-danger-icon-glyph);
  }

  .action-divider {
    background: var(--ui-neutral-normal-border);
    height: 24px;
    margin: 0 5px;
    width: 1px;
  }

  .status-button {
    align-items: center;
    background: var(--ui-neutral-normal-surface);
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 7px;
    color: var(--ui-secondary-text);
    cursor: pointer;
    display: flex;
    font-size: 12px;
    font-weight: 600;
    gap: 6px;
    height: 30px;
    justify-content: center;
    min-width: 96px;
    padding: 0 10px;
  }

  .status-button[data-status='completed'] {
    background: oklch(0.45 0.12 154 / 14%);
    border-color: var(--ui-success-normal-border);
    color: var(--ui-success-normal-text);
  }

  .status-button[data-status='in-progress'] {
    background: var(--ui-warning-normal-surface);
    border-color: var(--ui-warning-normal-border);
    color: var(--ui-warning-icon-glyph);
  }

  .prompt-monaco-shell {
    background: #121314;
    box-sizing: border-box;
    min-width: 0;
  }

  .prompt-monaco-host {
    min-height: 60px;
    min-width: 0;
    position: relative;
    width: 100%;
  }

  .folder-group {
    background: oklch(0.19 0.014 275 / 70%);
    border: 1px solid oklch(0.66 0.12 294 / 25%);
    border-radius: 11px;
    box-shadow: 0 10px 28px oklch(0 0 0 / 22%);
    min-width: 0;
    overflow: hidden;
  }

  .folder-header {
    align-items: center;
    background: linear-gradient(90deg, oklch(0.34 0.06 290 / 38%), oklch(0.22 0.025 275 / 18%));
    border-bottom: 1px solid oklch(0.7 0.12 294 / 14%);
    display: grid;
    gap: 8px;
    grid-template-columns: 28px 32px minmax(0, auto) 1fr 30px 30px;
    min-height: 54px;
    padding: 0 10px 0 11px;
  }

  .folder-group[data-expanded='false'] .folder-header {
    border-bottom: 0;
  }

  .folder-toggle {
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

  .folder-toggle:hover {
    background: var(--ui-neutral-action-hover-fill);
    color: var(--ui-hoverable-icon-glyph);
  }

  .folder-icon {
    background: oklch(0.57 0.16 295 / 16%);
    border-color: oklch(0.76 0.12 295 / 22%);
    color: oklch(0.83 0.11 295);
  }

  .folder-name {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    cursor: pointer;
    font-size: 15px;
    font-weight: 700;
    min-width: 0;
    overflow: hidden;
    padding: 0;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-count {
    color: var(--ui-muted-text);
    font-size: 11px;
    justify-self: start;
    margin-left: 3px;
  }

  .folder-context {
    background: oklch(0.17 0.01 275 / 62%);
    display: grid;
    grid-template-columns: 0.8fr 1.4fr 1.1fr;
    min-width: 0;
  }

  .folder-context section {
    min-width: 0;
    padding: 11px 14px 12px;
  }

  .folder-context section + section {
    border-left: 1px solid var(--ui-neutral-muted-border);
  }

  .folder-context span {
    color: oklch(0.82 0.09 295);
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    margin-bottom: 5px;
    text-transform: uppercase;
  }

  .folder-context p {
    color: var(--ui-secondary-text);
    display: -webkit-box;
    font-size: 11px;
    line-height: 1.45;
    margin: 0;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .folder-prompts {
    border-top: 1px solid var(--ui-neutral-muted-border);
    padding: 0 12px 12px;
  }

  .folder-prompts .prompt-card {
    box-shadow: 0 5px 16px oklch(0 0 0 / 18%);
  }

  @media (max-width: 900px) {
    .prompt-header {
      align-items: stretch;
      grid-template-columns: 2px minmax(0, 1fr);
    }

    .prompt-actions {
      grid-column: 2;
      justify-content: flex-end;
    }

    .title-status-bar {
      grid-row: 1 / span 2;
    }

    .folder-context {
      grid-template-columns: 1fr;
    }

    .folder-context section + section {
      border-left: 0;
      border-top: 1px solid var(--ui-neutral-muted-border);
    }
  }
</style>
