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
    modifiedLabel: string
    text: string
  }

  type MockSubfolder = {
    id: string
    title: string
    promptIds: string[]
    childSubfolderCount: number
    isExpanded: boolean
  }

  let mockPrompts = $state<MockPrompt[]>([
    {
      id: 'mockup-outline',
      title: 'Outline workspace import edge cases',
      folder: 'Import audit',
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
      folder: 'Editor infrastructure',
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
      folder: 'Import audit',
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
      folder: 'Editor infrastructure',
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
      folder: 'Release polish',
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
      folder: 'Release polish',
      modifiedLabel: 'Updated Jun 8',
      text: [
        'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
        '',
        'Stay within the existing palette and cthulhu-ui component conventions.'
      ].join('\n')
    }
  ])

  let mockSubfolders = $state<MockSubfolder[]>([
    {
      id: 'mockup-import-audit',
      title: 'Import audit',
      promptIds: ['mockup-outline', 'mockup-review'],
      childSubfolderCount: 2,
      isExpanded: true
    },
    {
      id: 'mockup-editor-infrastructure',
      title: 'Editor infrastructure',
      promptIds: ['mockup-refactor', 'mockup-tests'],
      childSubfolderCount: 1,
      isExpanded: true
    },
    {
      id: 'mockup-release-polish',
      title: 'Release polish',
      promptIds: ['mockup-release', 'mockup-polish'],
      childSubfolderCount: 0,
      isExpanded: true
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
    monaco.Uri.file(`/cthulhu-prompt/mockups/subfolders-231929341/${promptId}.md`)

  const getPromptById = (promptId: string): MockPrompt | undefined =>
    mockPrompts.find((prompt) => prompt.id === promptId)

  let nextPromptSequence = $state(1)

  const createNewPrompt = (folder: string): MockPrompt => {
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1

    return {
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folder,
      modifiedLabel: 'Just now',
      text: ''
    }
  }

  const addPromptToSubfolder = (subfolderId: string, previousPromptId: string | null) => {
    const subfolder = mockSubfolders.find((candidate) => candidate.id === subfolderId)
    if (!subfolder) return

    const nextPrompt = createNewPrompt(subfolder.title)
    const promptIds = [...subfolder.promptIds]
    const previousPromptIndex = previousPromptId
      ? promptIds.findIndex((promptId) => promptId === previousPromptId)
      : -1
    const insertIndex = previousPromptIndex === -1 ? 0 : previousPromptIndex + 1
    promptIds.splice(insertIndex, 0, nextPrompt.id)

    mockPrompts = [...mockPrompts, nextPrompt]
    mockSubfolders = mockSubfolders.map((candidate) =>
      candidate.id === subfolderId ? { ...candidate, promptIds, isExpanded: true } : candidate
    )
  }

  const movePrompt = (subfolderId: string, promptId: string, direction: -1 | 1) => {
    const subfolder = mockSubfolders.find((candidate) => candidate.id === subfolderId)
    if (!subfolder) return

    const promptIndex = subfolder.promptIds.indexOf(promptId)
    const targetIndex = promptIndex + direction
    if (promptIndex === -1 || targetIndex < 0 || targetIndex >= subfolder.promptIds.length) return

    const promptIds = [...subfolder.promptIds]
    const [movedPromptId] = promptIds.splice(promptIndex, 1)
    promptIds.splice(targetIndex, 0, movedPromptId)

    mockSubfolders = mockSubfolders.map((candidate) =>
      candidate.id === subfolderId ? { ...candidate, promptIds } : candidate
    )
  }

  const deletePrompt = (promptId: string) => {
    mockPrompts = mockPrompts.filter((prompt) => prompt.id !== promptId)
    mockSubfolders = mockSubfolders.map((subfolder) => ({
      ...subfolder,
      promptIds: subfolder.promptIds.filter((candidateId) => candidateId !== promptId)
    }))
  }

  const toggleSubfolder = (subfolderId: string) => {
    mockSubfolders = mockSubfolders.map((subfolder) =>
      subfolder.id === subfolderId
        ? { ...subfolder, isExpanded: !subfolder.isExpanded }
        : subfolder
    )
  }

  const addNestedSubfolder = (subfolderId: string) => {
    mockSubfolders = mockSubfolders.map((subfolder) =>
      subfolder.id === subfolderId
        ? { ...subfolder, childSubfolderCount: subfolder.childSubfolderCount + 1 }
        : subfolder
    )
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

{#snippet PromptDividerRow(subfolderId: string, previousPromptId: string | null)}
  <div class="mockup-prompt-divider-row">
    <span class="mockup-prompt-divider-line" aria-hidden="true"></span>
    <button
      class="mockup-prompt-divider-button"
      type="button"
      onclick={() => addPromptToSubfolder(subfolderId, previousPromptId)}
      data-testid={previousPromptId
        ? `mockup-prompt-divider-add-after-${previousPromptId}`
        : `mockup-prompt-divider-add-initial-${subfolderId}`}
    >
      <Plus size={14} aria-hidden="true" />
      Add prompt
    </button>
    <span class="mockup-prompt-divider-line" aria-hidden="true"></span>
  </div>
{/snippet}

{#snippet SubfolderHeader(subfolder: MockSubfolder)}
  <header class="mockup-subfolder-header">
    <div class="mockup-subfolder-leading">
      <button class="mockup-subfolder-drag" type="button" aria-label={`Reorder ${subfolder.title}`}>
        <GripVertical size={16} aria-hidden="true" />
      </button>

      <button
        class="mockup-subfolder-chevron"
        type="button"
        aria-label={subfolder.isExpanded ? `Collapse ${subfolder.title}` : `Expand ${subfolder.title}`}
        aria-expanded={subfolder.isExpanded}
        onclick={() => toggleSubfolder(subfolder.id)}
      >
        {#if subfolder.isExpanded}
          <ChevronDown size={17} aria-hidden="true" />
        {:else}
          <ChevronRight size={17} aria-hidden="true" />
        {/if}
      </button>

      <button class="mockup-subfolder-edit" type="button" aria-label={`Edit ${subfolder.title}`}>
        <Pencil size={13} aria-hidden="true" />
      </button>

      <div class="mockup-subfolder-title-group">
        <span class="mockup-subfolder-title">{subfolder.title}</span>
        <span class="mockup-subfolder-label-row">
          <span>{subfolder.promptIds.length} prompts</span>
          {@render SeparatorDot()}
          <span>
            {subfolder.childSubfolderCount}
            {subfolder.childSubfolderCount === 1 ? 'subfolder' : 'subfolders'}
          </span>
        </span>
      </div>
    </div>

    <button
      class="mockup-subfolder-add"
      type="button"
      onclick={() => addNestedSubfolder(subfolder.id)}
    >
      <Plus size={14} aria-hidden="true" />
      Add Subfolder
    </button>
  </header>
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, subfolderId: string, index: number, totalPrompts: number)}
  <article class="mockup-prompt-editor-card" data-testid={`mockup-prompt-editor-${prompt.id}`}>
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId={subfolderId}
      title={prompt.title}
      isFirstPrompt={index === 0}
      isLastPrompt={index === totalPrompts - 1}
      onMoveUp={() => movePrompt(subfolderId, prompt.id, -1)}
      onMoveDown={() => movePrompt(subfolderId, prompt.id, 1)}
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

<section class="prompt-folder-subfolders-mockup" data-testid="prompt-folder-subfolders-mockup">
  <div class="mockup-editor-row">
    {#each mockSubfolders as subfolder (subfolder.id)}
      <section
        class="mockup-subfolder-group"
        data-expanded={subfolder.isExpanded}
        style={`--mockup-folder-prompt-count:${subfolder.promptIds.length};`}
      >
        {@render SubfolderHeader(subfolder)}

        {#if subfolder.isExpanded}
          <div class="mockup-subfolder-contents">
            {@render PromptDividerRow(subfolder.id, null)}
            {#each subfolder.promptIds as promptId, index (promptId)}
              {@const prompt = getPromptById(promptId)}
              {#if prompt}
                {@render PromptEditor(prompt, subfolder.id, index, subfolder.promptIds.length)}
                {@render PromptDividerRow(subfolder.id, prompt.id)}
              {/if}
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</section>

<style>
  .prompt-folder-subfolders-mockup {
    --mockup-monaco-editor-background: #1f1f1f;
    --mockup-subfolder-surface: color-mix(
      in srgb,
      var(--ui-editor-normal-surface) 90%,
      var(--ui-card-overlay-surface)
    );
    --mockup-subfolder-border: color-mix(
      in srgb,
      var(--ui-neutral-muted-border) 78%,
      var(--ui-accent-normal-border)
    );
    --mockup-subfolder-line: color-mix(
      in srgb,
      var(--ui-accent-normal-border) 62%,
      var(--ui-neutral-muted-border)
    );

    box-sizing: border-box;
    min-width: 0;
    padding-bottom: 8px;
    width: 100%;
  }

  .mockup-editor-row {
    align-items: stretch;
    display: grid;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    width: 100%;
  }

  .mockup-subfolder-group {
    box-sizing: border-box;
    display: grid;
    gap: 0;
    grid-template-columns: 30px minmax(0, 1fr);
    min-width: 0;
    position: relative;
    width: 100%;
  }

  .mockup-subfolder-group[data-expanded='true']::before {
    background: linear-gradient(
      to bottom,
      var(--mockup-subfolder-line),
      color-mix(in srgb, var(--mockup-subfolder-line) 72%, transparent)
    );
    border-radius: var(--cthulhu-ui-radius-control);
    content: '';
    grid-column: 1;
    height: calc(100% - 24px);
    left: 14px;
    position: absolute;
    top: 24px;
    width: 2px;
    z-index: 0;
  }

  .mockup-subfolder-header {
    align-items: center;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--ui-card-overlay-surface) 54%, transparent),
        transparent 36%
      ),
      var(--mockup-subfolder-surface);
    border: 1px solid var(--mockup-subfolder-border);
    border-radius: var(--cthulhu-ui-radius-card);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--ui-normal-text) 7%, transparent),
      0 1px 0 color-mix(in srgb, var(--ui-shadow-raised) 70%, transparent);
    box-sizing: border-box;
    display: grid;
    gap: 12px;
    grid-column: 1 / -1;
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 48px;
    min-width: 0;
    overflow: hidden;
    padding: 6px 10px 6px 7px;
    position: relative;
    z-index: 1;
  }

  .mockup-subfolder-leading {
    align-items: center;
    display: grid;
    gap: 3px;
    grid-template-columns: 22px 24px 22px minmax(0, 1fr);
    min-width: 0;
  }

  .mockup-subfolder-drag,
  .mockup-subfolder-chevron,
  .mockup-subfolder-edit,
  .mockup-subfolder-add,
  .mockup-prompt-divider-button {
    align-items: center;
    border: 0;
    box-sizing: border-box;
    color: var(--ui-secondary-text);
    display: inline-flex;
    font-family: inherit;
    justify-content: center;
    min-width: 0;
  }

  .mockup-subfolder-drag,
  .mockup-subfolder-chevron,
  .mockup-subfolder-edit {
    background: transparent;
    border-radius: var(--cthulhu-ui-radius-control);
    height: 26px;
    padding: 0;
    width: 100%;
  }

  .mockup-subfolder-drag {
    color: var(--ui-muted-text);
    cursor: grab;
  }

  .mockup-subfolder-chevron,
  .mockup-subfolder-edit {
    color: var(--ui-hoverable-icon-glyph);
    cursor: pointer;
  }

  .mockup-subfolder-drag:hover,
  .mockup-subfolder-chevron:hover,
  .mockup-subfolder-edit:hover {
    background: color-mix(in srgb, var(--ui-card-overlay-surface) 76%, transparent);
    color: var(--ui-normal-text);
  }

  .mockup-subfolder-title-group {
    align-content: center;
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .mockup-subfolder-title {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 700;
    line-height: 18px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mockup-subfolder-label-row {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    flex-wrap: nowrap;
    font-size: 11px;
    gap: 7px;
    line-height: 14px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .mockup-subfolder-add {
    background: color-mix(in srgb, var(--ui-card-overlay-surface) 82%, transparent);
    border: 1px solid color-mix(in srgb, var(--ui-accent-normal-border) 82%, transparent);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-normal-text);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    gap: 5px;
    height: 30px;
    line-height: 16px;
    padding: 0 10px;
    white-space: nowrap;
  }

  .mockup-subfolder-add:hover {
    background: color-mix(in srgb, var(--ui-card-overlay-surface) 92%, transparent);
    border-color: var(--ui-accent-normal-border);
  }

  .mockup-subfolder-contents {
    display: grid;
    gap: 0;
    grid-column: 2;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    padding-top: 4px;
    position: relative;
    z-index: 1;
  }

  .mockup-prompt-divider-row {
    align-items: center;
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    grid-template-columns: minmax(18px, 1fr) auto minmax(18px, 1fr);
    min-height: 28px;
    min-width: 0;
    padding: 2px 0;
  }

  .mockup-prompt-divider-line {
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--mockup-subfolder-line) 58%, transparent),
      transparent
    );
    height: 1px;
    min-width: 0;
    width: 100%;
  }

  .mockup-prompt-divider-button {
    background: var(--ui-editor-normal-surface);
    border: 1px solid color-mix(in srgb, var(--mockup-subfolder-line) 72%, transparent);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-text);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    gap: 4px;
    height: 22px;
    line-height: 14px;
    padding: 0 8px;
    white-space: nowrap;
  }

  .mockup-prompt-divider-button:hover {
    background: color-mix(in srgb, var(--ui-card-overlay-surface) 76%, transparent);
    color: var(--ui-normal-text);
  }

  .mockup-prompt-editor-card {
    align-items: stretch;
    background: var(--ui-card-overlay-surface);
    border-radius: var(--cthulhu-ui-radius-card);
    box-shadow: 0 1px 0 color-mix(in srgb, var(--ui-shadow-raised) 70%, transparent);
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
    max-width: 160px;
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
