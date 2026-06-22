<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { FileText, Folder } from 'lucide-svelte'
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

  let mockPrompts = $state<MockPrompt[]>([
    {
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
      id: 'mockup-refactor',
      title: 'Refactor editor sizing controller',
      folder: 'Prompts',
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
      folder: 'Prompts',
      modifiedLabel: 'Updated 1 hr ago',
      text: [
        'Code review the prompt tree drag/drop implementation. Focus on persistence order, optimistic UI state, and recovery when a drop target disappears.',
        '',
        'List only issues that can produce user-visible regressions.'
      ].join('\n')
    },
    {
      id: 'mockup-tests',
      title: 'Write Playwright coverage',
      folder: 'Prompts',
      modifiedLabel: 'Updated yesterday',
      text: [
        'Add Playwright coverage for adding a prompt, typing in the Monaco editor, navigating away, and returning to verify content and focus state.',
        '',
        'Use the existing test helpers and data-testid selectors.'
      ].join('\n')
    },
    {
      id: 'mockup-polish',
      title: 'Polish settings controls',
      folder: 'Prompts',
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

  const createNewPrompt = (): MockPrompt => {
    const promptNumber = nextPromptSequence
    nextPromptSequence += 1

    return {
      id: `mockup-new-${promptNumber}`,
      title: `New prompt ${promptNumber}`,
      folder: 'Prompts',
      modifiedLabel: 'Just now',
      text: ''
    }
  }

  const addPromptAfter = (previousPromptId: string | null) => {
    const nextPrompt = createNewPrompt()
    if (previousPromptId === null) {
      mockPrompts = [nextPrompt, ...mockPrompts]
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

{#snippet PromptDividerRow(previousPromptId: string | null)}
  <PromptDivider
    onAddPrompt={() => addPromptAfter(previousPromptId)}
    testId={previousPromptId
      ? `mockup-prompt-divider-add-after-${previousPromptId}`
      : 'mockup-prompt-divider-add-initial'}
  />
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
    {@render PromptDividerRow(null)}
    {#each mockPrompts as prompt, index (prompt.id)}
      {@render PromptEditor(prompt, index)}
      {@render PromptDividerRow(prompt.id)}
    {/each}
  </div>
</section>

<style>
  .prompt-folder-base-mockup {
    --mockup-monaco-editor-background: #1f1f1f;

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
