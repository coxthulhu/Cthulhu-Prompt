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
    modifiedLabel: string
    text: string
  }

  type MockSubfolder = {
    id: string
    title: string
    depth: number
    prompts: MockPrompt[]
    children: MockSubfolder[]
  }

  const createPrompt = (
    id: string,
    title: string,
    folder: string,
    modifiedLabel: string,
    paragraphs: string[]
  ): MockPrompt => ({
    id,
    title,
    folder,
    modifiedLabel,
    text: paragraphs.join('\n')
  })

  let mockSubfolders = $state<MockSubfolder[]>([
    {
      id: 'review-flows',
      title: 'Review flows',
      depth: 0,
      prompts: [
        createPrompt('mockup-outline', 'Outline workspace import edge cases', 'Review flows', 'Updated 2 min ago', [
          'Review the workspace import flow and identify any edge cases around missing folders, duplicate prompt titles, and malformed front matter.',
          '',
          'Return the findings as concrete bugs with file references and suggested tests.',
          '',
          'Include scenarios for partially written workspace files, prompts that reference folders removed during import, and imports where the destination workspace already has similarly named prompts.',
          '',
          'Separate confirmed issues from follow-up questions. Do not include general cleanup notes unless they can cause data loss or a visible recovery problem.'
        ]),
        createPrompt('mockup-review', 'Review drag and drop persistence', 'Review flows', 'Updated 1 hr ago', [
          'Code review the prompt tree drag/drop implementation. Focus on persistence order, optimistic UI state, and recovery when a drop target disappears.',
          '',
          'List only issues that can produce user-visible regressions.',
          '',
          'Pay special attention to cross-folder moves, moving the first or last prompt in a folder, cancelled drags, and drops that happen while the target folder is collapsed.',
          '',
          'For each finding, include the smallest user flow that reproduces it and the assertion a Playwright test should make.'
        ])
      ],
      children: [
        {
          id: 'regression-passes',
          title: 'Regression passes',
          depth: 1,
          prompts: [
            createPrompt('mockup-tests', 'Write Playwright coverage', 'Regression passes', 'Updated yesterday', [
              'Add Playwright coverage for adding a prompt, typing in the Monaco editor, navigating away, and returning to verify content and focus state.',
              '',
              'Use the existing test helpers and data-testid selectors.',
              '',
              'Cover the add button above the first prompt and the add button after an existing prompt. Verify the new row appears in the expected position before typing.',
              '',
              'After navigation, assert that the prompt order, title text, Monaco body text, and selected folder are still restored.'
            ])
          ],
          children: []
        }
      ]
    },
    {
      id: 'implementation',
      title: 'Implementation',
      depth: 0,
      prompts: [
        createPrompt('mockup-refactor', 'Refactor editor sizing controller', 'Implementation', 'Updated 18 min ago', [
          'Refactor the prompt editor sizing logic so height estimation, measured height caching, and Monaco relayout are easier to reason about.',
          '',
          'Keep the behavior unchanged and add focused regression coverage for wrapped lines.'
        ]),
        createPrompt('mockup-polish', 'Polish settings controls', 'Implementation', 'Updated Jun 8', [
          'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
          '',
          'Stay within the existing palette and cthulhu-ui component conventions.'
        ])
      ],
      children: []
    },
    {
      id: 'release',
      title: 'Release',
      depth: 0,
      prompts: [
        createPrompt('mockup-release', 'Draft release notes', 'Release', 'Updated Jun 12', [
          'Summarize the recent prompt folder changes for a release note. Focus on visible user-facing behavior, workflow improvements, and any test coverage added.',
          '',
          'Keep the tone concise and avoid implementation details unless they affect users directly.'
        ])
      ],
      children: []
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
    monaco.Uri.file(`/cthulhu-prompt/mockups/subfolders-231945091/${promptId}.md`)

  const countNestedSubfolders = (subfolder: MockSubfolder): number =>
    subfolder.children.reduce((count, child) => count + 1 + countNestedSubfolders(child), 0)

  const countPromptsInSubfolder = (subfolder: MockSubfolder): number =>
    subfolder.children.reduce(
      (count, child) => count + countPromptsInSubfolder(child),
      subfolder.prompts.length
    )

  const countSubfolders = (subfolders: MockSubfolder[]): number =>
    subfolders.reduce((count, subfolder) => count + 1 + countNestedSubfolders(subfolder), 0)

  const formatCount = (count: number, singularLabel: string): string =>
    `${count} ${count === 1 ? singularLabel : `${singularLabel}s`}`

  const getAllPrompts = (): MockPrompt[] => {
    const prompts: MockPrompt[] = []

    const collectPrompts = (subfolders: MockSubfolder[]) => {
      for (const subfolder of subfolders) {
        prompts.push(...subfolder.prompts)
        collectPrompts(subfolder.children)
      }
    }

    collectPrompts(mockSubfolders)
    return prompts
  }

  const getPromptIndex = (promptId: string): number =>
    getAllPrompts().findIndex((prompt) => prompt.id === promptId)

  const getPromptCount = (): number => getAllPrompts().length
  const getTreeLineIndexes = (count: number): number[] =>
    Array.from({ length: count }, (_, lineIndex) => lineIndex)

  const expandedSubfolderIds = new SvelteSet<string>([
    'review-flows',
    'regression-passes',
    'implementation',
    'release'
  ])

  let nextPromptSequence = $state(1)
  let nextSubfolderSequence = $state(1)

  const findSubfolder = (
    subfolders: MockSubfolder[],
    subfolderId: string
  ): MockSubfolder | undefined => {
    for (const subfolder of subfolders) {
      if (subfolder.id === subfolderId) return subfolder

      const childSubfolder = findSubfolder(subfolder.children, subfolderId)
      if (childSubfolder) return childSubfolder
    }

    return undefined
  }

  const findPromptLocation = (
    subfolders: MockSubfolder[],
    promptId: string
  ): { subfolder: MockSubfolder; index: number } | undefined => {
    for (const subfolder of subfolders) {
      const promptIndex = subfolder.prompts.findIndex((prompt) => prompt.id === promptId)
      if (promptIndex !== -1) {
        return { subfolder, index: promptIndex }
      }

      const childLocation = findPromptLocation(subfolder.children, promptId)
      if (childLocation) return childLocation
    }

    return undefined
  }

  const createNewPrompt = (folder = 'Prompts'): MockPrompt => {
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

  const addPromptAfter = (previousPromptId: string | null, subfolderId: string) => {
    if (previousPromptId === null) {
      const subfolder = findSubfolder(mockSubfolders, subfolderId)
      if (!subfolder) return

      subfolder.prompts = [createNewPrompt(subfolder.title), ...subfolder.prompts]
      return
    }

    const location = findPromptLocation(mockSubfolders, previousPromptId)
    if (!location) return

    location.subfolder.prompts.splice(location.index + 1, 0, createNewPrompt(location.subfolder.title))
  }

  const movePrompt = (promptId: string, direction: -1 | 1) => {
    const location = findPromptLocation(mockSubfolders, promptId)
    if (!location) return

    const targetIndex = location.index + direction
    if (targetIndex < 0 || targetIndex >= location.subfolder.prompts.length) return

    const [prompt] = location.subfolder.prompts.splice(location.index, 1)
    location.subfolder.prompts.splice(targetIndex, 0, prompt)
  }

  const deletePrompt = (promptId: string) => {
    const location = findPromptLocation(mockSubfolders, promptId)
    if (!location) return

    location.subfolder.prompts.splice(location.index, 1)
  }

  const toggleSubfolder = (subfolderId: string) => {
    if (expandedSubfolderIds.has(subfolderId)) {
      expandedSubfolderIds.delete(subfolderId)
      return
    }

    expandedSubfolderIds.add(subfolderId)
  }

  const addNestedSubfolder = (parentSubfolderId: string) => {
    const parentSubfolder = findSubfolder(mockSubfolders, parentSubfolderId)
    if (!parentSubfolder) return

    const subfolderNumber = nextSubfolderSequence
    nextSubfolderSequence += 1

    parentSubfolder.children = [
      ...parentSubfolder.children,
      {
        id: `${parentSubfolderId}-new-${subfolderNumber}`,
        title: `New subfolder ${subfolderNumber}`,
        depth: parentSubfolder.depth + 1,
        prompts: [],
        children: []
      }
    ]
    expandedSubfolderIds.add(parentSubfolderId)
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

{#snippet TreeLines(count: number)}
  {#if count > 0}
    {#each getTreeLineIndexes(count) as lineIndex (lineIndex)}
      <span
        class="mockup-tree-line"
        style={`left:${15 + lineIndex * 12}px;`}
      ></span>
    {/each}
  {/if}
{/snippet}

{#snippet PromptDividerRow(previousPromptId: string | null, subfolderId: string, depth: number)}
  <div class="mockup-content-row" style={`--mockup-depth-indent:${depth * 12}px;`}>
    <div class="mockup-tree-gutter" aria-hidden="true">
      {@render TreeLines(depth)}
    </div>

    <PromptDivider
      onAddPrompt={() => addPromptAfter(previousPromptId, subfolderId)}
      testId={previousPromptId
        ? `mockup-prompt-divider-add-after-${previousPromptId}`
        : `mockup-prompt-divider-add-initial-${subfolderId}`}
    />
  </div>
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, depth: number)}
  {@const promptIndex = getPromptIndex(prompt.id)}
  <div class="mockup-content-row" style={`--mockup-depth-indent:${depth * 12}px;`}>
    <div class="mockup-tree-gutter" aria-hidden="true">
      {@render TreeLines(depth)}
    </div>

    <article class="mockup-prompt-editor-card" data-testid={`mockup-prompt-editor-${prompt.id}`}>
      <PromptEditorSidebar
        promptId={prompt.id}
        promptFolderId="mockup-prompts"
        title={prompt.title}
        isFirstPrompt={promptIndex === 0}
        isLastPrompt={promptIndex === getPromptCount() - 1}
        onMoveUp={() => movePrompt(prompt.id, -1)}
        onMoveDown={() => movePrompt(prompt.id, 1)}
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
  </div>
{/snippet}

{#snippet SubfolderRow(subfolder: MockSubfolder)}
  {@const isExpanded = expandedSubfolderIds.has(subfolder.id)}
  <div
    class="mockup-content-row mockup-subfolder-content-row"
    style={`--mockup-depth-indent:${subfolder.depth * 12}px;`}
  >
    <div class="mockup-tree-gutter" aria-hidden="true">
      {@render TreeLines(subfolder.depth + 1)}
    </div>

    <section class="mockup-subfolder-row" data-expanded={isExpanded}>
      <button
        class="mockup-subfolder-icon-button mockup-drag-handle"
        type="button"
        aria-label={`Reorder ${subfolder.title}`}
      >
        <GripVertical size={15} aria-hidden="true" />
      </button>

      <button
        class="mockup-subfolder-icon-button mockup-chevron"
        type="button"
        aria-label={isExpanded ? `Collapse ${subfolder.title}` : `Expand ${subfolder.title}`}
        aria-expanded={isExpanded}
        onclick={() => toggleSubfolder(subfolder.id)}
      >
        {#if isExpanded}
          <ChevronDown size={16} aria-hidden="true" />
        {:else}
          <ChevronRight size={16} aria-hidden="true" />
        {/if}
      </button>

      <div class="mockup-subfolder-title-group">
        <div class="mockup-subfolder-title-row">
          <h3 class="mockup-subfolder-title">{subfolder.title}</h3>
          <button
            class="mockup-subfolder-edit-button"
            type="button"
            aria-label={`Edit ${subfolder.title}`}
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
        </div>

        <div class="mockup-subfolder-meta-row">
          <span>{formatCount(countPromptsInSubfolder(subfolder), 'prompt')}</span>
          {@render SeparatorDot()}
          <span>{formatCount(countNestedSubfolders(subfolder), 'subfolder')}</span>
        </div>
      </div>

      <button
        class="mockup-add-subfolder-button"
        type="button"
        onclick={() => addNestedSubfolder(subfolder.id)}
      >
        <Plus size={14} aria-hidden="true" />
        <span>Add Subfolder</span>
      </button>
    </section>
  </div>

  {#if isExpanded}
    <div class="mockup-subfolder-contents">
      {@render PromptDividerRow(null, subfolder.id, subfolder.depth + 1)}
      {#each subfolder.prompts as prompt (prompt.id)}
        {@render PromptEditor(prompt, subfolder.depth + 1)}
        {@render PromptDividerRow(prompt.id, subfolder.id, subfolder.depth + 1)}
      {/each}

      {#each subfolder.children as childSubfolder (childSubfolder.id)}
        {@render SubfolderRow(childSubfolder)}
      {/each}
    </div>
  {/if}
{/snippet}

<section
  class="prompt-folder-base-mockup"
  data-testid="prompt-folder-base-mockup"
>
  <div class="mockup-folder-header">
    <div class="mockup-folder-title-stack">
      <h2 class="mockup-folder-title">Prompts</h2>
      <div class="mockup-folder-meta">
        <span>{formatCount(getPromptCount(), 'prompt')}</span>
        {@render SeparatorDot()}
        <span>{formatCount(countSubfolders(mockSubfolders), 'subfolder')}</span>
      </div>
    </div>
  </div>

  <div class="mockup-editor-row">
    {#each mockSubfolders as subfolder (subfolder.id)}
      {@render SubfolderRow(subfolder)}
    {/each}
  </div>
</section>

<style>
  .prompt-folder-base-mockup {
    --mockup-monaco-editor-background: #1f1f1f;
    --mockup-gutter-width: 34px;
    --mockup-tree-line-color: color-mix(in srgb, var(--ui-secondary-icon-glyph) 42%, transparent);
    --mockup-subfolder-surface: color-mix(in srgb, var(--ui-card-overlay-surface) 78%, #30424a);
    --mockup-subfolder-accent: #9fb7c0;
    --mockup-subfolder-border: color-mix(in srgb, var(--ui-neutral-muted-border) 72%, #88a8b0);

    box-sizing: border-box;
    min-width: 0;
    padding-bottom: 8px;
    width: 100%;
  }

  .mockup-folder-header {
    align-items: end;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    margin: 0 0 10px var(--mockup-gutter-width);
    min-width: 0;
    padding: 0 0 10px 0;
  }

  .mockup-folder-title-stack {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .mockup-folder-title {
    color: var(--ui-normal-text);
    font-size: 18px;
    font-weight: 650;
    line-height: 24px;
    margin: 0;
  }

  .mockup-folder-meta {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    font-size: 12px;
    gap: 7px;
    line-height: 16px;
    min-width: 0;
    white-space: nowrap;
  }

  .mockup-editor-row {
    align-items: stretch;
    display: grid;
    gap: 0;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    width: 100%;
  }

  .mockup-content-row {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: calc(var(--mockup-gutter-width) + var(--mockup-depth-indent, 0px)) minmax(0, 1fr);
    min-width: 0;
    position: relative;
    width: 100%;
  }

  .mockup-tree-gutter {
    min-height: 100%;
    min-width: 0;
    position: relative;
  }

  .mockup-tree-line {
    background: var(--mockup-tree-line-color);
    bottom: 0;
    position: absolute;
    top: 0;
    width: 1px;
  }

  .mockup-subfolder-content-row {
    margin-top: 8px;
  }

  .mockup-subfolder-row {
    align-items: center;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--mockup-subfolder-accent) 16%, transparent),
        transparent 38%
      ),
      var(--mockup-subfolder-surface);
    border: 1px solid var(--mockup-subfolder-border);
    border-radius: 7px;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 9%),
      0 1px 2px rgb(0 0 0 / 24%);
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    grid-template-columns: 22px 26px minmax(0, 1fr) auto;
    min-height: 46px;
    min-width: 0;
    padding: 7px 10px 7px 7px;
  }

  .mockup-subfolder-icon-button,
  .mockup-subfolder-edit-button,
  .mockup-add-subfolder-button {
    align-items: center;
    border: 0;
    box-sizing: border-box;
    cursor: default;
    display: inline-flex;
    font-family: inherit;
    justify-content: center;
    min-width: 0;
  }

  .mockup-subfolder-icon-button {
    background: transparent;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-icon-glyph);
    height: 24px;
    padding: 0;
    width: 22px;
  }

  .mockup-drag-handle {
    color: var(--ui-muted-text);
  }

  .mockup-chevron {
    background: color-mix(in srgb, var(--ui-card-overlay-surface) 74%, transparent);
    color: var(--ui-normal-text);
    width: 26px;
  }

  .mockup-subfolder-title-group {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .mockup-subfolder-title-row {
    align-items: center;
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .mockup-subfolder-title {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 650;
    line-height: 18px;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mockup-subfolder-edit-button {
    background: transparent;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-icon-glyph);
    flex: 0 0 auto;
    height: 20px;
    padding: 0;
    width: 20px;
  }

  .mockup-subfolder-meta-row {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    font-size: 11px;
    gap: 6px;
    line-height: 14px;
    min-width: 0;
    white-space: nowrap;
  }

  .mockup-add-subfolder-button {
    background: color-mix(in srgb, var(--ui-card-overlay-surface) 82%, transparent);
    border: 1px solid color-mix(in srgb, var(--ui-neutral-muted-border) 80%, transparent);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-normal-text);
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 600;
    gap: 5px;
    height: 28px;
    line-height: 16px;
    padding: 0 9px;
  }

  .mockup-subfolder-contents {
    display: grid;
    gap: 0;
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

  @media (max-width: 720px) {
    .prompt-folder-base-mockup {
      --mockup-gutter-width: 24px;
    }

    .mockup-folder-header {
      margin-left: var(--mockup-gutter-width);
    }

    .mockup-subfolder-row {
      grid-template-columns: 20px 24px minmax(0, 1fr);
    }

    .mockup-add-subfolder-button {
      grid-column: 3;
      justify-self: start;
      margin-top: 2px;
    }
  }
</style>
