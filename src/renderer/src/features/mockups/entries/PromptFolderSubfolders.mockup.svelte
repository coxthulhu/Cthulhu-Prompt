<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { ChevronRight, FileText, Folder, FolderOpen, Plus } from 'lucide-svelte'
  import { monaco, PROMPT_EDITOR_THEME } from '@renderer/common/Monaco'
  import PromptEditorButtonBar from '@renderer/features/prompt-editor/PromptEditorButtonBar.svelte'
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
    kind: 'prompt'
    id: string
    title: string
    folder: string
    modifiedLabel: string
    text: string
  }

  type MockFolder = {
    kind: 'folder'
    id: string
    name: string
    children: MockNode[]
  }

  type MockNode = MockPrompt | MockFolder

  let tree = $state<MockNode[]>([
    {
      kind: 'prompt',
      id: 'mockup-outline',
      title: 'Outline workspace import edge cases',
      folder: 'Prompts',
      modifiedLabel: 'Updated 2 min ago',
      text: [
        'Review the workspace import flow and identify any edge cases around missing folders, duplicate prompt titles, and malformed front matter.',
        '',
        'Return the findings as concrete bugs with file references and suggested tests.'
      ].join('\n')
    },
    {
      kind: 'folder',
      id: 'folder-import',
      name: 'Import pipeline',
      children: [
        {
          kind: 'prompt',
          id: 'mockup-refactor',
          title: 'Refactor editor sizing controller',
          folder: 'Import pipeline',
          modifiedLabel: 'Updated 18 min ago',
          text: [
            'Refactor the prompt editor sizing logic so height estimation, measured height caching, and Monaco relayout are easier to reason about.',
            '',
            'Keep the behavior unchanged and add focused regression coverage for wrapped lines.'
          ].join('\n')
        },
        {
          kind: 'folder',
          id: 'folder-edge-cases',
          name: 'Edge cases',
          children: [
            {
              kind: 'prompt',
              id: 'mockup-review',
              title: 'Review drag and drop persistence',
              folder: 'Edge cases',
              modifiedLabel: 'Updated 1 hr ago',
              text: [
                'Code review the prompt tree drag/drop implementation. Focus on persistence order, optimistic UI state, and recovery when a drop target disappears.',
                '',
                'List only issues that can produce user-visible regressions.'
              ].join('\n')
            },
            {
              kind: 'prompt',
              id: 'mockup-tests',
              title: 'Write Playwright coverage',
              folder: 'Edge cases',
              modifiedLabel: 'Updated yesterday',
              text: [
                'Add Playwright coverage for adding a prompt, typing in the Monaco editor, navigating away, and returning to verify content and focus state.',
                '',
                'Use the existing test helpers and data-testid selectors.'
              ].join('\n')
            }
          ]
        },
        {
          kind: 'prompt',
          id: 'mockup-release',
          title: 'Draft release notes',
          folder: 'Import pipeline',
          modifiedLabel: 'Updated Jun 12',
          text: [
            'Summarize the recent prompt folder changes for a release note. Focus on visible user-facing behavior, workflow improvements, and any test coverage added.',
            '',
            'Keep the tone concise and avoid implementation details unless they affect users directly.'
          ].join('\n')
        }
      ]
    },
    {
      kind: 'folder',
      id: 'folder-settings',
      name: 'Settings & polish',
      children: [
        {
          kind: 'prompt',
          id: 'mockup-polish',
          title: 'Polish settings controls',
          folder: 'Settings & polish',
          modifiedLabel: 'Updated Jun 8',
          text: [
            'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
            '',
            'Stay within the existing palette and cthulhu-ui component conventions.'
          ].join('\n')
        }
      ]
    }
  ])

  const collapsedFolderIds = new SvelteSet<string>()

  const toggleFolder = (folderId: string) => {
    if (collapsedFolderIds.has(folderId)) {
      collapsedFolderIds.delete(folderId)
    } else {
      collapsedFolderIds.add(folderId)
    }
  }

  type GuideKind = 'empty' | 'line' | 'tee' | 'elbow'

  type FolderRow = {
    kind: 'folder'
    key: string
    node: MockFolder
    guides: GuideKind[]
    promptCount: number
    isCollapsed: boolean
  }

  type PromptRow = {
    kind: 'prompt'
    key: string
    node: MockPrompt
    guides: GuideKind[]
    siblings: MockNode[]
    index: number
  }

  type Row = FolderRow | PromptRow

  const countPrompts = (nodes: MockNode[]): number => {
    let total = 0
    for (const node of nodes) {
      if (node.kind === 'prompt') total += 1
      else total += countPrompts(node.children)
    }
    return total
  }

  const flatten = (
    nodes: MockNode[],
    parentGuides: GuideKind[],
    isTopLevel: boolean,
    rows: Row[]
  ) => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1
      const guides: GuideKind[] = isTopLevel
        ? []
        : [...parentGuides, isLast ? 'elbow' : 'tee']

      if (node.kind === 'folder') {
        const isCollapsed = collapsedFolderIds.has(node.id)
        rows.push({
          kind: 'folder',
          key: node.id,
          node,
          guides,
          promptCount: countPrompts(node.children),
          isCollapsed
        })
        if (!isCollapsed) {
          const childParentGuides: GuideKind[] = isTopLevel
            ? []
            : [...parentGuides, isLast ? 'empty' : 'line']
          flatten(node.children, childParentGuides, false, rows)
        }
      } else {
        rows.push({
          kind: 'prompt',
          key: node.id,
          node,
          guides,
          siblings: nodes,
          index
        })
      }
    })
  }

  const rows = $derived.by<Row[]>(() => {
    const collected: Row[] = []
    flatten(tree, [], true, collected)
    return collected
  })

  const totalPromptCount = $derived(countPrompts(tree))

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
    monaco.Uri.file(`/cthulhu-prompt/mockups/prompt-folder-subfolders/${promptId}.md`)

  let nextPromptSequence = $state(1)

  const addPromptToFolder = (folder: MockFolder) => {
    collapsedFolderIds.delete(folder.id)
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1
    folder.children.push({
      kind: 'prompt',
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folder: folder.name,
      modifiedLabel: 'Just now',
      text: ''
    })
  }

  const movePrompt = (siblings: MockNode[], index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= siblings.length) return
    const [moved] = siblings.splice(index, 1)
    siblings.splice(targetIndex, 0, moved)
  }

  const deletePrompt = (siblings: MockNode[], promptId: string) => {
    const index = siblings.findIndex((node) => node.kind === 'prompt' && node.id === promptId)
    if (index !== -1) siblings.splice(index, 1)
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

{#snippet Gutter(guides: GuideKind[])}
  <div class="mockup-gutter" aria-hidden="true">
    {#each guides as guide, columnIndex (columnIndex)}
      <span class="mockup-gutter-cell">
        {#if guide === 'line'}
          <span class="mockup-guide-vline"></span>
        {:else if guide === 'tee'}
          <span class="mockup-guide-vline"></span>
          <span class="mockup-guide-hline"></span>
        {:else if guide === 'elbow'}
          <span class="mockup-guide-vline-top"></span>
          <span class="mockup-guide-hline"></span>
        {/if}
      </span>
    {/each}
  </div>
{/snippet}

{#snippet FolderHeader(row: FolderRow)}
  <div class="mockup-row mockup-row-folder" style="--mockup-connect-y:18px;">
    {@render Gutter(row.guides)}
    <button
      type="button"
      class="mockup-folder-button"
      aria-expanded={!row.isCollapsed}
      onclick={() => toggleFolder(row.node.id)}
    >
      <span class={`mockup-folder-chevron${row.isCollapsed ? '' : ' mockup-folder-chevron-open'}`}>
        <ChevronRight size={16} aria-hidden="true" />
      </span>
      <span class="mockup-folder-icon">
        {#if row.isCollapsed}
          <Folder size={16} aria-hidden="true" />
        {:else}
          <FolderOpen size={16} aria-hidden="true" />
        {/if}
      </span>
      <span class="mockup-folder-name">{row.node.name}</span>
      <span class="mockup-folder-count">{row.promptCount} prompts</span>
      <span
        class="mockup-folder-add"
        role="button"
        tabindex="-1"
        aria-label={`Add prompt to ${row.node.name}`}
        onclick={(event) => {
          event.stopPropagation()
          addPromptToFolder(row.node)
        }}
        onkeydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            addPromptToFolder(row.node)
          }
        }}
      >
        <Plus size={15} aria-hidden="true" />
      </span>
    </button>
  </div>
{/snippet}

{#snippet PromptRow(row: PromptRow)}
  <div class="mockup-row mockup-row-prompt" style="--mockup-connect-y:30px;">
    {@render Gutter(row.guides)}
    <div class="mockup-prompt-content">
      <article class="mockup-prompt-editor-card" data-testid={`mockup-prompt-editor-${row.node.id}`}>
        <PromptEditorSidebar
          promptId={row.node.id}
          promptFolderId="mockup-subfolders"
          title={row.node.title}
          isFirstPrompt={row.index === 0}
          isLastPrompt={row.index === row.siblings.length - 1}
          onMoveUp={() => movePrompt(row.siblings, row.index, -1)}
          onMoveDown={() => movePrompt(row.siblings, row.index, 1)}
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
                <input
                  class="mockup-title-input"
                  value={row.node.title}
                  aria-label="Prompt title"
                />
                <div class="mockup-metadata-row">
                  <span class="mockup-metadata-folder" title={row.node.folder}>
                    <Folder class="mockup-metadata-folder-icon" size={12} aria-hidden="true" />
                    {row.node.folder}
                  </span>
                  {@render SeparatorDot()}
                  <span>{getLineCount(row.node.text)} lines</span>
                  {@render SeparatorDot()}
                  <span>{getTokenCount(row.node.text)} tokens</span>
                  {@render SeparatorDot()}
                  <span>{row.node.modifiedLabel}</span>
                </div>
              </div>
            </div>

            <PromptEditorButtonBar
              title={row.node.title}
              draftText={row.node.text}
              onDelete={() => deletePrompt(row.siblings, row.node.id)}
            />
          </header>

          <span class="mockup-title-body-separator" aria-hidden="true"></span>

          <div
            class="mockup-monaco-shell"
            style={`padding:${PROMPT_EDITOR_BODY_PADDING_TOP_PX}px ${PROMPT_EDITOR_BODY_PADDING_RIGHT_PX}px ${PROMPT_EDITOR_BODY_PADDING_BOTTOM_PX}px ${PROMPT_EDITOR_BODY_PADDING_LEFT_PX}px;`}
          >
            <div
              class="mockup-monaco-host"
              aria-label={`${row.node.title} body`}
              use:mountMockupMonaco={row.node}
            ></div>
          </div>
        </div>
      </article>
    </div>
  </div>
{/snippet}

<section class="prompt-folder-subfolders-mockup" data-testid="prompt-folder-subfolders-mockup">
  <header class="mockup-section-header">
    <span class="mockup-section-icon">
      <FolderOpen size={18} aria-hidden="true" />
    </span>
    <span class="mockup-section-title">Prompts</span>
    <span class="mockup-section-count">{totalPromptCount} prompts</span>
  </header>

  <div class="mockup-tree">
    {#each rows as row (row.key)}
      {#if row.kind === 'folder'}
        {@render FolderHeader(row)}
      {:else}
        {@render PromptRow(row)}
      {/if}
    {/each}
  </div>
</section>

<style>
  .prompt-folder-subfolders-mockup {
    --mockup-monaco-editor-background: #1f1f1f;
    --mockup-guide-line: oklch(1 0 0 / 16%);
    --mockup-gutter-cell-width: 26px;

    box-sizing: border-box;
    min-width: 0;
    padding-bottom: 8px;
    width: 100%;
  }

  .mockup-section-header {
    align-items: center;
    color: var(--ui-secondary-text);
    display: flex;
    gap: 8px;
    min-width: 0;
    padding: 4px 4px 10px;
  }

  .mockup-section-icon {
    align-items: center;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
    justify-content: center;
  }

  .mockup-section-title {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.01em;
    min-width: 0;
  }

  .mockup-section-count {
    color: var(--ui-muted-text);
    font-size: 12px;
  }

  .mockup-tree {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 0;
    width: 100%;
  }

  .mockup-row {
    align-items: stretch;
    display: flex;
    gap: 0;
    min-width: 0;
    width: 100%;
  }

  .mockup-gutter {
    display: flex;
    flex: 0 0 auto;
    min-width: 0;
  }

  .mockup-gutter-cell {
    flex: 0 0 var(--mockup-gutter-cell-width);
    position: relative;
    width: var(--mockup-gutter-cell-width);
  }

  .mockup-guide-vline,
  .mockup-guide-vline-top {
    background: var(--mockup-guide-line);
    bottom: 0;
    left: 12px;
    position: absolute;
    top: 0;
    width: 1.5px;
  }

  .mockup-guide-vline-top {
    bottom: auto;
    height: var(--mockup-connect-y);
  }

  .mockup-guide-hline {
    background: var(--mockup-guide-line);
    border-radius: 1px;
    height: 1.5px;
    left: 12px;
    position: absolute;
    top: var(--mockup-connect-y);
    width: calc(var(--mockup-gutter-cell-width) - 12px);
  }

  .mockup-row-folder {
    padding-bottom: 4px;
  }

  .mockup-folder-button {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-secondary-text);
    cursor: pointer;
    display: flex;
    flex: 1 1 auto;
    font-family: inherit;
    gap: 8px;
    height: 36px;
    min-width: 0;
    padding: 0 10px 0 4px;
    text-align: left;
    transition: background 120ms ease;
  }

  .mockup-folder-button:hover {
    background: var(--ui-neutral-subtle-action-hover-fill);
  }

  .mockup-folder-button:focus-visible {
    box-shadow: 0 0 0 1.5px var(--ui-neutral-focus-border);
    outline: none;
  }

  .mockup-folder-chevron {
    align-items: center;
    color: var(--ui-muted-icon-glyph);
    display: flex;
    flex: 0 0 auto;
    justify-content: center;
    transition: transform 140ms ease;
  }

  .mockup-folder-chevron-open {
    transform: rotate(90deg);
  }

  .mockup-folder-icon {
    align-items: center;
    color: var(--ui-secondary-icon-glyph);
    display: flex;
    flex: 0 0 auto;
    justify-content: center;
  }

  .mockup-folder-button:hover .mockup-folder-icon {
    color: var(--ui-accent-normal-text);
  }

  .mockup-folder-name {
    color: var(--ui-hoverable-text);
    flex: 0 1 auto;
    font-size: 14px;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mockup-folder-count {
    color: var(--ui-muted-text);
    flex: 0 0 auto;
    font-size: 12px;
  }

  .mockup-folder-add {
    align-items: center;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-muted-icon-glyph);
    cursor: pointer;
    display: flex;
    flex: 0 0 auto;
    height: 24px;
    justify-content: center;
    margin-left: auto;
    opacity: 0;
    transition: background 120ms ease, color 120ms ease, opacity 120ms ease;
    width: 24px;
  }

  .mockup-folder-button:hover .mockup-folder-add {
    opacity: 1;
  }

  .mockup-folder-add:hover {
    background: var(--ui-neutral-action-hover-fill);
    color: var(--ui-hoverable-icon-glyph);
  }

  .mockup-row-prompt {
    padding-bottom: 8px;
  }

  .mockup-prompt-content {
    flex: 1 1 auto;
    min-width: 0;
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
    max-width: 140px;
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
