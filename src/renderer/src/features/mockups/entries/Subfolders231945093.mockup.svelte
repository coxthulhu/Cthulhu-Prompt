<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import {
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    GripVertical,
    Pencil,
    Plus
  } from 'lucide-svelte'
  import { monaco, PROMPT_EDITOR_THEME } from '@renderer/common/Monaco'
  import PromptEditorButtonBar from '@renderer/features/prompt-editor/PromptEditorButtonBar.svelte'
  import PromptDivider from '@renderer/features/prompt-editor/PromptDivider.svelte'
  import PromptEditorSidebar from '@renderer/features/prompt-editor/PromptEditorSidebar.svelte'
  import {
    getLineHeightPx,
    PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX,
    PROMPT_EDITOR_BODY_PADDING_LEFT_PX,
    PROMPT_EDITOR_BODY_PADDING_RIGHT_PX,
    PROMPT_EDITOR_BODY_PADDING_TOP_PX,
    PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX
  } from '@renderer/features/prompt-editor/promptEditorSizing'

  type MockPrompt = {
    id: string
    title: string
    folder: string
    subfolderId: string
    modifiedLabel: string
    text: string
  }

  type MockSubfolder = {
    id: string
    title: string
    parentId: string | null
    isCollapsed: boolean
  }

  type VisibleFolderRow = {
    type: 'folder'
    id: string
    subfolder: MockSubfolder
    depth: number
    lineage: string[]
  }

  type VisibleDividerRow = {
    type: 'divider'
    id: string
    previousPromptId: string | null
    subfolderId: string
    depth: number
    lineage: string[]
  }

  type VisiblePromptRow = {
    type: 'prompt'
    id: string
    prompt: MockPrompt
    promptIndex: number
    depth: number
    lineage: string[]
  }

  type VisibleRow = VisibleFolderRow | VisibleDividerRow | VisiblePromptRow

  let mockSubfolders = $state<MockSubfolder[]>([
    {
      id: 'mockup-subfolder-planning',
      title: 'Planning flows',
      parentId: null,
      isCollapsed: false
    },
    {
      id: 'mockup-subfolder-review',
      title: 'Review passes',
      parentId: null,
      isCollapsed: false
    },
    {
      id: 'mockup-subfolder-regression',
      title: 'Regression checks',
      parentId: 'mockup-subfolder-review',
      isCollapsed: false
    },
    {
      id: 'mockup-subfolder-maintenance',
      title: 'Maintenance',
      parentId: null,
      isCollapsed: true
    }
  ])

  let mockPrompts = $state<MockPrompt[]>([
    {
      id: 'mockup-outline',
      title: 'Outline workspace import edge cases',
      folder: 'Planning flows',
      subfolderId: 'mockup-subfolder-planning',
      modifiedLabel: 'Updated 2 min ago',
      text: [
        'Review the workspace import flow and identify any edge cases around missing folders, duplicate prompt titles, and malformed front matter.',
        '',
        'Return the findings as concrete bugs with file references and suggested tests.',
        '',
        'Include scenarios for partially written workspace files, prompts that reference folders removed during import, and imports where the destination workspace already has similarly named prompts.',
        '',
        'Separate confirmed issues from follow-up questions. Do not include general cleanup notes unless they can cause data loss or a visible recovery problem.'
      ].join('\n')
    },
    {
      id: 'mockup-refactor',
      title: 'Refactor editor sizing controller',
      folder: 'Planning flows',
      subfolderId: 'mockup-subfolder-planning',
      modifiedLabel: 'Updated 18 min ago',
      text: [
        'Refactor the prompt editor sizing logic so height estimation, measured height caching, and Monaco relayout are easier to reason about.',
        '',
        'Keep the behavior unchanged and add focused regression coverage for wrapped lines.'
      ].join('\n')
    },
    {
      id: 'mockup-review',
      title: 'Review drag and drop persistence',
      folder: 'Review passes',
      subfolderId: 'mockup-subfolder-review',
      modifiedLabel: 'Updated 1 hr ago',
      text: [
        'Code review the prompt tree drag/drop implementation. Focus on persistence order, optimistic UI state, and recovery when a drop target disappears.',
        '',
        'List only issues that can produce user-visible regressions.',
        '',
        'Pay special attention to cross-folder moves, moving the first or last prompt in a folder, cancelled drags, and drops that happen while the target folder is collapsed.',
        '',
        'For each finding, include the smallest user flow that reproduces it and the assertion a Playwright test should make.'
      ].join('\n')
    },
    {
      id: 'mockup-tests',
      title: 'Write Playwright coverage',
      folder: 'Regression checks',
      subfolderId: 'mockup-subfolder-regression',
      modifiedLabel: 'Updated yesterday',
      text: [
        'Add Playwright coverage for adding a prompt, typing in the Monaco editor, navigating away, and returning to verify content and focus state.',
        '',
        'Use the existing test helpers and data-testid selectors.',
        '',
        'Cover the add button above the first prompt and the add button after an existing prompt. Verify the new row appears in the expected position before typing.',
        '',
        'After navigation, assert that the prompt order, title text, Monaco body text, and selected folder are still restored.'
      ].join('\n')
    },
    {
      id: 'mockup-release',
      title: 'Draft release notes',
      folder: 'Review passes',
      subfolderId: 'mockup-subfolder-review',
      modifiedLabel: 'Updated Jun 12',
      text: [
        'Summarize the recent prompt folder changes for a release note. Focus on visible user-facing behavior, workflow improvements, and any test coverage added.',
        '',
        'Keep the tone concise and avoid implementation details unless they affect users directly.'
      ].join('\n')
    },
    {
      id: 'mockup-polish',
      title: 'Polish settings controls',
      folder: 'Maintenance',
      subfolderId: 'mockup-subfolder-maintenance',
      modifiedLabel: 'Updated Jun 8',
      text: [
        'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
        '',
        'Stay within the existing palette and cthulhu-ui component conventions.'
      ].join('\n')
    }
  ])

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

  const getLineCount = (text: string): number => Math.max(1, text.split('\n').length)
  const getTokenCount = (text: string): number => {
    const trimmed = text.trim()
    if (trimmed.length === 0) return 0
    return trimmed.split(/\s+/).length
  }

  const getEditorUri = (promptId: string) =>
    monaco.Uri.file(`/cthulhu-prompt/mockups/prompt-folder-base/${promptId}.md`)

  let nextPromptSequence = $state(1)
  let nextSubfolderSequence = $state(1)

  const getChildSubfolders = (parentId: string | null): MockSubfolder[] =>
    mockSubfolders.filter((subfolder) => subfolder.parentId === parentId)

  const getSubfolderById = (subfolderId: string): MockSubfolder | undefined =>
    mockSubfolders.find((subfolder) => subfolder.id === subfolderId)

  const getDirectPrompts = (subfolderId: string): MockPrompt[] =>
    mockPrompts.filter((prompt) => prompt.subfolderId === subfolderId)

  const getPromptLabel = (count: number) => `${count} ${count === 1 ? 'prompt' : 'prompts'}`
  const getSubfolderLabel = (count: number) =>
    `${count} ${count === 1 ? 'subfolder' : 'subfolders'}`

  const buildVisibleRows = (
    parentId: string | null,
    depth = 0,
    lineage: string[] = []
  ): VisibleRow[] => {
    const rows: VisibleRow[] = []

    for (const subfolder of getChildSubfolders(parentId)) {
      const nextLineage = [...lineage, subfolder.id]

      rows.push({
        type: 'folder',
        id: `folder-${subfolder.id}`,
        subfolder,
        depth,
        lineage: nextLineage
      })

      if (subfolder.isCollapsed) continue

      rows.push({
        type: 'divider',
        id: `divider-start-${subfolder.id}`,
        previousPromptId: null,
        subfolderId: subfolder.id,
        depth,
        lineage: nextLineage
      })

      for (const prompt of getDirectPrompts(subfolder.id)) {
        rows.push({
          type: 'prompt',
          id: `prompt-${prompt.id}`,
          prompt,
          promptIndex: mockPrompts.findIndex((mockPrompt) => mockPrompt.id === prompt.id),
          depth,
          lineage: nextLineage
        })
        rows.push({
          type: 'divider',
          id: `divider-after-${prompt.id}`,
          previousPromptId: prompt.id,
          subfolderId: subfolder.id,
          depth,
          lineage: nextLineage
        })
      }

      rows.push(...buildVisibleRows(subfolder.id, depth + 1, nextLineage))
    }

    return rows
  }

  let visibleRows = $derived(buildVisibleRows(null))

  const createNewPrompt = (subfolderId: string): MockPrompt => {
    const promptNumber = nextPromptSequence
    const subfolder = getSubfolderById(subfolderId)
    nextPromptSequence += 1

    return {
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folder: subfolder?.title ?? 'Prompts',
      subfolderId,
      modifiedLabel: 'Just now',
      text: ''
    }
  }

  const addPromptAfter = (previousPromptId: string | null, subfolderId: string) => {
    const nextPrompt = createNewPrompt(subfolderId)
    if (previousPromptId === null) {
      const firstPromptIndex = mockPrompts.findIndex((prompt) => prompt.subfolderId === subfolderId)
      if (firstPromptIndex === -1) {
        mockPrompts = [...mockPrompts, nextPrompt]
        return
      }

      const nextPrompts = [...mockPrompts]
      nextPrompts.splice(firstPromptIndex, 0, nextPrompt)
      mockPrompts = nextPrompts
      return
    }

    const previousPromptIndex = mockPrompts.findIndex((prompt) => prompt.id === previousPromptId)
    if (previousPromptIndex === -1) {
      mockPrompts = [...mockPrompts, nextPrompt]
      return
    }

    const nextPrompts = [...mockPrompts]
    nextPrompts.splice(previousPromptIndex + 1, 0, nextPrompt)
    mockPrompts = nextPrompts
  }

  const addSubfolder = (parentId: string) => {
    const subfolderNumber = nextSubfolderSequence
    nextSubfolderSequence += 1
    mockSubfolders = [
      ...mockSubfolders,
      {
        id: `mockup-subfolder-new-${subfolderNumber}`,
        title: `New subfolder ${subfolderNumber}`,
        parentId,
        isCollapsed: false
      }
    ]
  }

  const toggleSubfolder = (subfolderId: string) => {
    mockSubfolders = mockSubfolders.map((subfolder) =>
      subfolder.id === subfolderId
        ? { ...subfolder, isCollapsed: !subfolder.isCollapsed }
        : subfolder
    )
  }

  const movePrompt = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= mockPrompts.length) return

    const nextPrompts = [...mockPrompts]
    const [prompt] = nextPrompts.splice(index, 1)
    nextPrompts.splice(targetIndex, 0, prompt)
    mockPrompts = nextPrompts
  }

  const deletePrompt = (promptId: string) => {
    mockPrompts = mockPrompts.filter((prompt) => prompt.id !== promptId)
  }

  const noopPromptTreeDrop = () => undefined

  const editorCleanupCallbacks = new SvelteSet<() => void>()

  const createEditor = (host: HTMLElement, prompt: MockPrompt) => {
    const existingModel = monaco.editor.getModel(getEditorUri(prompt.id))
    const model =
      existingModel ?? monaco.editor.createModel(prompt.text, 'markdown', getEditorUri(prompt.id))
    model.setValue(prompt.text)

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
        height: clampEditorHeight(lineHeightPx * getLineCount(prompt.text))
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
      prompt.text = editor.getValue()
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

  const mountMockupMonaco = (node: HTMLElement, prompt: MockPrompt) => {
    // Side effect: create a local Monaco editor for this mock prompt and dispose it on teardown.
    const destroy = createEditor(node, prompt)

    return {
      destroy
    }
  }

  // Side effect: dispose any Monaco instances whose host action has not already cleaned up.
  onDestroy(() => {
    for (const cleanup of editorCleanupCallbacks) {
      cleanup()
    }
    editorCleanupCallbacks.clear()
  })
</script>

{#snippet SeparatorDot()}
  <span class="mockup-separator-dot" aria-hidden="true"></span>
{/snippet}

{#snippet PromptDividerRow(previousPromptId: string | null, subfolderId: string)}
  <PromptDivider
    onAddPrompt={() => addPromptAfter(previousPromptId, subfolderId)}
    testId={previousPromptId
      ? `mockup-prompt-divider-add-after-${previousPromptId}`
      : `mockup-prompt-divider-add-initial-${subfolderId}`}
  />
{/snippet}

{#snippet TreeGutter(lineage: string[])}
  <div class="mockup-tree-gutter" aria-hidden="true">
    {#each lineage as lineId, lineIndex (lineId)}
      <span class="mockup-tree-line" style={`--mockup-line-index:${lineIndex};`}></span>
    {/each}
  </div>
{/snippet}

{#snippet SubfolderRow(subfolder: MockSubfolder)}
  <header class="mockup-subfolder-row">
    <button
      class="mockup-subfolder-icon-button"
      type="button"
      aria-label={subfolder.isCollapsed ? `Expand ${subfolder.title}` : `Collapse ${subfolder.title}`}
      onclick={() => toggleSubfolder(subfolder.id)}
    >
      {#if subfolder.isCollapsed}
        <ChevronRight size={16} aria-hidden="true" />
      {:else}
        <ChevronDown size={16} aria-hidden="true" />
      {/if}
    </button>

    <button
      class="mockup-subfolder-drag-handle"
      type="button"
      draggable="true"
      aria-label={`Reorder ${subfolder.title}`}
    >
      <GripVertical size={16} aria-hidden="true" />
    </button>

    <div class="mockup-subfolder-title-group">
      <span class="mockup-subfolder-title">{subfolder.title}</span>
      <button
        class="mockup-subfolder-edit-button"
        type="button"
        aria-label={`Edit ${subfolder.title}`}
      >
        <Pencil size={13} aria-hidden="true" />
      </button>
    </div>

    <div class="mockup-subfolder-labels">
      <span>{getPromptLabel(getDirectPrompts(subfolder.id).length)}</span>
      <span>{getSubfolderLabel(getChildSubfolders(subfolder.id).length)}</span>
    </div>

    <button
      class="mockup-subfolder-add-button"
      type="button"
      onclick={() => addSubfolder(subfolder.id)}
    >
      <Plus size={14} aria-hidden="true" />
      <span>Add Subfolder</span>
    </button>
  </header>
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, index: number)}
  <article class="mockup-prompt-editor-card" data-testid={`mockup-prompt-editor-${prompt.id}`}>
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId="mockup-prompts"
      title={prompt.title}
      isFirstPrompt={index === 0}
      isLastPrompt={index === mockPrompts.length - 1}
      onMoveUp={() => movePrompt(index, -1)}
      onMoveDown={() => movePrompt(index, 1)}
      onPromptTreeDrop={noopPromptTreeDrop}
    />

    <div class="mockup-prompt-editor-body">
      <header
        class="mockup-prompt-editor-title-bar"
        style={`height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px; min-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px; max-height:${PROMPT_EDITOR_TITLE_AREA_HEIGHT_PX}px;`}
      >
        <div class="mockup-prompt-editor-title-main">
          <span class="mockup-title-icon">
            <FileText size={24} aria-hidden="true" />
          </span>

          <div class="mockup-title-copy">
            <input class="mockup-title-input" value={prompt.title} aria-label="Prompt title" />
            <div class="mockup-metadata-row">
              <span class="mockup-metadata-folder" title={prompt.folder}>
                <Folder class="mockup-metadata-folder-icon" size={12} aria-hidden="true" />
                {prompt.folder}
              </span>
              {@render SeparatorDot()}
              <span>{getLineCount(prompt.text)} lines</span>
              {@render SeparatorDot()}
              <span>{getTokenCount(prompt.text)} tokens</span>
              {@render SeparatorDot()}
              <span>{prompt.modifiedLabel}</span>
            </div>
          </div>
        </div>

        <PromptEditorButtonBar
          title={prompt.title}
          draftText={prompt.text}
          onDelete={() => deletePrompt(prompt.id)}
        />
      </header>

      <span class="mockup-title-body-separator" aria-hidden="true"></span>

      <div
        class="mockup-monaco-shell"
        style={`padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
      >
        <div
          class="mockup-monaco-host"
          aria-label={`${prompt.title} body`}
          use:mountMockupMonaco={prompt}
        ></div>
      </div>
    </div>
  </article>
{/snippet}

<section
  class="prompt-folder-base-mockup"
  data-testid="prompt-folder-base-mockup"
>
  <div class="mockup-editor-row">
    {#each visibleRows as row (row.id)}
      <div
        class="mockup-tree-row"
        data-row-type={row.type}
        style={`--mockup-row-depth:${row.depth}; --mockup-line-count:${row.lineage.length};`}
      >
        {@render TreeGutter(row.lineage)}
        <div class="mockup-tree-row-content">
          {#if row.type === 'folder'}
            {@render SubfolderRow(row.subfolder)}
          {:else if row.type === 'divider'}
            {@render PromptDividerRow(row.previousPromptId, row.subfolderId)}
          {:else}
            {@render PromptEditor(row.prompt, row.promptIndex)}
          {/if}
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .prompt-folder-base-mockup {
    --mockup-monaco-editor-background: #1f1f1f;
    --mockup-subfolder-surface: color-mix(
      in srgb,
      var(--ui-card-overlay-surface) 70%,
      var(--ui-editor-normal-surface)
    );
    --mockup-subfolder-surface-hover: color-mix(
      in srgb,
      var(--ui-card-overlay-surface) 84%,
      var(--ui-hoverable-control-hover-surface, var(--ui-editor-normal-surface))
    );
    --mockup-tree-line: color-mix(in srgb, var(--ui-accent-border, #8d9cf6) 52%, transparent);
    --mockup-tree-line-muted: color-mix(in srgb, var(--ui-neutral-muted-border) 76%, transparent);

    box-sizing: border-box;
    min-width: 0;
    padding-bottom: 8px;
    width: 100%;
  }

  .mockup-editor-row {
    align-items: stretch;
    display: grid;
    gap: 0;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    width: 100%;
  }

  .mockup-tree-row {
    align-items: stretch;
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    min-width: 0;
    width: 100%;
  }

  .mockup-tree-row[data-row-type='folder'] {
    margin-top: 8px;
  }

  .mockup-tree-row:first-child {
    margin-top: 0;
  }

  .mockup-tree-gutter {
    min-width: 0;
    position: relative;
  }

  .mockup-tree-line {
    background: var(--mockup-tree-line-muted);
    bottom: 0;
    left: calc(12px + (var(--mockup-line-index) * 16px));
    position: absolute;
    top: 0;
    width: 1px;
  }

  .mockup-tree-line:last-child {
    background: var(--mockup-tree-line);
    width: 2px;
  }

  .mockup-tree-row-content {
    box-sizing: border-box;
    min-width: 0;
    padding-left: calc(var(--mockup-row-depth) * 18px);
  }

  .mockup-subfolder-row {
    align-items: center;
    background: linear-gradient(
      180deg,
      var(--mockup-subfolder-surface-hover),
      var(--mockup-subfolder-surface)
    );
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-card);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--ui-normal-text) 7%, transparent),
      0 6px 16px color-mix(in srgb, #000 22%, transparent);
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    grid-template-columns: 28px 24px minmax(130px, 1fr) auto auto;
    min-height: 42px;
    min-width: 0;
    padding: 5px 8px;
  }

  .mockup-subfolder-icon-button,
  .mockup-subfolder-drag-handle,
  .mockup-subfolder-edit-button,
  .mockup-subfolder-add-button {
    align-items: center;
    border: 0;
    box-sizing: border-box;
    color: var(--ui-secondary-icon-glyph);
    display: inline-flex;
    flex: 0 0 auto;
    font-family: inherit;
    justify-content: center;
    min-width: 0;
  }

  .mockup-subfolder-icon-button,
  .mockup-subfolder-drag-handle,
  .mockup-subfolder-edit-button {
    background: transparent;
    border-radius: var(--cthulhu-ui-radius-control);
    height: 28px;
    padding: 0;
    width: 28px;
  }

  .mockup-subfolder-icon-button:hover,
  .mockup-subfolder-drag-handle:hover,
  .mockup-subfolder-edit-button:hover {
    background: var(--ui-hoverable-control-hover-surface, var(--ui-editor-normal-surface));
    color: var(--ui-hoverable-icon-glyph);
  }

  .mockup-subfolder-drag-handle {
    color: var(--ui-muted-text);
    cursor: grab;
    width: 24px;
  }

  .mockup-subfolder-title-group {
    align-items: center;
    display: inline-flex;
    gap: 4px;
    min-width: 0;
  }

  .mockup-subfolder-title {
    color: var(--ui-normal-text);
    font-size: 13px;
    font-weight: 650;
    line-height: 18px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mockup-subfolder-edit-button {
    height: 22px;
    width: 22px;
  }

  .mockup-subfolder-labels {
    align-items: center;
    color: var(--ui-muted-text);
    display: inline-flex;
    flex-wrap: nowrap;
    font-size: 11px;
    gap: 6px;
    line-height: 16px;
    min-width: 0;
    white-space: nowrap;
  }

  .mockup-subfolder-labels span {
    background: color-mix(in srgb, var(--ui-editor-normal-surface) 74%, transparent);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    padding: 1px 6px;
  }

  .mockup-subfolder-add-button {
    background: var(--ui-hoverable-control-normal-surface, var(--ui-editor-normal-surface));
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-text);
    gap: 5px;
    height: 28px;
    padding: 0 9px;
    white-space: nowrap;
  }

  .mockup-subfolder-add-button:hover {
    background: var(--ui-hoverable-control-hover-surface, var(--ui-card-overlay-surface));
    color: var(--ui-normal-text);
  }

  .mockup-prompt-editor-card {
    align-items: stretch;
    background: var(--ui-card-overlay-surface);
    border-radius: var(--cthulhu-ui-radius-card);
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
  }

  .mockup-prompt-editor-body {
    align-content: start;
    background: var(--ui-editor-normal-surface);
    border-radius: var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card);
    display: grid;
    gap: 0;
    grid-template-rows: auto 1px auto;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  .mockup-prompt-editor-title-bar {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    display: grid;
    gap: 8px;
    grid-template-columns: minmax(0, 1fr) auto;
    min-width: 0;
    overflow: hidden;
    padding: 8px 16px;
  }

  .mockup-prompt-editor-title-main {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
  }

  .mockup-title-icon {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    flex: 0 0 40px;
    height: 40px;
    justify-content: center;
    width: 40px;
  }

  .mockup-title-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .mockup-title-input {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    height: 22px;
    line-height: 20px;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .mockup-title-input::placeholder {
    color: var(--ui-secondary-text);
  }

  .mockup-metadata-row {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    flex-wrap: nowrap;
    font-size: 12px;
    gap: 7px;
    line-height: 16px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .mockup-metadata-folder {
    align-items: center;
    color: var(--ui-secondary-text);
    display: inline-flex;
    flex: 0 1 auto;
    gap: 4px;
    max-width: 120px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.mockup-metadata-folder-icon) {
    color: var(--ui-secondary-icon-glyph);
    flex: 0 0 auto;
    stroke-width: 2.4;
  }

  .mockup-separator-dot {
    background: var(--ui-muted-text);
    border-radius: var(--cthulhu-ui-radius-control);
    flex: 0 0 3px;
    height: 3px;
    width: 3px;
  }

  .mockup-title-body-separator {
    background: var(--ui-neutral-muted-border);
    height: 1px;
    min-width: 0;
    width: 100%;
  }

  .mockup-monaco-shell {
    background: var(--mockup-monaco-editor-background);
    box-sizing: border-box;
    min-width: 0;
  }

  .mockup-monaco-host {
    min-height: 60px;
    min-width: 0;
    position: relative;
    width: 100%;
  }
</style>
