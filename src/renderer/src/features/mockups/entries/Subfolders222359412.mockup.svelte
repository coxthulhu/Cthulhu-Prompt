<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Pencil } from 'lucide-svelte'
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
    folderId: string | null
    modifiedLabel: string
    text: string
  }

  type MockFolder = {
    id: string
    parentId: string | null
    title: string
  }

  let mockFolders = $state<MockFolder[]>([
    {
      id: 'folder-review',
      parentId: null,
      title: 'Review queue'
    },
    {
      id: 'folder-review-regressions',
      parentId: 'folder-review',
      title: 'Regression checks'
    },
    {
      id: 'folder-planning',
      parentId: null,
      title: 'Planning'
    },
    {
      id: 'folder-polish',
      parentId: null,
      title: 'Polish'
    }
  ])

  let mockPrompts = $state<MockPrompt[]>([
    {
      id: 'mockup-outline',
      title: 'Outline workspace import edge cases',
      folderId: null,
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
      folderId: 'folder-planning',
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
      folderId: 'folder-review',
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
      folderId: 'folder-review-regressions',
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
      folderId: 'folder-planning',
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
      folderId: 'folder-polish',
      modifiedLabel: 'Updated Jun 8',
      text: [
        'Tighten the settings screen controls so numeric inputs, toggles, and labels align consistently at desktop and narrow widths.',
        '',
        'Stay within the existing palette and cthulhu-ui component conventions.'
      ].join('\n')
    }
  ])

  const collapsedFolderIds = new SvelteSet<string>()

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
    monaco.Uri.file(`/cthulhu-prompt/mockups/subfolders-222359412/${promptId}.md`)

  const getChildFolders = (parentId: string | null): MockFolder[] =>
    mockFolders.filter((folder) => folder.parentId === parentId)

  const getFolderPrompts = (folderId: string | null): MockPrompt[] =>
    mockPrompts.filter((prompt) => prompt.folderId === folderId)

  const getFolder = (folderId: string | null): MockFolder | undefined =>
    folderId ? mockFolders.find((folder) => folder.id === folderId) : undefined

  const getFolderPathLabel = (folderId: string | null): string => {
    const folder = getFolder(folderId)
    if (!folder) return 'Prompts'

    const parent = getFolder(folder.parentId)
    return parent ? `${parent.title} / ${folder.title}` : folder.title
  }

  const countPromptsInFolder = (folderId: string): number => {
    const directPromptCount = getFolderPrompts(folderId).length
    const childPromptCount = getChildFolders(folderId).reduce(
      (count, childFolder) => count + countPromptsInFolder(childFolder.id),
      0
    )

    return directPromptCount + childPromptCount
  }

  const isFolderCollapsed = (folderId: string): boolean => collapsedFolderIds.has(folderId)

  const toggleFolder = (folderId: string) => {
    if (collapsedFolderIds.has(folderId)) {
      collapsedFolderIds.delete(folderId)
      return
    }

    collapsedFolderIds.add(folderId)
  }

  const focusFolderTitle = (event: MouseEvent) => {
    const row = (event.currentTarget as HTMLElement).closest('.mockup-folder-title-row')
    const input = row?.querySelector<HTMLInputElement>('.mockup-folder-title-input')
    input?.focus()
    input?.select()
  }

  const getVisiblePrompts = (): MockPrompt[] => {
    const visiblePrompts: MockPrompt[] = []

    const collectFolder = (folderId: string | null) => {
      visiblePrompts.push(...getFolderPrompts(folderId))

      for (const childFolder of getChildFolders(folderId)) {
        if (!isFolderCollapsed(childFolder.id)) {
          collectFolder(childFolder.id)
        }
      }
    }

    collectFolder(null)
    return visiblePrompts
  }

  let visiblePrompts = $derived(getVisiblePrompts())

  let nextPromptSequence = $state(1)

  const createNewPrompt = (folderId: string | null): MockPrompt => {
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1

    return {
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folderId,
      modifiedLabel: 'Just now',
      text: ''
    }
  }

  const addPromptAfter = (previousPromptId: string | null, folderId: string | null) => {
    const previousPrompt = previousPromptId
      ? mockPrompts.find((prompt) => prompt.id === previousPromptId)
      : undefined
    const nextPrompt = createNewPrompt(previousPrompt?.folderId ?? folderId)

    if (previousPromptId === null) {
      const firstPromptInFolderIndex = mockPrompts.findIndex((prompt) => prompt.folderId === folderId)
      if (firstPromptInFolderIndex === -1) {
        mockPrompts = [...mockPrompts, nextPrompt]
        return
      }

      const nextPrompts = [...mockPrompts]
      nextPrompts.splice(firstPromptInFolderIndex, 0, nextPrompt)
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

  const movePrompt = (index: number, direction: -1 | 1) => {
    const prompt = visiblePrompts[index]
    const targetPrompt = visiblePrompts[index + direction]
    if (!prompt || !targetPrompt) return

    const promptIndex = mockPrompts.findIndex((candidate) => candidate.id === prompt.id)
    const targetIndex = mockPrompts.findIndex((candidate) => candidate.id === targetPrompt.id)
    if (promptIndex === -1 || targetIndex === -1) return

    const nextPrompts = [...mockPrompts]
    const [movedPrompt] = nextPrompts.splice(promptIndex, 1)
    nextPrompts.splice(targetIndex, 0, movedPrompt)
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

{#snippet PromptDividerRow(previousPromptId: string | null, folderId: string | null)}
  <PromptDivider
    onAddPrompt={() => addPromptAfter(previousPromptId, folderId)}
    testId={previousPromptId
      ? `mockup-prompt-divider-add-after-${previousPromptId}`
      : `mockup-prompt-divider-add-initial-${folderId ?? 'root'}`}
  />
{/snippet}

{#snippet PromptEditor(prompt: MockPrompt, index: number)}
  <article class="mockup-prompt-editor-card" data-testid={`mockup-prompt-editor-${prompt.id}`}>
    <PromptEditorSidebar
      promptId={prompt.id}
      promptFolderId={prompt.folderId ?? 'mockup-prompts'}
      title={prompt.title}
      isFirstPrompt={index === 0}
      isLastPrompt={index === visiblePrompts.length - 1}
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
            <input class="mockup-title-input" bind:value={prompt.title} aria-label="Prompt title" />
            <div class="mockup-metadata-row">
              <span class="mockup-metadata-folder" title={getFolderPathLabel(prompt.folderId)}>
                <Folder class="mockup-metadata-folder-icon" size={12} aria-hidden="true" />
                {getFolderPathLabel(prompt.folderId)}
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

{#snippet PromptStack(folderId: string | null)}
  {@render PromptDividerRow(null, folderId)}
  {#each getFolderPrompts(folderId) as prompt (prompt.id)}
    {@render PromptEditor(prompt, visiblePrompts.findIndex((visiblePrompt) => visiblePrompt.id === prompt.id))}
    {@render PromptDividerRow(prompt.id, folderId)}
  {/each}
{/snippet}

{#snippet FolderBranch(folder: MockFolder)}
  <section class="mockup-folder-group" data-collapsed={isFolderCollapsed(folder.id)}>
    <header class="mockup-folder-title-row">
      <button
        class="mockup-folder-disclosure"
        type="button"
        aria-label={isFolderCollapsed(folder.id) ? `Expand ${folder.title}` : `Collapse ${folder.title}`}
        aria-expanded={!isFolderCollapsed(folder.id)}
        onclick={() => toggleFolder(folder.id)}
      >
        {#if isFolderCollapsed(folder.id)}
          <ChevronRight class="mockup-folder-disclosure-icon" size={17} aria-hidden="true" />
        {:else}
          <ChevronDown class="mockup-folder-disclosure-icon" size={17} aria-hidden="true" />
        {/if}
      </button>

      <span class="mockup-folder-badge" aria-hidden="true">
        {#if isFolderCollapsed(folder.id)}
          <Folder class="mockup-folder-badge-icon" size={18} aria-hidden="true" />
        {:else}
          <FolderOpen class="mockup-folder-badge-icon" size={18} aria-hidden="true" />
        {/if}
      </span>

      <div class="mockup-folder-title-copy">
        <input
          class="mockup-folder-title-input"
          bind:value={folder.title}
          aria-label={`Folder title: ${folder.title}`}
        />
        <div class="mockup-folder-metadata-row">
          <span>{countPromptsInFolder(folder.id)} prompts</span>
          {@render SeparatorDot()}
          <span>{getChildFolders(folder.id).length} subfolders</span>
        </div>
      </div>

      <button
        class="mockup-folder-edit-button"
        type="button"
        aria-label={`Edit ${folder.title}`}
        onclick={focusFolderTitle}
      >
        <Pencil class="mockup-folder-edit-icon" size={15} aria-hidden="true" />
      </button>
    </header>

    {#if !isFolderCollapsed(folder.id)}
      <div class="mockup-folder-children">
        {@render PromptStack(folder.id)}

        {#each getChildFolders(folder.id) as childFolder (childFolder.id)}
          {@render FolderBranch(childFolder)}
        {/each}
      </div>
    {/if}
  </section>
{/snippet}

<section class="prompt-folder-base-mockup" data-testid="prompt-folder-base-mockup">
  <div class="mockup-folder-screen-header">
    <div class="mockup-folder-screen-title">
      <FolderOpen class="mockup-screen-title-icon" size={18} aria-hidden="true" />
      <span>Prompts</span>
    </div>
    <button class="mockup-new-folder-button" type="button">New folder</button>
  </div>

  <div class="mockup-editor-row">
    {@render PromptStack(null)}

    {#each getChildFolders(null) as folder (folder.id)}
      {@render FolderBranch(folder)}
    {/each}
  </div>
</section>

<style>
  .prompt-folder-base-mockup {
    --mockup-monaco-editor-background: #1f1f1f;
    --mockup-folder-line: oklch(0.8 0.04 190 / 34%);
    --mockup-folder-line-soft: oklch(0.8 0.04 190 / 15%);
    --mockup-folder-row-surface: linear-gradient(
      90deg,
      oklch(0.28 0.045 190 / 72%),
      oklch(0.22 0.025 160 / 34%) 58%,
      oklch(1 0 0 / 2%)
    );
    --mockup-folder-row-hover-surface: linear-gradient(
      90deg,
      oklch(0.34 0.055 190 / 82%),
      oklch(0.24 0.04 145 / 42%) 58%,
      oklch(1 0 0 / 4%)
    );

    box-sizing: border-box;
    min-width: 0;
    padding-bottom: 8px;
    width: 100%;
  }

  .mockup-folder-screen-header {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    min-width: 0;
    padding: 0 0 8px;
  }

  .mockup-folder-screen-title {
    align-items: center;
    color: var(--ui-normal-text);
    display: inline-flex;
    font-size: 15px;
    font-weight: 650;
    gap: 8px;
    line-height: 20px;
    min-width: 0;
  }

  :global(.mockup-screen-title-icon) {
    color: var(--ui-secondary-icon-glyph);
    flex: 0 0 auto;
  }

  .mockup-new-folder-button {
    align-items: center;
    background: var(--ui-neutral-action-fill);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-text);
    cursor: pointer;
    display: inline-flex;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    height: 28px;
    justify-content: center;
    line-height: 16px;
    padding: 0 10px;
  }

  .mockup-new-folder-button:hover {
    background: var(--ui-neutral-action-hover-fill);
    color: var(--ui-normal-text);
  }

  .mockup-editor-row {
    align-items: stretch;
    display: grid;
    gap: 0;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    width: 100%;
  }

  .mockup-folder-group {
    display: grid;
    gap: 0;
    min-width: 0;
    position: relative;
  }

  .mockup-folder-group:not([data-collapsed='true'])::before {
    background: linear-gradient(
      180deg,
      var(--mockup-folder-line),
      var(--mockup-folder-line) calc(100% - 18px),
      transparent
    );
    border-radius: 999px;
    bottom: 4px;
    content: '';
    left: 15px;
    position: absolute;
    top: 24px;
    width: 1px;
    z-index: 0;
  }

  .mockup-folder-title-row {
    align-items: center;
    background: var(--mockup-folder-row-surface);
    border: 0;
    border-radius: var(--cthulhu-ui-radius-card);
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    grid-template-columns: 30px 34px minmax(0, 1fr) 30px;
    min-height: 50px;
    min-width: 0;
    overflow: hidden;
    padding: 6px 10px 6px 0;
    position: relative;
    z-index: 1;
  }

  .mockup-folder-title-row:hover {
    background: var(--mockup-folder-row-hover-surface);
  }

  .mockup-folder-disclosure,
  .mockup-folder-edit-button {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-secondary-icon-glyph);
    cursor: pointer;
    display: inline-flex;
    height: 30px;
    justify-content: center;
    padding: 0;
    width: 30px;
  }

  .mockup-folder-title-row:hover .mockup-folder-disclosure,
  .mockup-folder-title-row:hover .mockup-folder-edit-button {
    color: var(--ui-hoverable-icon-glyph);
  }

  .mockup-folder-disclosure:hover,
  .mockup-folder-edit-button:hover {
    background: var(--ui-neutral-action-hover-fill);
    color: var(--ui-normal-text);
  }

  :global(.mockup-folder-disclosure-icon),
  :global(.mockup-folder-edit-icon) {
    stroke-width: 2.35;
  }

  .mockup-folder-badge {
    align-items: center;
    background: oklch(1 0 0 / 8%);
    border-radius: var(--cthulhu-ui-radius-card);
    color: var(--ui-hoverable-icon-glyph);
    display: inline-flex;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  :global(.mockup-folder-badge-icon) {
    stroke-width: 2.25;
  }

  .mockup-folder-title-copy {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .mockup-folder-title-input {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-family: inherit;
    font-size: 15px;
    font-weight: 650;
    height: 20px;
    line-height: 20px;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .mockup-folder-title-input:focus {
    color: var(--ui-normal-text);
  }

  .mockup-folder-metadata-row {
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

  .mockup-folder-children {
    display: grid;
    gap: 0;
    min-width: 0;
    padding-left: 28px;
    position: relative;
  }

  .mockup-folder-children::before {
    background: var(--mockup-folder-line-soft);
    border-radius: 999px;
    bottom: 16px;
    content: '';
    left: 15px;
    position: absolute;
    top: 0;
    width: 1px;
  }

  .mockup-folder-children > .mockup-folder-group {
    margin-top: 2px;
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

  .mockup-prompt-editor-card:hover {
    background: oklch(0.23 0.018 190);
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
    max-width: 220px;
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
